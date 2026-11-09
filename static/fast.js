/* PSU Hope · быстрый показ.
   Обзор дисциплин и оглавления лекций показываются сразу из прошлого ответа,
   свежий ответ приходит в фоне и тихо обновляет полку или оглавление, если
   что-то изменилось. Кэшируются только успешные GET этих двух адресов; ответы,
   занятия, аудио и остальные запросы идут в сеть как раньше. */
(() => {
  'use strict';
  if (window.PSUFast || typeof window.fetch !== 'function' || typeof Response !== 'function') return;
  const PATTERN = /^(.*\/api\/[^/?#]+\/)(overview|lectures)(\?subject=\d+)?$/;
  const PREFIX = 'psuh.fast.';
  const MAX_AGE = 3 * 24 * 3600 * 1000;  // старше трёх суток — только сеть
  const QUIET = 15000;                   // свежее 15 секунд — повторно не спрашиваем
  const memory = new Map();
  const original = window.fetch.bind(window);

  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }
  function keyOf(url) {
    const m = String(url).match(PATTERN);
    return m ? `${hash(m[1])}.${m[2]}${m[3] || ''}` : null;
  }
  function read(key) {
    if (memory.has(key)) return memory.get(key);
    try {
      const raw = JSON.parse(localStorage.getItem(PREFIX + key) || 'null');
      if (raw && typeof raw.text === 'string' && Date.now() - raw.at < MAX_AGE) { memory.set(key, raw); return raw; }
    } catch (_) {}
    return null;
  }
  function write(key, text) {
    const entry = {at: Date.now(), text};
    memory.set(key, entry);
    try { localStorage.setItem(PREFIX + key, JSON.stringify(entry)); } catch (_) {}
  }

  // Свежие данные пришли и отличаются — обновляем то, что сейчас на экране.
  function changed(key, text) {
    let data;
    try { data = JSON.parse(text); } catch (_) { return; }
    try {
      if (key.endsWith('.overview') && Array.isArray(data.subjects) && !document.getElementById('v-home')?.hidden
          && typeof homeShelf === 'function' && typeof homeDisplaySubjects === 'function' && !document.querySelector('.psu-reader.is-closing')) {
        SUBJ = homeDisplaySubjects(data).subjects;
        homeShelf();
      }
      const subject = key.match(/\.lectures\?subject=(\d+)$/);
      if (subject && typeof pickLecture === 'function' && typeof LECTURE_LIBRARY !== 'undefined'
          && LECTURE_LIBRARY.subject === Number(subject[1]) && !document.getElementById('lecture-search')?.value
          && document.querySelector('#v-study:not([hidden]) .lecture-list')) {
        pickLecture(Number(subject[1]), true);
      }
    } catch (_) {}
  }

  function network(input, init, key) {
    return original(input, init).then(response => {
      if (response.ok) {
        response.clone().text().then(text => {
          const previous = memory.get(key)?.text;
          write(key, text);
          if (previous != null && previous !== text) changed(key, text);
        }).catch(() => {});
      }
      return response;
    });
  }

  window.fetch = function (input, init) {
    const url = typeof input === 'string' ? input : input?.url;
    const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
    const key = method === 'GET' && url ? keyOf(url) : null;
    if (!key) return original(input, init);
    const hit = read(key);
    if (!hit) return network(input, init, key);
    if (Date.now() - hit.at > QUIET) network(input, init, key).catch(() => {});
    return Promise.resolve(new Response(hit.text, {status: 200, headers: {'Content-Type': 'application/json'}}));
  };

  window.PSUFast = {
    clear() { memory.clear(); try { Object.keys(localStorage).filter(k => k.startsWith(PREFIX)).forEach(k => localStorage.removeItem(k)); } catch (_) {} },
  };
})();
