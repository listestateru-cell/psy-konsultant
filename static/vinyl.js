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

  // Конверт для страницы лекции.
  function lectureHtml(l) {
    const ch = chapter(l.title), colors = palette(l.subject);
    const heard = Math.floor((Number(l.heard_seconds) || 0) / 60);
    const label = `${ch.label}. ${ch.title}`;
    return `<section class="box lecture-vinyl" aria-label="Аудиолекция"><div class="psu-vinyl" data-vinyl-lecture="${Number(l.id)}" data-vinyl-heard="${heard}" style="--sleeve:${colors.sleeve};--sleeve-ink:${colors.ink};--accent:${colors.accent}">
<button class="vinyl-hit" type="button" data-vinyl-toggle="${Number(l.id)}" aria-pressed="false" aria-label="${esc('Слушать: ' + label)}"><span class="vinyl-sleeve"><span class="vinyl-back"></span>${record(ch.number)}<span class="vinyl-pocket"><span class="vinyl-sign" style="--sign:${Math.min(.084, .98 / Math.max(1, signature(l.teacher, l.subject).length)).toFixed(3)}">${esc(signature(l.teacher, l.subject))}</span><span class="vinyl-sticker"><small>${esc(initials(l.teacher) || 'PSU Hope')}</small><b>${esc(ch.label)}</b><small>${esc(l.subject || '')}</small></span></span></span></button>
<div class="vinyl-caption"><span class="vinyl-state" data-vinyl-state>${heard ? `Прослушано ${heard} мин. Нажми на пластинку, чтобы продолжить` : 'Нажми на пластинку, чтобы слушать'}</span><b class="vinyl-time" data-vinyl-time></b><button class="vinyl-study" type="button" onclick="audioStudy(${Number(l.id)},${Number(l.subject_id) || 0})">Слушать с вопросами по прослушанному</button></div>
</div></section>`;
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

  function toggle(target) {
    const a = au(), el = audioEl();
    const id = target === 'current' ? Number(a?.lecture_id) : Number(target);
    if (!Number.isSafeInteger(id) || id < 1) return;
    if (a && a.lecture_id === id && a.ready && el && !el.paused) { el.pause(); return; }
    if (a && a.lecture_id === id && a.ready && typeof audioResume === 'function') { audioResume(); return; }
    if (typeof audioOpen === 'function') audioOpen(id, true);
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
    const playing = !!(current && el && !el.paused && !el.ended);
    const loading = !!(current && a?.loading);
    const time = current && a?.ready ? position(a, el) : null;
    const text = time ? `${fmt(time.now)}${time.total ? ' / ' + fmt(time.total) : ''}` : '';
    document.querySelectorAll('.psu-vinyl').forEach(v => {
      const own = v.dataset.vinylLecture === 'current' ? current > 0 : Number(v.dataset.vinylLecture) === current;
      v.classList.toggle('is-playing', own && playing);
      v.classList.toggle('is-loading', own && loading && !playing);
      v.querySelector('[data-vinyl-toggle]')?.setAttribute('aria-pressed', String(own && playing));
      const clock = v.querySelector('[data-vinyl-time]');
      if (clock) clock.textContent = own ? text : '';
      const state = v.querySelector('[data-vinyl-state]');
      if (state) {
        const heard = Number(v.dataset.vinylHeard) || 0;
        state.textContent = own && playing ? 'Играет. Нажми, чтобы поставить на паузу'
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
      for (const type of ['play', 'playing', 'pause', 'ended', 'emptied', 'error', 'waiting', 'loadedmetadata', 'durationchange', 'seeked']) el.addEventListener(type, paint);
      el.addEventListener('timeupdate', onTime);
      el.dataset.vinylBound = '1';
    }
    paint();
  }
  document.addEventListener('click', event => {
    const hit = event.target instanceof Element ? event.target.closest('[data-vinyl-toggle]') : null;
    if (!hit) return;
    event.preventDefault();
    toggle(hit.dataset.vinylToggle);
    setTimeout(paint, 60);
  });
  // Страница перерисовывает лекцию целиком; новая пластинка сразу получает текущее состояние.
  if (typeof MutationObserver === 'function') {
    const view = document.getElementById('v-study');
    if (view) new MutationObserver(() => { if (view.querySelector('.psu-vinyl:not([data-vinyl-painted])')) { view.querySelectorAll('.psu-vinyl').forEach(v => { v.dataset.vinylPainted = '1'; }); paint(); } }).observe(view, {childList: true, subtree: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once: true}); else bind();

  window.PSUVinyl = {lectureHtml, chapter, toggle, paint, bind, get text() { return lastText; }};
})();
