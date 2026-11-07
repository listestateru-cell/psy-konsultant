/* Reading controls only: never detach media, submit answers, or persist study state. */
(() => {
  'use strict';
  if (window.PSUHSlideAway) return;
  const entries = new Map();
  const labels = {audio: 'Плеер', card: 'Мой ответ', learn: 'Мой ответ', tutor: 'Вопрос тренеру'};
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let frame = 0;
  let serial = 0;
  let rail;
  const owned = element => { element.dataset.slideAwayOwned = 'true'; return element; };
  const icon = direction => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${direction === 'right' ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'}"/></svg>`;
  function domVisible(element) {
    if (!element?.isConnected) return false;
    for (let el = element; el; el = el.parentElement) if (el.hidden) return false;
    return true;
  }
  function locked(entry) {
    const panel = entry.panel;
    if (!panel) return false;
    if (panel.dataset.slideAwayLocked === 'true' || panel.closest('[data-recording="true"], [data-slide-away-locked="true"]')) return true;
    if (panel.hasAttribute('data-slide-away-locked') || panel.dataset.slideAwayLegacy !== 'true') return false;
    if (entry.key === 'card') {
      const mic = panel.querySelector('#card-mic');
      return !!mic && (mic.getAttribute('aria-pressed') === 'true' || mic.classList.contains('recording') ||
        mic.disabled && mic.textContent.includes('Открываю микрофон'));
    }
    if (entry.key === 'learn') {
      const mic = panel.querySelector('button[onclick*="learnRecord"]');
      return !!panel.querySelector('.learn-status.recording') || !!mic?.disabled &&
        mic.textContent.includes('Открываю микрофон');
    }
    if (entry.key === 'audio') return [...document.querySelectorAll('#card-mic[aria-pressed="true"], #card-mic.recording, .learn-check[data-recording="true"]')].some(domVisible);
    return false;
  }
  function markLegacy(panel, key, label) {
    panel.dataset.slideAway = key;
    panel.dataset.slideAwayLabel = label;
    panel.dataset.slideAwayLegacy = 'true';
  }
  function discoverLegacy() {
    // Old direct pages can receive the enhancement as static assets without restarting an import.
    const audio = document.getElementById('audio-dock');
    if (audio && !audio.hasAttribute('data-slide-away')) markLegacy(audio, 'audio', labels.audio);
    const answer = document.getElementById('txt'), act = document.getElementById('act');
    if (answer && act?.contains(answer) && !answer.closest('[data-slide-away]')) markLegacy(act, 'card', labels.card);
    const learnAnswer = document.getElementById('learn-answer');
    const check = learnAnswer?.closest('.learn-check');
    if (check && !learnAnswer.closest('[data-slide-away]')) {
      const label = check.querySelector('label[for="learn-answer"]');
      if (label?.parentElement === check && learnAnswer.parentElement === check) {
        const content = [];
        for (let node = label; node; node = node.nextSibling) {
          if (node.nodeType === 1 && node.matches('.learn-feedback, .learn-footer')) break;
          content.push(node);
        }
        if (content.includes(learnAnswer)) {
          const composer = owned(document.createElement('div'));
          markLegacy(composer, 'learn', 'Моё объяснение');
          label.before(composer);
          content.forEach(node => composer.append(node));
        }
      }
    }
    const question = document.getElementById('tuq');
    if (question && !question.closest('[data-slide-away]')) {
      const row = question.closest('.row');
      if (row?.closest('#tutor')) {
        const composer = owned(document.createElement('div'));
        markLegacy(composer, 'tutor', labels.tutor);
        row.before(composer);
        composer.append(row);
      }
    }
  }
  function syncLegacyAudioSpace() {
    const entry = entries.get('audio');
    if (!entry?.panel?.isConnected || entry.panel.dataset.slideAwayLegacy !== 'true') return;
    const visible = !entry.hidden && !entry.panel.hidden;
    document.body.classList.toggle('has-audio', visible);
    const space = visible ? `${Math.ceil(entry.panel.getBoundingClientRect().height)}px` : '0px';
    if (document.documentElement.style.getPropertyValue('--audio-space') !== space) document.documentElement.style.setProperty('--audio-space', space);
  }
  function active(entry) {
    if (!entry.panel?.isConnected || document.body.classList.contains('mobile-more-open')) return false;
    for (let el = entry.panel; el; el = el.parentElement) {
      if (el.hidden || (el !== entry.panel && el.getAttribute('aria-hidden') === 'true')) return false;
    }
    return true;
  }
  function announce(entry) {
    window.dispatchEvent(new CustomEvent('psuhope:slideaway', {detail: {id: entry.key, hidden: entry.hidden}}));
    syncLegacyAudioSpace();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(() => { frame = 0; refresh(); });
  }
  function makeButton(entry, restore = false) {
    const button = owned(document.createElement('button'));
    button.type = 'button';
    button.className = restore ? 'sa-restore' : 'sa-handle';
    button.innerHTML = restore ? icon('left') + '<span></span>' : '<span>Убрать вправо</span>' + icon('right');
    button.setAttribute(restore ? 'data-slide-away-show' : 'data-slide-away-hide', entry.key);
    button.addEventListener('click', event => {
      if (button._saSuppressUntil > performance.now() && event.detail !== 0) return;
      restore ? show(entry.key) : hide(entry.key);
    });
    gesture(button, entry, restore);
    return button;
  }
  function gesture(button, entry, restoring) {
    let drag;
    const clear = () => {
      if (!drag) return;
      const host = entry.fixed ? entry.panel : entry.shell;
      host?.classList.remove('sa-dragging');
      host?.style.removeProperty('--sa-drag');
      button.style.removeProperty('transform');
      drag = null;
    };
    button.addEventListener('pointerdown', event => {
      if (event.isPrimary === false || event.button > 0 || (!restoring && locked(entry))) return;
      // A dedicated handle keeps native audio, text selection and page back gestures untouched.
      drag = {id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false};
    });
    button.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.horizontal) {
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          button._saSuppressUntil = performance.now() + 500;
          clear(); return;
        }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        drag.horizontal = true;
        try { button.setPointerCapture(event.pointerId); } catch (_) {}
      }
      if (event.cancelable) event.preventDefault();
      const distance = Math.min(180, restoring ? Math.max(0, -dx) : Math.max(0, dx));
      if (restoring) button.style.transform = `translateX(${-Math.min(28, distance / 3)}px)`;
      else {
        const host = entry.fixed ? entry.panel : entry.shell;
        host?.classList.add('sa-dragging');
        host?.style.setProperty('--sa-drag', `${distance}px`);
      }
    });
    button.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const done = drag.horizontal && (restoring ? -dx : dx) >= 48;
      if (drag.horizontal) button._saSuppressUntil = performance.now() + 500;
      clear();
      if (done) restoring ? show(entry.key) : hide(entry.key);
    });
    button.addEventListener('pointercancel', clear);
    button.addEventListener('lostpointercapture', clear);
  }
  function ensureRail() {
    if (rail?.isConnected) return;
    rail = owned(document.createElement('div'));
    rail.className = 'sa-rail';
    rail.setAttribute('aria-label', 'Убранные панели');
    document.body.append(rail);
  }
  function connect(panel) {
    const key = panel.dataset.slideAway;
    if (!key) return;
    let entry = entries.get(key);
    if (!entry) {
      entry = {key, hidden: false, timer: null};
      entries.set(key, entry);
    }
    if (entry.panel !== panel) {
      clearTimeout(entry.timer);
      entry.timer = null;
      entry.localRestore?.remove();
      entry.panel = panel;
      entry.priorInert = panel.inert;
      entry.priorAria = panel.getAttribute('aria-hidden');
      entry.ownsA11y = false;
      entry.fixed = key === 'audio';
      entry.shell = null;
      entry.handle = null;
      entry.localRestore = null;
      if (!panel.id) panel.id = `slide-away-${key}-${++serial}`;
      panel.classList.add(entry.fixed ? 'sa-fixed' : 'sa-panel');
      if (!entry.fixed) {
        let shell = panel.parentElement;
        if (!shell?.classList.contains('sa-shell')) {
          shell = owned(document.createElement('div'));
          shell.className = 'sa-shell';
          panel.before(shell);
          shell.append(panel);
        }
        entry.shell = shell;
        entry.localRestore = makeButton(entry, true);
        entry.localRestore.classList.add('sa-inline-restore');
        shell.append(entry.localRestore);
      }
      if (!entry.railRestore?.isConnected) {
        ensureRail();
        entry.railRestore = makeButton(entry, true);
        rail.append(entry.railRestore);
      }
    }
    if (!entry.handle?.isConnected || entry.handle.parentElement !== panel) {
      entry.handle = makeButton(entry);
      panel.prepend(entry.handle);
    }
    entry.label = panel.dataset.slideAwayLabel || labels[key] || 'Панель';
    entry.handle.setAttribute('aria-label', `Убрать ${entry.label.toLowerCase()} вправо`);
    entry.handle.title = 'Убрать вправо кнопкой или смахиванием';
    entry.handle.setAttribute('aria-controls', panel.id);
    entry.handle.disabled = locked(entry);
    entry.handle.title = locked(entry) ? 'Сначала останови запись' : 'Убрать вправо кнопкой или смахиванием';
    for (const button of [entry.localRestore, entry.railRestore].filter(Boolean)) {
      const text = button.querySelector('span');
      if (text.textContent !== entry.label) text.textContent = entry.label;
      button.setAttribute('aria-label', `Вернуть ${entry.label.toLowerCase()}`);
      button.title = 'Вернуть панель кнопкой или смахиванием влево';
      button.setAttribute('aria-controls', panel.id);
      button.setAttribute('aria-expanded', String(!entry.hidden));
    }
    if (locked(entry) && entry.hidden) show(key, false);
    apply(entry);
  }
  function apply(entry) {
    const {panel, shell} = entry;
    if (!panel?.isConnected) return;
    const host = entry.fixed ? panel : shell;
    const waiting = !!entry.timer;
    host.classList.toggle('sa-tucked', entry.hidden && !waiting);
    host.classList.toggle('sa-leaving', entry.hidden);
    entry.handle?.setAttribute('aria-expanded', String(!entry.hidden));
    if (entry.hidden) {
      if (!entry.ownsA11y) {
        entry.priorInert = panel.inert;
        entry.priorAria = panel.getAttribute('aria-hidden');
        entry.ownsA11y = true;
      }
      panel.inert = true;
      panel.setAttribute('aria-hidden', 'true');
    } else if (entry.ownsA11y) {
      panel.inert = !!entry.priorInert;
      if (entry.priorAria === null) panel.removeAttribute('aria-hidden');
      else panel.setAttribute('aria-hidden', entry.priorAria);
      entry.ownsA11y = false;
    }
    updateRestore(entry);
  }
  function updateRestore(entry) {
    const visible = entry.hidden && active(entry);
    const local = entry.localRestore;
    if (local) local.hidden = !visible;
    let localVisible = false;
    if (visible && local) {
      const rect = local.getBoundingClientRect();
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop || 0;
      const bottom = top + (viewport?.height || window.innerHeight);
      localVisible = rect.height > 0 && rect.top >= top + 8 && rect.bottom < bottom - 100;
    }
    if (entry.railRestore) entry.railRestore.hidden = !visible || localVisible;
  }
  function refresh() {
    discoverLegacy();
    document.querySelectorAll('[data-slide-away]').forEach(connect);
    for (const entry of entries.values()) {
      if (!entry.panel?.isConnected) {
        clearTimeout(entry.timer);
        entry.timer = null;
        if (entry.railRestore) entry.railRestore.hidden = true;
        if (entry.shell?.isConnected) entry.shell.remove();
      } else updateRestore(entry);
    }
    if (rail) rail.hidden = ![...entries.values()].some(entry => entry.railRestore && !entry.railRestore.hidden);
    syncLegacyAudioSpace();
  }
  function hide(key) {
    const entry = entries.get(key);
    if (!entry?.panel?.isConnected || entry.hidden || locked(entry) || document.body.classList.contains('mobile-more-open')) return false;
    const focused = document.activeElement;
    if (entry.panel.contains(focused)) focused?.blur?.();
    entry.priorInert = entry.panel.inert;
    entry.priorAria = entry.panel.getAttribute('aria-hidden');
    entry.hidden = true;
    const duration = reduceMotion?.matches ? 0 : 190;
    entry.timer = setTimeout(() => {
      entry.timer = null;
      apply(entry);
      announce(entry);
      schedule();
    }, duration);
    apply(entry);
    announce(entry);
    refresh();
    const focusTarget = !entry.railRestore?.hidden ? entry.railRestore : entry.localRestore;
    focusTarget?.focus({preventScroll: true});
    return true;
  }
  function show(key, focus = true) {
    const entry = entries.get(key);
    if (!entry?.panel?.isConnected || !entry.hidden || document.body.classList.contains('mobile-more-open')) return false;
    clearTimeout(entry.timer);
    entry.timer = null;
    entry.hidden = false;
    apply(entry);
    announce(entry);
    refresh();
    // Restore the handle, never focus a textarea and unexpectedly reopen an iPhone keyboard.
    if (focus) {
      if (!entry.fixed && entry.shell) {
        const rect = entry.shell.getBoundingClientRect();
        const viewport = window.visualViewport;
        const top = viewport?.offsetTop || 0;
        const bottom = top + (viewport?.height || window.innerHeight);
        if (rect.top < top || rect.bottom > bottom) entry.shell.scrollIntoView?.({block: 'nearest', behavior: reduceMotion?.matches ? 'auto' : 'smooth'});
      }
      entry.handle?.focus({preventScroll: true});
    }
    return true;
  }
  window.PSUHSlideAway = {refresh, hide, show, isHidden: key => !!entries.get(key)?.hidden};
  new MutationObserver(records => {
    if (records.some(record => [...record.addedNodes, ...record.removedNodes]
      .some(node => node.nodeType !== 1 || node.dataset?.slideAwayOwned !== 'true'))) schedule();
  }).observe(document.body, {childList: true, subtree: true});
  window.addEventListener('resize', schedule, {passive: true});
  window.addEventListener('scroll', schedule, {passive: true});
  window.visualViewport?.addEventListener('resize', schedule, {passive: true});
  window.visualViewport?.addEventListener('scroll', schedule, {passive: true});
  refresh();
})();
