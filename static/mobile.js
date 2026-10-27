/* Progressive enhancement only: navigation keeps the app's existing save guards. */
(() => {
  'use strict';
  if (window.FukushuMobile) return;
  const root = document.documentElement;
  const body = document.body;
  const narrow = window.matchMedia('(max-width: 767px), (max-width: 1023px) and (pointer: coarse)');
  const views = ['home', 'study', 'practice', 'glossary', 'stats', 'errors', 'dojo'];
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
  const editable = el => !!el && (el.matches('textarea,input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]),[contenteditable=true]'));
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
      const secondary = ['stats', 'errors', 'dojo'].includes(active);
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
      toggle.setAttribute('aria-controls', 'lecture-audio audio-position audio-learning-progress audio-questions audio-sections audio-speed audio-status');
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
        const space = dock.hidden ? 0 : Math.ceil(dock.getBoundingClientRect().height);
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
  window.FukushuMobile = {refresh, sync, closeMore};
  refresh();
})();
