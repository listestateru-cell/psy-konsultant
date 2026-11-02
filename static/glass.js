/* The glass rail only changes layout. App navigation keeps its save guards. */
(() => {
  'use strict';
  const toggle = document.getElementById('rail-toggle');
  const rail = document.getElementById('desktop-nav');
  if (!toggle || !rail) return;
  const preference = 'psu.glass.nav.expanded';
  let expanded = false;
  try { expanded = localStorage.getItem(preference) === '1'; } catch (_) {}

  function draw(remember = false) {
    document.body.classList.toggle('glass-nav-expanded', expanded);
    toggle.setAttribute('aria-expanded', String(expanded));
    const label = expanded ? 'Свернуть меню' : 'Развернуть меню';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    const text = toggle.querySelector('.rail-label');
    if (text) text.textContent = label;
    if (remember) try { localStorage.setItem(preference, expanded ? '1' : '0'); } catch (_) {}
  }

  toggle.addEventListener('click', () => { expanded = !expanded; draw(true); });
  rail.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !expanded) return;
    expanded = false;
    draw(true);
    toggle.focus({preventScroll: true});
    event.stopPropagation();
  });
  draw();
})();
