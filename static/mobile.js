/* Progressive enhancement only: navigation keeps the app's existing save guards. */
(() => {
  'use strict';
  if (window.FukushuMobile) return;
  const root = document.documentElement;
  const body = document.body;
  const enhancementSource = document.currentScript?.src;
  const narrow = window.matchMedia('(max-width: 767px), (max-width: 1023px) and (pointer: coarse)');
  const views = ['home', 'study', 'practice', 'glossary', 'stats', 'errors', 'dojo', 'search'];
  const nav = document.getElementById('mobile-nav');
  const more = document.getElementById('mobile-more');
  const moreToggle = document.getElementById('mobile-more-toggle');
  let frame = 0;
  let priorFocus = null;
  let inertBefore = [];
  let expandedAudio = false;
  let sectionSerial = 0;
  let observedAudio = null;
  let telegram = null;

  const icon = (path, extra = '') => `<svg ${extra} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  const chevron = icon('<path d="m7 10 5 5 5-5"/>', 'class="mobile-audio-chevron"');
  const editable = el => !!el && !el.readOnly && !el.disabled && (el.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),[contenteditable=true]'));
  const visibleView = () => views.find(name => {
    const element = document.getElementById(`v-${name}`);
    return element && !element.hidden;
  });

  function sync(name) {
    const active = views.includes(name) ? name : visibleView();
    document.querySelectorAll('[data-mobile-tab]').forEach(button => {
      const selected = button.dataset.mobileTab === active;
      button.classList.toggle('on', selected);
      if (selected) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    if (moreToggle) {
      const secondary = ['stats', 'errors', 'dojo', 'search'].includes(active);
      moreToggle.classList.toggle('on', secondary);
      if (secondary) moreToggle.setAttribute('aria-current', 'page');
      else moreToggle.removeAttribute('aria-current');
    }
    if (active) body.dataset.mobileView = active;
  }

  function closeMore(restoreFocus = true) {
    if (!more || more.hidden) return;
    more.hidden = true;
    if (moreToggle) moreToggle.setAttribute('aria-expanded', 'false');
    inertBefore.forEach(([element, previous]) => { element.inert = previous; });
    inertBefore = [];
    body.classList.remove('mobile-more-open');
    if (restoreFocus && priorFocus?.isConnected) priorFocus.focus({preventScroll: true});
    priorFocus = null;
  }

  function openMore() {
    if (!narrow.matches || !more || !more.hidden) return;
    priorFocus = document.activeElement;
    more.hidden = false;
    if (moreToggle) moreToggle.setAttribute('aria-expanded', 'true');
    inertBefore = [document.querySelector('main'), nav, document.getElementById('audio-dock'), document.getElementById('tutor')]
      .filter(Boolean).map(element => [element, element.inert]);
    inertBefore.forEach(([element]) => { element.inert = true; });
    body.classList.add('mobile-more-open');
    document.getElementById('mobile-more-close')?.focus({preventScroll: true});
  }

  // iOS 26: панель с position: fixed у нижнего края при прокрутке всей страницы
  // уезжает вверх и повисает посреди экрана (WebKit 297779 и соседние отчёты).
  // На iPhone и iPad прокручивается только main, а страница стоит, поэтому меню
  // и плеер держатся у края. Код страницы зовёт window.scrollTo и читает
  // window.scrollY: в этом режиме оба вызова уходят в main.
  const device = typeof navigator === 'undefined' ? {} : navigator;
  const appleTouch = /iP(hone|ad|od)/.test(`${device.platform || ''} ${device.userAgent || ''}`)
    || (device.platform === 'MacIntel' && device.maxTouchPoints > 1);
  const nativeScrollTo = typeof window.scrollTo === 'function' ? window.scrollTo.bind(window) : null;
  let shellForced = null;
  let shellOn = false;
  let shellBridged = false;
  let shellForwarded = null;
  const pageScroller = () => document.scrollingElement || document.documentElement;
  const shellMain = () => (shellOn ? document.querySelector('main') : null);

  function bridgeShellScroll() {
    if (shellBridged) return;
    shellBridged = true;
    window.scrollTo = function scrollTo(x, y) {
      const main = shellMain();
      if (!main) return nativeScrollTo ? nativeScrollTo(...arguments) : undefined;
      const target = x && typeof x === 'object' ? x : {left: Number(x) || 0, top: Number(y) || 0};
      if (typeof main.scrollTo === 'function') main.scrollTo(target);
      else if (Number.isFinite(target.top)) main.scrollTop = target.top;
    };
    for (const name of ['scrollY', 'pageYOffset']) {
      let owner = window, descriptor;
      while (owner && !(descriptor = Object.getOwnPropertyDescriptor(owner, name))) owner = Object.getPrototypeOf(owner);
      if (descriptor && descriptor.configurable === false) continue;
      const native = descriptor?.get ? () => descriptor.get.call(window) : () => Number(pageScroller()?.scrollTop) || 0;
      try {
        Object.defineProperty(window, name, {
          configurable: true, enumerable: true,
          get: () => { const main = shellMain(); return main ? Number(main.scrollTop) || 0 : native(); },
          set: () => {},
        });
      } catch (_) { /* Свойство не переопределяется: позиция читается как раньше. */ }
    }
  }

  function updateScrollShell(keyboard) {
    const main = document.querySelector('main');
    const wanted = !!main && narrow.matches && (shellForced ?? appleTouch);
    if (wanted !== shellOn) {
      const scroller = pageScroller();
      if (wanted) {
        bridgeShellScroll();
        const top = Number(scroller?.scrollTop) || 0;
        shellOn = true;
        root.classList.add('mobile-scroll-shell');
        if (top) { main.scrollTop = top; nativeScrollTo?.(0, 0); }
        if (shellForwarded !== main && typeof main.addEventListener === 'function') {
          shellForwarded = main;
          // Слушатели window.scroll (панели slide-away и другие) получают прокрутку main.
          main.addEventListener('scroll', () => {
            if (shellOn && typeof window.dispatchEvent === 'function' && typeof Event === 'function') window.dispatchEvent(new Event('scroll'));
          }, {passive: true});
        }
      } else {
        const top = Number(main?.scrollTop) || 0;
        shellOn = false;
        root.classList.remove('mobile-scroll-shell');
        if (top) nativeScrollTo?.(0, top);
      }
    }
    // Клавиатура могла сдвинуть неподвижную страницу. Поле закрыто — ставим её на место.
    if (shellOn && !keyboard && !editable(document.activeElement)) {
      const scroller = pageScroller();
      const zoomed = (window.visualViewport?.scale || 1) > 1.01;
      if (!zoomed && scroller && (Number(scroller.scrollTop) || Number(scroller.scrollLeft))) nativeScrollTo?.(0, 0);
    }
  }

  function updateViewport() {
    const viewport = window.visualViewport;
    const height = viewport ? viewport.height : window.innerHeight;
    root.style.setProperty('--mobile-visible-height', `${Math.round(height)}px`);
    const layoutHeight = document.documentElement.clientHeight || window.innerHeight;
    const obscured = viewport ? Math.max(0, layoutHeight - viewport.height - viewport.offsetTop) : 0;
    const keyboard = narrow.matches && editable(document.activeElement) && obscured > 120 && (!viewport || viewport.scale < 1.2);
    if (keyboard) expandedAudio = false;
    body.classList.toggle('mobile-keyboard-open', keyboard);
    root.style.setProperty('--mobile-keyboard-offset', keyboard ? `${Math.round(obscured)}px` : '0px');
    updateScrollShell(keyboard);
    body.dataset.mobile = narrow.matches ? 'true' : 'false';
    if (!narrow.matches) closeMore(false);
  }

  function enhanceAudio() {
    const dock = document.getElementById('audio-dock');
    const audio = document.getElementById('lecture-audio');
    if (!dock || !audio) return;
    let toggle = dock.querySelector('.mobile-audio-toggle');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'mobile-audio-toggle';
      toggle.setAttribute('aria-label', 'Показать настройки аудиолекции');
      toggle.innerHTML = '<span></span>' + chevron;
      toggle.setAttribute('aria-controls', 'lecture-audio search-reading-slot audio-position audio-learning-progress audio-questions audio-sections audio-speed audio-status');
      dock.prepend(toggle);
      toggle.addEventListener('click', () => {
        toggle.focus({preventScroll: true});
        expandedAudio = !expandedAudio;
        refresh();
      });
    }
    const title = document.getElementById('audio-title')?.textContent || 'Аудиолекция';
    const label = toggle.querySelector('span');
    if (label.textContent !== title) label.textContent = title;
    toggle.setAttribute('aria-expanded', String(expandedAudio));
    toggle.setAttribute('aria-label', `${expandedAudio ? 'Свернуть' : 'Развернуть'} аудиолекцию: ${title}`);
    toggle.setAttribute('title', title);
    dock.classList.toggle('mobile-audio-collapsed', !expandedAudio);
    dock.classList.toggle('mobile-audio-ready', !audio.hidden);
    if (observedAudio !== dock && typeof ResizeObserver !== 'undefined') {
      observedAudio = dock;
      new ResizeObserver(() => {
        const tucked = window.PSUHSlideAway?.isHidden?.('audio');
        const space = dock.hidden || tucked ? 0 : Math.ceil(dock.getBoundingClientRect().height);
        root.style.setProperty('--audio-space', `${space}px`);
      }).observe(dock);
    }
  }

  function enhanceContent() {
    document.querySelectorAll('button[onclick^="audioStudy("]').forEach(button => {
      button.closest('.row')?.classList.add('mobile-lecture-row');
    });
    document.querySelectorAll('.learn-layout').forEach(layout => {
      const sections = layout.querySelector('.learn-sections');
      if (!sections || layout.querySelector('.mobile-section-toggle')) return;
      if (!sections.id) sections.id = `mobile-sections-${++sectionSerial}`;
      const choices = [...sections.querySelectorAll('.learn-section')];
      const current = choices.findIndex(button => button.getAttribute('aria-current') === 'step') + 1;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mobile-section-toggle';
      button.setAttribute('aria-expanded', 'false');
      button.setAttribute('aria-controls', sections.id);
      button.innerHTML = `<span>Разделы лекции<br><small>${current || 1} из ${choices.length}</small></span>${chevron}`;
      sections.before(button);
      button.addEventListener('click', () => {
        const opened = layout.classList.toggle('mobile-sections-open');
        button.setAttribute('aria-expanded', String(opened));
      });
    });
    document.querySelectorAll('table.tk').forEach(table => {
      const labels = [...table.querySelectorAll('tr:first-child th')].map(th => th.textContent.trim());
      table.querySelectorAll('tr:not(:first-child)').forEach(row => {
        [...row.children].forEach((cell, index) => {
          if (cell.dataset.mobileLabel !== labels[index]) cell.dataset.mobileLabel = labels[index] || '';
        });
      });
    });
  }

  function refresh() {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      updateViewport();
      enhanceAudio();
      enhanceContent();
      sync();
    });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-mobile-tab], [data-mobile-close], #mobile-more-toggle, #mobile-more-close');
    if (!target) return;
    if (target.matches('[data-mobile-close], #mobile-more-close')) { closeMore(); return; }
    if (target === moreToggle) { more.hidden ? openMore() : closeMore(); return; }
    const name = target.dataset.mobileTab;
    if (!views.includes(name)) return;
    closeMore();
    // Never call study loaders directly: tab() may need to save a practice draft first.
    if (typeof window.FukushuNavigate === 'function') Promise.resolve(window.FukushuNavigate(name)).then(refresh, refresh);
    else document.querySelector(`#desktop-nav button[data-t="${name}"]`)?.click();
  });
  document.addEventListener('keydown', event => {
    if (!more || more.hidden) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMore(); return; }
    if (event.key !== 'Tab') return;
    const panel = more.querySelector('.mobile-more-panel');
    const buttons = [...panel.querySelectorAll('button:not(:disabled),[href],input,select,textarea,[tabindex="0"]')].filter(element => !element.hidden);
    const first = buttons[0], last = buttons[buttons.length - 1];
    if (!first) return;
    if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
  });
  document.addEventListener('focusin', event => {
    const target = event.target || document.activeElement;
    if (editable(target) && !document.getElementById('audio-dock')?.contains(target)) expandedAudio = false;
    refresh();
  });
  document.addEventListener('focusout', () => { refresh(); setTimeout(refresh, 180); });
  window.addEventListener('psuhope:slideaway', refresh);
  window.addEventListener('resize', refresh, {passive: true});
  window.addEventListener('orientationchange', refresh, {passive: true});
  window.visualViewport?.addEventListener('resize', refresh, {passive: true});
  window.visualViewport?.addEventListener('scroll', refresh, {passive: true});
  if (narrow.addEventListener) narrow.addEventListener('change', refresh);
  else narrow.addListener(refresh);
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(refresh).observe(body, {subtree: true, childList: true, attributes: true, attributeFilter: ['hidden']});
  }

  function telegramInsets() {
    if (!telegram) return;
    const safe = telegram.safeAreaInset || {};
    const content = telegram.contentSafeAreaInset || {};
    for (const edge of ['top', 'bottom']) {
      const inset = Math.max(0, Number(safe[edge]) || 0) + Math.max(0, Number(content[edge]) || 0);
      root.style.setProperty(`--mobile-safe-${edge}`, `max(env(safe-area-inset-${edge}, 0px), ${inset}px)`);
    }
    refresh();
  }
  function telegramTheme() {
    if (telegram && ['light', 'dark'].includes(telegram.colorScheme)) {
      root.dataset.theme = telegram.colorScheme;
    }
  }
  try {
    telegram = window.Telegram?.WebApp;
    if (telegram && telegram.platform && telegram.platform !== 'unknown') {
      body.dataset.platform = 'telegram';
      telegram.ready?.();
      if (narrow.matches) telegram.expand?.();
      telegram.onEvent?.('viewportChanged', telegramInsets);
      telegram.onEvent?.('safeAreaChanged', telegramInsets);
      telegram.onEvent?.('contentSafeAreaChanged', telegramInsets);
      telegram.onEvent?.('themeChanged', telegramTheme);
      telegramTheme();
      telegramInsets();
    }
  } catch (_) { /* Plain web and older Telegram versions use CSS safe areas. */ }
  function setAudioExpanded(value) {
    expandedAudio = !!value;
    refresh();
  }
  // scrollShell(true | false | null): включить, выключить или вернуть автоопределение iOS.
  function scrollShell(value) {
    shellForced = value === null || value === undefined ? null : !!value;
    refresh();
  }
  window.FukushuMobile = {refresh, sync, closeMore, setAudioExpanded, scrollShell};
  refresh();
  // Быстрый показ обзора и оглавлений из прошлого ответа (static/fast.js), на обоих входах.
  if (enhancementSource && !window.PSUFast && !document.querySelector('script[src*="/fast.js"]')) {
    const fast = document.createElement('script');
    fast.src = new URL('fast.js?v=fast-20261109', enhancementSource).href;
    fast.async = false;
    document.head.append(fast);
  }
  // Existing direct pages can receive this optional UI without restarting an import.
  if (enhancementSource && !document.querySelector('script[src*="/bloom-canvas.js"]')) {
    const painter = document.createElement('script');
    painter.src = new URL('bloom-canvas.js?v=bloom-detail-20261108', enhancementSource).href;
    painter.async = false;
    painter.onload = () => window.PSUHBloom?.refresh?.();
    document.body.append(painter);
  }
  if (enhancementSource) for (const [name, version] of [
    ['slide-away', 'slide-away-20261107'], ['bloom-garden', 'bloom-shapes-20261107']
  ]) {
    if (document.querySelector(`script[src*="/${name}.js"]`)) continue;
    const asset = suffix => new URL(`${name}.${suffix}?v=${version}`, enhancementSource).href;
    if (!document.querySelector(`link[href*="/${name}.css"]`)) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = asset('css');
      document.head.append(style);
    }
    const controller = document.createElement('script');
    controller.src = asset('js');
    controller.defer = true;
    document.body.append(controller);
  }
  // Полка дисциплин для прямой страницы, чей PAGE ещё в памяти процесса до перезапуска.
  // В новой странице есть homeShelf и свой тег bookshelf.js — тогда мост ничего не делает.
  function shelfBridge() {
    const original = window.loadHome;
    if (typeof original !== 'function' || original.psuShelfBridge || !window.PSUBookshelf) return;
    const subjects = () => { try { return typeof SUBJ !== 'undefined' && Array.isArray(SUBJ) ? SUBJ : []; } catch (_) { return []; } };
    const action = (id, name) => {
      const subject = subjects().find(item => item.id === Number(id));
      if (!subject) return;
      if (name === 'study' && subject.cards) return startSession('due', subject.id, 0);
      if (name === 'terms' && subject.terms) return startSession('due', subject.id, 1);
      if (name === 'lectures') return pickLecture(subject.id);
      if (name === 'stats') return openStats(subject.id);
    };
    const mount = () => {
      const grid = document.querySelector('#v-home .subject-grid');
      if (!grid) return;
      const title = document.getElementById('home-subjects-title');
      if (title) title.textContent = 'Моя полка';
      const shelf = document.createElement('div');
      shelf.id = 'bookshelf';
      grid.replaceWith(shelf);
      window.PSUBookshelf.render(shelf, subjects(), {action});
    };
    const patched = async function (...args) { const result = await original.apply(this, args); mount(); return result; };
    patched.psuShelfBridge = true;
    window.loadHome = patched;
    mount();
  }
  if (enhancementSource && typeof window.homeShelf !== 'function' && !document.querySelector('script[src*="/bookshelf.js"]')) {
    if (!document.querySelector('link[href*="/bookshelf.css"]')) {
      const style = document.createElement('link');
      style.rel = 'stylesheet';
      style.href = new URL('bookshelf.css?v=bookshelf-20261109c', enhancementSource).href;
      document.head.append(style);
    }
    const shelf = document.createElement('script');
    shelf.src = new URL('bookshelf.js?v=bookshelf-20261109b', enhancementSource).href;
    shelf.async = false;
    shelf.onload = shelfBridge;
    document.body.append(shelf);
  }
})();
