/* The installed app stays on Pages; authenticated requests follow the backend. */
(() => {
  'use strict';
  if (!window.FUKUSHU_HOSTED || window.FukushuConnection) return;
  const nativeFetch = window.fetch.bind(window);
  const brandIcon = new URL('icons/icon-192.png?v=psu-hope-20261028', document.currentScript?.src || new URL('static/connection.js', location.href)).href;
  const root = document.documentElement;
  const localPreview = ['localhost', '127.0.0.1'].includes(location.hostname);
  const accountKey = 'fukushu.launch.key.v1';
  const endpointKey = 'fukushu.endpoint.v1';
  const serverOrigins = new Set(['https://fukushu.78-17-185-232.sslip.io']);
  const gatewayStatuses = new Set([502, 503, 504, 530]);
  const validKey = value => /^[A-Za-z0-9_-]{8,128}$/.test(value || '');
  const isInstalled = () => navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
  const read = name => { try { return localStorage.getItem(name); } catch (_) { return null; } };
  const write = (name, value) => { try { localStorage.setItem(name, value); } catch (_) {} };
  const fragment = location.hash.slice(1).split('~');
  const isRoute = value => /^(?:home|study|glossary|stats|errors|dojo|practice|(?:learn|listen|task|lecture|lectures)-[0-9]+)$/.test(value || '');
  const suppliedKey = validKey(fragment[0]) && (fragment.length > 1 || !isRoute(fragment[0])) ? fragment[0] : '';
  const key = suppliedKey || read(accountKey) || '';
  if (validKey(key)) write(accountKey, key);
  let origin = '', connecting = null, started = false, boot = null, retryTimer = 0;
  let lastDiscovery = 0, retryCount = 0, installedPrompt = null, manifestUrl = '';
  let cover = null, note = null, installDialog = null, returnFocus = null, bodyOverflow = '';
  root.dataset.hosted = 'true';

  function normalizeEndpoint(raw) {
    const value = String(raw || '').trim();
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('Неверный адрес подключения.');
    const quick = url.protocol === 'https:' && !url.port && /^[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com$/.test(url.hostname);
    const server = serverOrigins.has(url.origin);
    const preview = localPreview && ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1'].includes(url.hostname);
    if (!quick && !server && !preview) throw new Error('Адрес подключения не подходит этому приложению.');
    return url.origin;
  }

  async function timedFetch(url, options = {}, timeout = 9000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try { return await nativeFetch(url, {...options, signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer'}); }
    finally { clearTimeout(timer); }
  }

  async function alive(candidate) {
    try {
      const response = await timedFetch(candidate + '/healthz', {cache: 'no-store', mode: 'cors'}, 6000);
      return response.ok && (await response.text()).trim() === 'ok';
    } catch (_) { return false; }
  }

  function launchRoute() {
    const parts = location.hash.slice(1).split('~');
    return validKey(parts[0]) && parts[0] === key ? (parts[1] || '') : (parts[0] || '');
  }

  function setRoute(route = '') {
    const safe = /^(?:home|study|glossary|stats|errors|dojo|practice|(?:learn|listen|task|lecture|lectures)-[0-9]+)?$/.test(route) ? route : '';
    history.replaceState(null, '', location.pathname + location.search + '#' + key + (safe ? '~' + safe : ''));
  }

  function ensureCover() {
    if (cover?.isConnected) return cover;
    cover = document.createElement('section');
    cover.id = 'connection-cover';
    cover.setAttribute('aria-label', 'Подключение к PSU Hope');
    cover.innerHTML = '<div class="connection-card box"><div class="brand-mark" aria-hidden="true"><img class="brand-logo" src="' + brandIcon + '" alt="" width="56" height="56"></div><h1>PSU Hope</h1><p id="connection-status" role="status" aria-live="polite">Подключаюсь к PSU Hope…</p><p class="hint" id="connection-detail">Лекции и твой прогресс доступны после подключения.</p><button class="btn pri" id="connection-retry" hidden>Подключиться ещё раз</button><form id="connection-login" hidden><label for="connection-link">Личная ссылка из бота</label><input id="connection-link" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Вставь ссылку «Веб-версия»"><button class="btn pri" type="submit">Открыть моё приложение</button></form>' +
      (isInstalled() ? '' : '<button class="connection-install-link" data-install-open>Добавить на экран телефона</button>') + '</div>';
    document.body.append(cover);
    cover.querySelector('#connection-retry').onclick = () => connectAndBoot(true);
    cover.querySelector('form').onsubmit = event => {
      event.preventDefault();
      const value = cover.querySelector('input').value.trim();
      let candidate = value;
      try {
        const url = new URL(value);
        if (url.origin !== location.origin || url.pathname !== location.pathname) throw new Error('link');
        candidate = url.hash.slice(1).split('~')[0];
      } catch (_) { if (!validKey(value)) candidate = ''; }
      if (!validKey(candidate)) { cover.querySelector('#connection-status').textContent = 'Вставь свою полную ссылку из кнопки «Веб-версия» в боте.'; return; }
      location.replace(location.pathname + location.search + '#' + candidate + '~home');
      location.reload();
    };
    return cover;
  }

  function startupMessage(text, retry = false) {
    const element = ensureCover();
    element.querySelector('#connection-status').textContent = text;
    element.querySelector('#connection-retry').hidden = !retry;
    element.querySelector('#connection-status').dataset.fxBusy = String(!retry && validKey(key));
    element.querySelector('#connection-status').dataset.fxState = 'connecting';
  }

  function connectionNote(text, retry = false) {
    if (!note?.isConnected) {
      note = document.createElement('div'); note.id = 'connection-note'; note.setAttribute('role', 'status');
      const span = document.createElement('span'), button = document.createElement('button');
      button.className = 'btn sm'; button.textContent = 'Соединиться'; button.onclick = () => reconnect(true).catch(() => {});
      note.append(span, button); document.body.append(note);
    }
    note.hidden = false; note.querySelector('span').textContent = text; note.querySelector('button').hidden = !retry;
  }

  function gatewayFailure(response) {
    if (!gatewayStatuses.has(response.status)) return false;
    // The API marks its own JSON replies, including AI timeouts and a busy
    // speech queue. A proxy's JSON/HTML error has no such provenance. Do not
    // consume or clone the body: the caller must receive its original stream.
    const marker = response.headers?.get('X-Fukushu-Response');
    const type = (response.headers?.get('Content-Type') || '').split(';', 1)[0].trim().toLowerCase();
    return marker !== 'api-v1' || type !== 'application/json';
  }

  function receivedApiResponse(response) {
    // Application errors still prove the server answered. Clear only the stale
    // connectivity note; startup, discovery and retry ownership stay unchanged.
    if (response.status >= 100 && !gatewayFailure(response) && note) note.hidden = true;
    return response;
  }

  function updateManifest() {
    if (!origin || !validKey(key)) return;
    const link = document.querySelector('link[rel="manifest"]');
    if (!link) return;
    const next = origin + '/api/' + key + '/manifest.webmanifest';
    if (manifestUrl === next) return;
    manifestUrl = next; link.crossOrigin = 'anonymous'; link.href = next;
  }

  async function discover() {
    const now = Date.now();
    if (lastDiscovery && now - lastDiscovery < 15000) throw new Error('Подожди немного: проверяю адрес сервера.');
    lastDiscovery = now;
    const urls = localPreview ? [new URL('./url.txt', location.href).href] : [
      'https://api.github.com/repos/listestateru-cell/psy-konsultant/contents/url.txt',
      new URL('./url.txt', location.href).href,
    ];
    for (const url of urls) {
      try {
        const response = await timedFetch(url + (url.includes('?') ? '&' : '?') + 't=' + now, {cache: 'no-store', headers: {Accept: 'application/vnd.github.raw'}}, 8000);
        if (!response.ok) continue;
        const candidate = normalizeEndpoint(await response.text());
        if (await alive(candidate)) return candidate;
      } catch (_) { /* Try the public fallback; no personal key is sent. */ }
    }
    throw new Error('Сервер PSU Hope пока не отвечает. Проверь интернет и попробуй ещё раз.');
  }

  async function reconnect(force = false) {
    if (connecting) return connecting;
    connecting = (async () => {
      if (started) connectionNote('Восстанавливаю связь с PSU Hope…');
      let candidate = '', cached = origin || read(endpointKey);
      if (!force && cached) {
        try { cached = normalizeEndpoint(cached); if (await alive(cached)) candidate = cached; } catch (_) {}
      }
      if (!candidate) candidate = await discover();
      const previous = origin;
      origin = candidate; write(endpointKey, origin); retryCount = 0;
      updateManifest();
      if (note) note.hidden = true;
      if (previous && previous !== origin) {
        document.querySelectorAll('img[src]').forEach(img => {
          try { const url = new URL(img.src); if (url.origin === previous && url.pathname.startsWith('/api/' + key + '/slide/')) img.src = origin + url.pathname + url.search; } catch (_) {}
        });
        window.dispatchEvent(new CustomEvent('fukushu:backend-changed', {detail: {previous, origin}}));
        window.FukushuFX?.refresh?.();
      }
      return origin;
    })().catch(error => { if (started) connectionNote('Связи с PSU Hope пока нет. Твои ответы остаются на экране.', true); throw error; }).finally(() => { connecting = null; });
    return connecting;
  }

  const apiPrefix = '/api/' + key + '/';
  function ownApi(input) {
    try {
      const url = new URL(typeof input === 'string' ? input : input.url, location.href);
      if (!url.pathname.startsWith(apiPrefix)) return null;
      if (url.origin !== location.origin && url.origin !== origin) {
        // An in-flight URL may still refer to the previously published tunnel.
        normalizeEndpoint(url.origin);
      }
      return url;
    } catch (_) { return null; }
  }

  window.fetch = async (input, options = {}) => {
    const url = ownApi(input);
    if (!url) return nativeFetch(input, options);
    if (typeof Request !== 'undefined' && input instanceof Request) {
      const request = new Request(input, options);
      const headers = request.headers;
      const type = headers.get('Content-Type') || '';
      options = {...options, method: request.method, headers, signal: request.signal,
        cache: request.cache, keepalive: request.keepalive};
      if (!['GET', 'HEAD'].includes(request.method)) {
        options.body = /(?:json|text\/|x-www-form-urlencoded)/i.test(type)
          ? await request.text() : await request.arrayBuffer();
      }
    }
    if (!origin) await reconnect();
    const method = String(options.method || (typeof input !== 'string' && input.method) || 'GET').toUpperCase();
    const previous = origin;
    let failure;
    try {
      const response = receivedApiResponse(await nativeFetch(origin + url.pathname + url.search, {...options, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer'}));
      if (!gatewayFailure(response)) return response;
      failure = new Error('Связь с PSU Hope прервалась.');
    } catch (error) { if (options.signal?.aborted) throw error; failure = error; }
    try { await reconnect(true); }
    catch (_) { throw failure; }
    // Never automatically repeat purchases, uploads or other writes after an
    // ambiguous response. Their native save/retry UI keeps the original input.
    if (['GET', 'HEAD'].includes(method) && origin !== previous) {
      return receivedApiResponse(await nativeFetch(origin + url.pathname + url.search, {...options, mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer'}));
    }
    throw failure;
  };

  async function connectAndBoot(force = false) {
    clearTimeout(retryTimer);
    startupMessage('Подключаюсь к PSU Hope…');
    try {
      await reconnect(force);
      if (!started) { started = true; cover?.remove(); await boot(); }
    } catch (error) {
      if (!started) {
        startupMessage(error.message || 'Не получилось подключиться к PSU Hope.', true);
        retryCount++;
        retryTimer = setTimeout(() => { if (!document.hidden) connectAndBoot(true); }, Math.min(60000, 15000 * retryCount));
      }
    }
  }

  function closeInstall() {
    if (!installDialog) return;
    installDialog.remove(); installDialog = null;
    document.body.style.overflow = bodyOverflow;
    returnFocus?.focus?.({preventScroll: true}); returnFocus = null;
  }

  function openInstall() {
    if (installDialog) return;
    returnFocus = document.activeElement;
    bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    installDialog = document.createElement('dialog'); installDialog.id = 'install-dialog';
    installDialog.setAttribute('aria-labelledby', 'install-title');
    const installed = isInstalled();
    installDialog.innerHTML = '<div class="install-dialog-head"><h2 id="install-title">PSU Hope на экране телефона</h2><button class="btn sm" id="install-close" aria-label="Закрыть инструкцию">✕</button></div>' +
      (installed ? '<p>Ты уже открыл PSU Hope как приложение.</p>' : '<p>Значок будет открывать PSU Hope по постоянному адресу, без адресной строки браузера.</p><button class="btn pri" id="install-native" hidden>Установить PSU Hope</button><p><b>iPhone и iPad</b><br>Открой эту ссылку в Safari. Нажми «Поделиться» → «На экран “Домой”». Если есть переключатель «Открыть как веб-приложение», включи его.</p><p><b>Android</b><br>Открой эту ссылку в Chrome. В меню выбери «Установить приложение» или «Добавить на главный экран».</p>') +
      '<p class="hint">Для загрузки лекций и проверки ответов нужен интернет. Приложение само найдёт актуальный адрес сервера.</p>';
    document.body.append(installDialog);
    installDialog.querySelector('#install-close').onclick = closeInstall;
    installDialog.addEventListener('close', closeInstall);
    installDialog.addEventListener('click', event => { if (event.target === installDialog) { const rect = installDialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeInstall(); } });
    const button = installDialog.querySelector('#install-native');
    if (button && installedPrompt) {
      button.hidden = false;
      button.onclick = async () => { const prompt = installedPrompt; installedPrompt = null; button.disabled = true; try { await prompt.prompt(); await prompt.userChoice; } finally { closeInstall(); } };
    }
    installDialog.showModal(); installDialog.querySelector('#install-close').focus();
  }

  document.addEventListener('click', event => { if (event.target.closest('[data-install-open]')) openInstall(); });
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installedPrompt = event; });
  window.addEventListener('online', () => { if (started) reconnect().catch(() => {}); else if (boot && validKey(key)) connectAndBoot(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && boot && validKey(key)) { if (!started) connectAndBoot(); else if (Date.now() - lastDiscovery > 120000) reconnect().catch(() => {}); } });
  window.FukushuConnection = Object.freeze({
    hosted: true, key,
    get installed() { return isInstalled(); },
    get origin() { return origin; },
    apiBase: () => ({toString: () => origin + apiPrefix}),
    route: launchRoute, setRoute, reconnect, openInstall,
    start(callback) {
      boot = callback;
      if (!validKey(key)) {
        startupMessage('Открой свою личную ссылку из бота.');
        cover.querySelector('#connection-login').hidden = false;
        cover.querySelector('#connection-detail').textContent = 'При первом входе PSU Hope запомнит твой профиль на этом устройстве.';
      } else { setRoute(launchRoute()); connectAndBoot(); }
      if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
    },
  });
})();
