/* PSU Hope · Пластинка лекции.
   На странице лекции — конверт в цвете книги с пластинкой, подписью
   преподавателя и наклейкой «Глава N»; в развёрнутом плеере — сама пластинка
   над тайм-кодом. Звук модуль не ведёт: запускает его audioOpen/audioResume
   приложения, останавливает пауза того же <audio>. Пластинка только слушает
   события #lecture-audio и крутится, пока идёт запись. */
(() => {
  'use strict';
  if (window.PSUVinyl) return;

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  // Конверт всегда тёмный: светлые обложки книг здесь заменены глубоким тоном того же семейства.
  const SLEEVES = {neuro: '#1d4a52', personality: '#5e2130', general: '#6b4f2c', counseling: '#2c4637', materials: '#5c5242', cinema: '#1c2238', intellect: '#45304f'};
  const au = () => { try { return typeof AU !== 'undefined' ? AU : null; } catch (_) { return null; } };
  const audioEl = () => document.getElementById('lecture-audio');
  const fmt = v => {
    if (typeof audioTime === 'function') return audioTime(v);
    const s = Math.max(0, Math.floor(Number(v) || 0));
    return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function chapter(title) {
    const text = String(title || '').trim();
    const numbered = text.match(/^(?:тема|лекция|занятие)\s*(\d+)\s*[.:)\-—–]?\s*/iu);
    if (numbered) return {label: `Глава ${Number(numbered[1])}`, number: String(Number(numbered[1])), title: text.slice(numbered[0].length).trim() || text};
    if (/^глоссарий/iu.test(text)) return {label: 'Словарь', number: 'Ψ', title: 'Глоссарий'};
    return {label: 'Дополнительно', number: 'Ψ', title: text};
  }
  function palette(subject) {
    const t = window.PSUBookshelf?.theme?.(subject);
    return {sleeve: t ? SLEEVES[t.key] || t.cloth : '#2d3238', ink: t && !['general', 'materials'].includes(t.key) ? t.ink : '#f0e4c8', accent: t?.accent || '#d9a45c'};
  }
  function signature(teacher, subject) {
    const words = String(teacher || '').split(/\s+/).filter(Boolean);
    if (words.length >= 3) return `${words[0]} ${words[words.length - 1]}`;
    return words.length ? words.join(' ') : String(subject || 'PSU Hope');
  }
  function initials(teacher) {
    const words = String(teacher || '').split(/\s+/).filter(Boolean);
    return words.length >= 3 ? `${words[0][0]}. ${words[1][0]}. ${words[words.length - 1]}` : words.join(' ');
  }
  function record(number) {
    return `<span class="vinyl-record"><span class="vinyl-disc"><span class="vinyl-label"><small>PSU Hope</small><b data-vinyl-number>${esc(number)}</b><i>33⅓</i></span></span><span class="vinyl-sheen"></span><span class="vinyl-hole"></span></span>`;
  }

  function presentationHtml(id) {
    return `<div class="presentation-head"><h3 id="presentation-title-${id}" tabindex="-1">Презентация</h3><button class="btn sm" type="button" data-presentation-action="close">Свернуть</button></div>
<p class="presentation-note hint" role="status" data-presentation-status></p>
<button class="btn sm" type="button" data-presentation-action="retry" hidden>Повторить загрузку</button>
<div data-presentation-content hidden>
<div class="presentation-frame"><img data-presentation-image alt="" decoding="async" referrerpolicy="no-referrer"><p data-presentation-blank hidden>Сейчас лектор говорит без слайда</p></div>
<p class="presentation-note hint" role="status" data-presentation-image-error hidden>Не удалось открыть слайд. <button class="btn sm" type="button" data-presentation-action="reload">Загрузить снова</button></p>
<div class="presentation-pager" role="group" aria-label="Листать презентацию"><button class="btn sm" type="button" data-presentation-action="prev" aria-label="Предыдущий слайд">← Назад</button><span data-presentation-count aria-live="polite"></span><button class="btn sm" type="button" data-presentation-action="next" aria-label="Следующий слайд">Дальше →</button></div>
<div class="presentation-tools"><button class="btn sm" type="button" data-presentation-action="follow" aria-pressed="false" hidden>Листать по аудио</button><a class="btn sm" data-presentation-full target="_blank" rel="noopener noreferrer">Увеличить слайд</a></div>
</div>`;
  }

  // Конверт для страницы лекции.
  function lectureHtml(l) {
    const ch = chapter(l.title), colors = palette(l.subject);
    const id = Number(l.id), hasSlides = l.has_slides !== false;
    const heard = Math.floor((Number(l.heard_seconds) || 0) / 60);
    const label = `${ch.label}. ${ch.title}`;
    return `<section class="box lecture-vinyl" aria-label="Аудиолекция"><div class="psu-vinyl" data-vinyl-lecture="${Number(l.id)}" data-vinyl-heard="${heard}" style="--sleeve:${colors.sleeve};--sleeve-ink:${colors.ink};--accent:${colors.accent}">
<button class="vinyl-hit" type="button" data-vinyl-toggle="${Number(l.id)}" aria-pressed="false" aria-label="${esc('Слушать: ' + label)}"><span class="vinyl-sleeve"><span class="vinyl-back"></span>${record(ch.number)}<span class="vinyl-pocket"><span class="vinyl-sign" style="--sign:${Math.min(.084, .98 / Math.max(1, signature(l.teacher, l.subject).length)).toFixed(3)}">${esc(signature(l.teacher, l.subject))}</span><span class="vinyl-sticker"><small>${esc(initials(l.teacher) || 'PSU Hope')}</small><b>${esc(ch.label)}</b><small>${esc(l.subject || '')}</small></span></span></span></button>
<div class="vinyl-caption"><span class="vinyl-state" data-vinyl-state>${heard ? `Прослушано ${heard} мин. Нажми на пластинку, чтобы продолжить` : 'Нажми на пластинку, чтобы слушать'}</span><b class="vinyl-time" data-vinyl-time></b><a class="vinyl-safari" data-vinyl-safari hidden>Открыть лекцию в Safari</a><button class="vinyl-study" type="button" onclick="audioStudy(${id},${Number(l.subject_id) || 0})">Слушать с вопросами по прослушанному</button>${hasSlides ? `<button class="vinyl-study presentation-launch" type="button" data-presentation-open="${id}" aria-controls="lecture-presentation-${id}" aria-expanded="false">Слушать с презентацией</button>` : ''}</div>
</div>${hasSlides ? `<section class="lecture-presentation" id="lecture-presentation-${id}" aria-labelledby="presentation-title-${id}" hidden></section>` : ''}</section>`;
  }

  // Пластинка в плеере: встаёт над тайм-кодом, видна, когда плеер развёрнут.
  function dock() {
    const panel = document.getElementById('audio-dock');
    if (!panel || panel.querySelector('.audio-vinyl')) return;
    const slot = document.createElement('div');
    slot.className = 'audio-vinyl psu-vinyl';
    slot.dataset.vinylLecture = 'current';
    slot.innerHTML = `<button class="vinyl-hit" type="button" data-vinyl-toggle="current" aria-pressed="false" aria-label="Пауза или продолжить лекцию">${record('Ψ')}</button>`;
    const position = document.getElementById('audio-position');
    if (position) position.before(slot); else panel.append(slot);
  }

  // У <audio> бывает состояние «играет», хотя время стоит и звука нет.
  // Следим за временем и по следующему тапу вызываем восстановление плеера.
  // Одного застывшего тайм-кода недостаточно, чтобы установить причину сбоя.
  const STUCK_MS = 3500;
  const watch = {id: 0, time: NaN, at: 0, stuck: false, rescues: 0};
  let watchTimer = 0;
  const standalone = () => {
    try { return !!(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true); } catch (_) { return false; }
  };
  const safariHref = () => (/^https:\/\//.test(location.href) ? 'x-safari-' + location.href : '');
  function frozen(id) { return !!(id && watch.stuck && watch.id === id); }

  function observe() {
    const a = au(), el = audioEl(), id = Number(a?.lecture_id) || 0, now = Date.now();
    if (id !== watch.id) Object.assign(watch, {id, time: NaN, at: now, stuck: false, rescues: 0});
    if (!el || !id || !a?.ready) return;
    const t = Number(el.currentTime) || 0;
    // Пауза, перемотка, перезапуск и подгрузка данных — не застревание: отсчёт заново.
    if (el.paused || el.ended || el.seeking || a.restoring || el.readyState < 3) { watch.time = t; watch.at = now; return; }
    if (!Number.isFinite(watch.time) || Math.abs(t - watch.time) > .05) {
      const advanced = Number.isFinite(watch.time);
      watch.time = t; watch.at = now;
      if (advanced && (watch.stuck || watch.rescues)) {
        watch.stuck = false; watch.rescues = 0;
        if (NOTES.includes(a.notice)) notify(a, '');
        paint();
      }
      return;
    }
    if (!watch.stuck && now - watch.at >= STUCK_MS) {
      watch.stuck = true;
      // Та же подсказка в строке плеера: у пластинки в плеере своей подписи нет.
      notify(a, NOTES[watch.rescues > 0 ? 1 : 0]);
      paint();
    }
  }
  const NOTES = ['Звук не идёт. Нажми на пластинку, я перезапущу запись.',
    'Звук пока не запускается. Нажми на пластинку ещё раз.',
    'Перезапускаю звук…'];
  function notify(a, text) {
    a.notice = text;
    if (typeof audioDraw === 'function') try { audioDraw(); } catch (_) {}
  }
  function watchStart() { if (!watchTimer) watchTimer = setInterval(observe, 500); observe(); }
  function watchStop() { if (watchTimer) { clearInterval(watchTimer); watchTimer = 0; } }

  function rescue(a, el) {
    watch.rescues += 1;
    watch.stuck = false; watch.time = NaN; watch.at = Date.now();
    // Восстановление запускается по нажатию, когда звук застрял.
    a.stalled = true;
    a.stalledAt = Number(el?.currentTime) || a.stalledAt || 0;
    audioRecoverPlay();
  }

  function toggle(target) {
    const a = au(), el = audioEl();
    const id = target === 'current' ? Number(a?.lecture_id) : Number(target);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (a && a.lecture_id === id && a.ready && (frozen(id) || a.stalled) && typeof audioRecoverPlay === 'function') { rescue(a, el); return; }
    if (a && a.lecture_id === id && a.ready && el && !el.paused) { el.pause(); return; }
    if (a && a.lecture_id === id && a.ready && typeof audioResume === 'function') { audioResume(); return; }
    if (typeof audioOpen === 'function') audioOpen(id, true);
  }

  let presentation = null;

  function fullLecture(id, a = au()) {
    return Number(a?.lecture_id) === id && a.playback_context !== 'excerpt' && !a.clip && !a.excerpt;
  }

  function showSlide(p, index) {
    const page = p.pages[index];
    if (!page && index !== null) return;
    const src = page ? `${API}slide/${p.id}/${page}` : null;
    if (p.index === index && p.image.getAttribute('src') === src) return;
    p.index = index;
    p.imageError.hidden = true;
    p.image.hidden = !page;
    p.full.hidden = !page;
    p.blank.hidden = !!page;
    if (page) {
      p.image.alt = `Слайд ${page}`;
      p.image.src = src;
      p.full.href = src;
    } else {
      p.image.alt = '';
      p.image.removeAttribute('src');
      p.full.removeAttribute('href');
    }
    p.count.textContent = page ? `Слайд ${page} из ${p.pages.at(-1)}` : 'Без слайда';
    p.prev.disabled = index === null || index === 0;
    p.next.disabled = index === p.pages.length - 1;
  }

  function presentationSync() {
    const p = presentation;
    if (!p?.pages?.length || !p.panel.isConnected || p.panel.hidden || p.panel.closest('#v-study[hidden]')) return;
    const a = au(), el = audioEl();
    const same = fullLecture(p.id, a);
    const matches = same && a.ready && a.media_id === p.mediaId;
    if (p.follow && matches && el && !a.restoring && !el.seeking) {
      const time = typeof audioTimelinePosition === 'function' ? audioTimelinePosition(a) : el.currentTime;
      if (Number.isFinite(time)) {
        let low = 0, high = p.cues.length;
        while (low < high) {
          const middle = (low + high) >> 1;
          if (p.cues[middle].start <= time) low = middle + 1;
          else high = middle;
        }
        showSlide(p, low ? p.cues[low - 1].index : p.video ? null : 0);
      }
    }
    const note = !p.cues.length ? 'Листай слайды вручную. Привязки к записи пока нет.'
      : !p.follow ? 'Ручной просмотр. Включи «Листать по аудио», чтобы вернуться к текущему слайду.'
      : !same ? 'Включи полную запись этой лекции, чтобы слайды листались автоматически.'
      : a.error ? 'Пока запись не играет, можно листать слайды вручную.'
      : !a.ready || a.restoring ? 'Подключаю слайды к записи…'
      : !matches ? 'Запись изменилась. Слайды можно листать вручную.'
      : p.video ? 'Слайды переключаются по кадрам записи.'
      : p.partial ? 'Автоматически переключаются слайды, для которых найдены моменты в записи.'
      : 'Слайды листаются по ходу записи.';
    if (p.status.textContent !== note) p.status.textContent = note;
  }

  async function loadPresentation(p) {
    p.retry.hidden = true;
    p.status.textContent = 'Загружаю презентацию…';
    try {
      const data = await get('presentation?lecture_id=' + p.id);
      if (presentation !== p || !p.panel.isConnected) return;
      p.pages = Array.isArray(data.pages) ? data.pages.filter(page => Number.isSafeInteger(page) && page > 0) : [];
      if (!p.pages.length) {
        p.status.textContent = 'К этой лекции пока нет презентации.';
        return;
      }
      const pageIndices = new Map(p.pages.map((page, i) => [page, i]));
      p.mediaId = data.media_id;
      p.video = data.timing === 'video';
      if (p.video) pageIndices.set(null, null);
      p.cues = p.mediaId ? (data.cues || []).filter(c => pageIndices.has(c.page) && Number.isFinite(c.start) && c.start >= 0)
        .map(c => ({index: pageIndices.get(c.page), start: c.start})).sort((x, y) => x.start - y.start) : [];
      p.partial = data.status === 'partial';
      p.follow = p.cues.length > 0;
      p.followButton.hidden = !p.follow;
      p.followButton.setAttribute('aria-pressed', String(p.follow));
      p.content.hidden = false;
      presentationSync();
      if (p.index === -1) showSlide(p, 0);
    } catch (_) {
      if (presentation !== p || !p.panel.isConnected) return;
      p.status.textContent = 'Не получилось открыть презентацию. Попробуй ещё раз.';
      p.retry.hidden = false;
    }
  }

  function closePresentation(p) {
    presentation = null;
    p.panel.hidden = true;
    p.button.setAttribute('aria-expanded', 'false');
    p.button.focus();
  }

  function openPresentation(button) {
    const id = Number(button.dataset.presentationOpen);
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel || !Number.isSafeInteger(id) || id < 1) return;
    if (presentation?.panel === panel) { closePresentation(presentation); return; }
    panel.innerHTML = presentationHtml(id);
    const query = name => panel.querySelector(`[data-presentation-${name}]`);
    const action = name => panel.querySelector(`[data-presentation-action="${name}"]`);
    const p = presentation = {id, panel, button, index: -1, pages: [],
      content: query('content'), status: query('status'), image: query('image'), imageError: query('image-error'),
      full: query('full'), count: query('count'), blank: query('blank'), retry: action('retry'),
      followButton: action('follow'), prev: action('prev'), next: action('next')};
    p.content.hidden = true;
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    panel.querySelector('h3').focus({preventScroll: true});
    panel.scrollIntoView?.({block: 'start'});

    // Запись продолжает вести штатный плеер. Слайды только читают его время.
    const a = au(), el = audioEl();
    if (fullLecture(id, a) && a.ready && (frozen(id) || a.stalled) && typeof audioRecoverPlay === 'function') rescue(a, el);
    else if (!(fullLecture(id, a) && (a.ready && el && !el.paused && !el.ended || a.loading && a.shouldPlay))) audioOpen(id, true);
    loadPresentation(p);
  }

  function presentationAction(button) {
    const p = presentation;
    if (!p?.panel.contains(button)) return;
    const action = button.dataset.presentationAction;
    if (action === 'close') { closePresentation(p); return; }
    if (action === 'retry') { loadPresentation(p); return; }
    if (action === 'reload') {
      p.imageError.hidden = true;
      p.image.removeAttribute('src');
      p.image.src = p.full.href;
      return;
    }
    p.follow = action === 'follow' && !p.follow;
    p.followButton.setAttribute('aria-pressed', String(p.follow));
    if (action === 'prev' || action === 'next') showSlide(p, p.index === null ? 0 : p.index + (action === 'prev' ? -1 : 1));
    presentationSync();
  }

  function position(a, el) {
    let now = el?.currentTime || 0, total = el?.duration;
    try { if (typeof audioTimelinePosition === 'function') now = audioTimelinePosition(a); } catch (_) {}
    try { if (typeof audioTimelineDuration === 'function') total = audioTimelineDuration(a); } catch (_) {}
    if (!Number.isFinite(total) || total <= 0) total = Number(a?.duration) || 0;
    return {now: Number.isFinite(now) ? now : 0, total};
  }
  let lastText = '';
  function paint() {
    const a = au(), el = audioEl();
    const current = Number(a?.lecture_id) || 0;
    const stuck = frozen(current) || !!a?.stalled;
    const playing = !!(current && el && !el.paused && !el.ended) && !stuck;
    const loading = !!(current && a?.loading);
    const time = current && a?.ready ? position(a, el) : null;
    const text = time ? `${fmt(time.now)}${time.total ? ' / ' + fmt(time.total) : ''}` : '';
    document.querySelectorAll('.psu-vinyl').forEach(v => {
      const own = v.dataset.vinylLecture === 'current' ? current > 0 : Number(v.dataset.vinylLecture) === current;
      v.classList.toggle('is-playing', own && playing);
      v.classList.toggle('is-loading', own && loading && !playing && !stuck);
      v.classList.toggle('is-stuck', own && stuck);
      v.querySelector('[data-vinyl-toggle]')?.setAttribute('aria-pressed', String(own && playing));
      const clock = v.querySelector('[data-vinyl-time]');
      if (clock) clock.textContent = own ? text : '';
      const safari = v.querySelector('[data-vinyl-safari]');
      if (safari) {
        const href = own && stuck && watch.rescues > 0 && standalone() ? safariHref() : '';
        safari.hidden = !href;
        if (href) safari.setAttribute('href', href);
      }
      const state = v.querySelector('[data-vinyl-state]');
      if (state) {
        const heard = Number(v.dataset.vinylHeard) || 0;
        state.textContent = own && stuck ? NOTES[watch.rescues > 0 ? 1 : 0]
          : own && playing ? 'Играет. Нажми, чтобы поставить на паузу'
          : own && loading ? 'Открываю запись…'
          : own && a?.ready ? 'Пауза. Нажми на пластинку, чтобы продолжить'
          : heard ? `Прослушано ${heard} мин. Нажми на пластинку, чтобы продолжить` : 'Нажми на пластинку, чтобы слушать';
      }
      if (v.dataset.vinylLecture === 'current') {
        const number = v.querySelector('[data-vinyl-number]'), want = current ? chapter(a?.title).number : 'Ψ';
        if (number && number.textContent !== want) number.textContent = want;
      }
    });
    lastText = text;
  }
  let tick = 0;
  function onTime() {
    const now = Date.now();
    if (now - tick < 450) return;
    tick = now;
    paint();
  }

  function bind() {
    dock();
    const el = audioEl();
    if (el && !el.dataset.vinylBound) {
      // После замены плеера старый элемент ещё может прислать события.
      // Они не должны останавливать наблюдение за новой записью.
      const current = callback => event => { if (event.currentTarget === audioEl()) callback(event); };
      for (const type of ['play', 'playing', 'pause', 'ended', 'emptied', 'error', 'waiting', 'loadedmetadata', 'durationchange', 'seeked']) el.addEventListener(type, current(paint));
      el.addEventListener('timeupdate', current(onTime));
      el.addEventListener('play', current(() => { watch.time = Number(el.currentTime) || 0; watch.at = Date.now(); watchStart(); }));
      el.addEventListener('playing', current(watchStart));
      for (const type of ['pause', 'ended', 'emptied', 'error']) el.addEventListener(type, current(watchStop));
      el.dataset.vinylBound = '1';
    }
    paint();
  }
  document.addEventListener('click', event => {
    const hit = event.target instanceof Element ? event.target.closest('[data-vinyl-toggle], [data-presentation-open], [data-presentation-action]') : null;
    if (!hit || hit.disabled) return;
    event.preventDefault();
    if (hit.hasAttribute('data-presentation-open')) { openPresentation(hit); return; }
    if (hit.hasAttribute('data-presentation-action')) { presentationAction(hit); return; }
    toggle(hit.dataset.vinylToggle);
    setTimeout(paint, 60);
  });
  for (const type of ['timeupdate', 'loadedmetadata', 'seeked', 'playing', 'pause', 'loadstart', 'emptied', 'error']) {
    document.addEventListener(type, event => {
      if (event.target === audioEl()) presentationSync();
      if (type === 'error' && event.target === presentation?.image && presentation.index !== null) presentation.imageError.hidden = false;
    }, true);
  }
  // Страница перерисовывает лекцию целиком; новая пластинка сразу получает текущее состояние.
  if (typeof MutationObserver === 'function') {
    const view = document.getElementById('v-study');
    if (view) new MutationObserver(() => {
      if (presentation && !presentation.panel.isConnected) presentation = null;
      const fresh = view.querySelectorAll('.psu-vinyl:not([data-vinyl-painted])');
      if (fresh.length) {
        fresh.forEach(v => { v.dataset.vinylPainted = '1'; });
        paint();
      }
    }).observe(view, {childList: true, subtree: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once: true}); else bind();

  window.PSUVinyl = {lectureHtml, chapter, toggle, paint, bind, observe, syncPresentation: presentationSync, get text() { return lastText; }, get stuck() { return watch.stuck; }};
})();
