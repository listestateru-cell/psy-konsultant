/* PSU Hope · Полка дисциплин.
   Каждая дисциплина — книга. На полке виден корешок; нажатие выдвигает книгу
   обложкой вперёд, следующее открывает её на оглавлении: Учить, Термины,
   Лекции, Статистика. Обложки рисуются кодом в духе гравюры, у каждой
   дисциплины свой сюжет. Модуль только рисует и зовёт handlers.action:
   без сети, фоновых таймеров и записи прогресса. */
(() => {
  'use strict';
  if (window.PSUBookshelf) return;

  const TAU = Math.PI * 2;
  const STORE = 'psuh.shelf.selected';
  const PAPER = '#f4ecdb', PAPER_INK = '#3a322a';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const f = n => Math.round(n * 10) / 10;
  const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.round(n) : 0; };
  let uidSeq = 0;

  function hash(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = hash(String(seed)) || 1;
    return () => {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function plural(n, forms) {
    const a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? forms[2] : b === 1 ? forms[0] : b >= 2 && b <= 4 ? forms[1] : forms[2];
  }
  const LECTURES = ['лекция', 'лекции', 'лекций'];
  const CARDS = ['карточка', 'карточки', 'карточек'];
  const TERMS = ['термин', 'термина', 'терминов'];
  const count = (n, forms) => `${n} ${plural(n, forms)}`;
  const reducedMotion = () => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch (_) { return false; } };

  // ---------- гравюрные приёмы ----------
  function hatch(id, angle, gap, width, color, opacity = 1) {
    return `<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><path d="M${f(gap / 2)} 0V${gap}" stroke="${color}" stroke-width="${width}" stroke-opacity="${opacity}"/></pattern>`;
  }
  const pathOf = pts => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L');
  function cubic(P, steps) {
    const out = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, v = 1 - u;
      out.push([0, 1].map(k => v * v * v * P[0][k] + 3 * v * v * u * P[1][k] + 3 * v * u * u * P[2][k] + u * u * u * P[3][k]));
    }
    return out;
  }
  // Точка и направление на ломаной по длине дуги.
  function walker(pts) {
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const at = s => {
      let i = lens.findIndex(l => l >= s);
      if (i <= 0) i = i === 0 ? 1 : lens.length - 1;
      const u = (s - lens[i - 1]) / ((lens[i] - lens[i - 1]) || 1);
      const a = pts[i - 1], b = pts[i];
      return {x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, angle: Math.atan2(b[1] - a[1], b[0] - a[0])};
    };
    return {total: lens[lens.length - 1], at};
  }

  // Психофизиология: нейрон — дендриты, тело с ядром, аксон в миелине, синапсы.
  function neuron(r, t, id) {
    const ink = t.ink, out = [];
    const cx = 100, cy = 88;
    for (let k = 0; k < 4; k++) {
      const wave = [];
      for (let x = 0; x <= 200; x += 4) wave.push([x, 44 + k * 36 + Math.sin(x * .09 + k) * 3 + Math.sin(x * .31 + k * 2) * 1.6 + (r() - .5) * 1.4]);
      out.push(`<path d="${pathOf(wave)}" fill="none" stroke="${ink}" stroke-opacity=".14" stroke-width=".6"/>`);
    }
    out.push(`<circle cx="${cx}" cy="${cy}" r="34" fill="none" stroke="${ink}" stroke-opacity=".2" stroke-width=".5" stroke-dasharray="1.5 2.5"/>`,
      `<circle cx="${cx}" cy="${cy}" r="54" fill="none" stroke="${ink}" stroke-opacity=".1" stroke-width=".5"/>`);
    const tree = [];
    function branch(x, y, ang, len, w, depth) {
      const bend = (r() - .5) * .7;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      const mx = x + Math.cos(ang + bend) * len * .55, my = y + Math.sin(ang + bend) * len * .55;
      tree.push(`<path d="M${f(x)} ${f(y)}Q${f(mx)} ${f(my)} ${f(x2)} ${f(y2)}" stroke-width="${f(Math.max(.35, w))}"/>`);
      if (depth <= 0 || len < 5) {
        tree.push(`<circle cx="${f(x2)}" cy="${f(y2)}" r="${f(Math.max(.55, w * .8))}" fill="${ink}" stroke="none"/>`);
        return;
      }
      if (depth <= 2) for (let s = 1; s <= 3; s++) {
        const u = s / 4, px = x + (x2 - x) * u, py = y + (y2 - y) * u, sa = ang + (s % 2 ? 1.35 : -1.35);
        tree.push(`<path d="M${f(px)} ${f(py)}l${f(Math.cos(sa) * 2.2)} ${f(Math.sin(sa) * 2.2)}" stroke-width=".45"/>`);
      }
      const n = depth > 1 && r() < .3 ? 3 : 2;
      for (let i = 0; i < n; i++) branch(x2, y2, ang + (i - (n - 1) / 2) * (.6 + r() * .4) + (r() - .5) * .3, len * (.58 + r() * .2), w * .62, depth - 1);
    }
    [-2.85, -2.2, -1.62, -1.02, -.38, 2.45, .7].forEach(a0 => {
      const a = a0 + (r() - .5) * .22, lower = a0 > 0;
      branch(cx + Math.cos(a) * 13, cy + Math.sin(a) * 12, a, (lower ? 15 : 23) + r() * 8, lower ? 1.9 : 2.7, lower ? 2 : 3);
    });
    out.push(`<g fill="none" stroke="${ink}" stroke-linecap="round">${tree.join('')}</g>`);
    const axon = cubic([[100, 101], [97, 136], [124, 158], [101, 194]], 120);
    out.push(`<path d="${pathOf(axon)}" fill="none" stroke="${ink}" stroke-width="1.3"/>`);
    const w = walker(axon);
    for (let s = 16; s < w.total - 12; s += 15) {
      const p = w.at(s + 6);
      out.push(`<rect x="-6.2" y="-3.4" width="12.4" height="6.8" rx="3.4" transform="translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.angle * 180 / Math.PI)})" fill="${t.cloth}"/>`,
        `<rect x="-6.2" y="-3.4" width="12.4" height="6.8" rx="3.4" transform="translate(${f(p.x)} ${f(p.y)}) rotate(${f(p.angle * 180 / Math.PI)})" fill="url(#${id}-myelin)" stroke="${ink}" stroke-width=".8"/>`);
    }
    const end = axon[axon.length - 1];
    for (let i = 0; i < 5; i++) {
      const a = Math.PI / 2 + (i - 2) * .48 + (r() - .5) * .15, l = 7 + r() * 5;
      const x2 = end[0] + Math.cos(a) * l, y2 = end[1] + Math.sin(a) * l * .7;
      out.push(`<path d="M${f(end[0])} ${f(end[1])}Q${f(end[0] + Math.cos(a) * l * .4)} ${f(end[1] + 4)} ${f(x2)} ${f(y2)}" fill="none" stroke="${ink}" stroke-width=".8"/>`,
        `<circle cx="${f(x2)}" cy="${f(y2)}" r="1.9" fill="${t.accent}" stroke="${ink}" stroke-width=".5"/>`);
    }
    let soma = '';
    for (let i = 0; i <= 26; i++) {
      const a = i / 26 * TAU, rr = 14 + Math.sin(a * 3 + 1.3) * 1.6 + (r() - .5) * 1.2;
      soma += (i ? 'L' : 'M') + f(cx + Math.cos(a) * rr) + ' ' + f(cy + Math.sin(a) * rr * .92);
    }
    soma += 'Z';
    out.push(`<path d="${soma}" fill="${t.cloth}"/>`, `<path d="${soma}" fill="url(#${id}-dense)" stroke="${ink}" stroke-width="1.3"/>`,
      `<circle cx="${cx - 1}" cy="${cy - 1}" r="5.8" fill="${t.cloth}" stroke="${ink}" stroke-width=".9"/>`,
      `<circle cx="${cx - 1}" cy="${cy - 1}" r="5.8" fill="url(#${id}-cross)"/>`,
      `<circle cx="${cx - 2.4}" cy="${cy - 2.4}" r="1.6" fill="${t.accent}"/>`);
    const defs = hatch(id + '-dense', 35, 2.1, .55, ink) + hatch(id + '-cross', -40, 1.7, .5, ink) + hatch(id + '-myelin', -62, 1.9, .5, ink);
    return [defs, out.join('')];
  }

  // Психология личности: профиль, а внутри — слои, вложенные один в другой.
  const PROFILE = 'M70 205C72 185 70 172 66 160C54 140 50 112 54 90C58 60 80 40 106 40C128 40 142 56 144 78C145 84 142 88 143 92C147 100 154 108 156 113C157 116 153 118 148 119C150 122 149 125 146 127C148 130 148 134 145 136C146 140 144 146 140 150C137 156 130 158 122 159C118 166 117 180 120 205Z';
  function layers(r, t, id) {
    const ink = t.ink, out = [], cx = 104, cy = 110;
    let rays = '';
    for (let i = 0; i < 80; i++) {
      const a = i / 80 * TAU, r0 = 64 + (i % 2) * 5, r1 = 92 + r() * 16;
      rays += `M${f(cx + Math.cos(a) * r0)} ${f(cy + Math.sin(a) * r0)}L${f(cx + Math.cos(a) * r1)} ${f(cy + Math.sin(a) * r1)}`;
    }
    out.push(`<path d="${rays}" stroke="${ink}" stroke-opacity=".3" stroke-width=".55"/>`,
      `<circle cx="${cx}" cy="${cy}" r="60" fill="none" stroke="${ink}" stroke-opacity=".38" stroke-width=".6"/>`);
    const scales = [1, .83, .67, .52, .38, .25];
    const angles = [45, -45, 0, 62, -28, 90];
    const gaps = [2.6, 2.4, 2.2, 2, 1.8, 1.6];
    let defs = '';
    scales.forEach((s, i) => {
      defs += hatch(`${id}-l${i}`, angles[i], gaps[i] / s, .55 / s, ink);
      const tr = `translate(${f(cx * (1 - s))} ${f(cy * (1 - s))}) scale(${s})`;
      out.push(`<path d="${PROFILE}" transform="${tr}" fill="${t.cloth}"/>`,
        `<path d="${PROFILE}" transform="${tr}" fill="url(#${id}-l${i})" stroke="${ink}" stroke-width="${f((i ? .9 : 1.3) / s)}"/>`);
    });
    out.push(`<circle cx="${cx + 3}" cy="${cy - 4}" r="2.6" fill="${t.accent}"/>`,
      `<circle cx="${cx + 3}" cy="${cy - 4}" r="5.5" fill="none" stroke="${t.accent}" stroke-opacity=".6" stroke-width=".6"/>`);
    return [defs, out.join('')];
  }

  // Общая психология: глаз — восприятие и внимание; лучи расходятся от зрачка.
  function eye(r, t, id) {
    const ink = t.ink, out = [], cx = 100, cy = 112;
    let rays = '';
    for (let i = 0; i < 96; i++) {
      const a = i / 96 * TAU, r0 = 60 + (i % 3) * 3, r1 = r0 + 10 + r() * (i % 2 ? 24 : 12);
      rays += `M${f(cx + Math.cos(a) * r0)} ${f(cy + Math.sin(a) * r0)}L${f(cx + Math.cos(a) * r1)} ${f(cy + Math.sin(a) * r1)}`;
    }
    out.push(`<path d="${rays}" stroke="${ink}" stroke-opacity=".42" stroke-width=".5"/>`,
      `<circle cx="${cx}" cy="${cy}" r="54" fill="none" stroke="${ink}" stroke-opacity=".3" stroke-width=".5" stroke-dasharray="2 3"/>`,
      `<circle cx="${cx}" cy="${cy}" r="94" fill="none" stroke="${ink}" stroke-opacity=".18" stroke-width=".5"/>`);
    const almond = 'M36 112Q100 48 164 112Q100 168 36 112Z';
    let iris = '';
    for (let i = 0; i < 120; i++) {
      const a = i / 120 * TAU + r() * .02, r0 = 11.5, r1 = 28.5 - r() * 6;
      iris += `M${f(cx + Math.cos(a) * r0)} ${f(cy + Math.sin(a) * r0)}L${f(cx + Math.cos(a) * r1)} ${f(cy + Math.sin(a) * r1)}`;
    }
    out.push(`<path d="${almond}" fill="${t.cloth}" stroke="${ink}" stroke-width="1.4"/>`,
      `<g clip-path="url(#${id}-almond)">`,
      `<circle cx="${cx}" cy="${cy}" r="29" fill="${t.cloth}" stroke="${ink}" stroke-width="1.5"/>`,
      `<path d="${iris}" stroke="${ink}" stroke-width=".55"/>`,
      `<circle cx="${cx}" cy="${cy}" r="20" fill="none" stroke="${t.accent}" stroke-opacity=".75" stroke-width=".8"/>`,
      `<circle cx="${cx}" cy="${cy}" r="11.5" fill="${ink}"/>`,
      `<circle cx="${cx - 5}" cy="${cy - 6}" r="3.6" fill="${t.cloth}"/>`,
      `<circle cx="${cx + 6}" cy="${cy + 4}" r="1.4" fill="${t.cloth}" opacity=".8"/>`,
      `<path d="M36 112Q100 48 164 112Q100 72 36 112Z" fill="url(#${id}-lid)"/>`,
      '</g>',
      `<path d="M40 103Q100 40 160 103" fill="none" stroke="${ink}" stroke-width=".9"/>`,
      `<path d="M40 103Q100 40 160 103L164 112Q100 48 36 112Z" fill="url(#${id}-crease)"/>`,
      `<path d="M46 119Q100 160 154 119" fill="none" stroke="${ink}" stroke-opacity=".35" stroke-width=".6"/>`);
    let lashes = '';
    for (let i = 1; i < 12; i++) {
      const u = i / 12, v = 1 - u;
      const x = v * v * 36 + 2 * v * u * 100 + u * u * 164, y = v * v * 112 + 2 * v * u * 48 + u * u * 112;
      const a = -Math.PI / 2 + (u - .5) * 2.1, l = 7 + Math.sin(u * Math.PI) * 4;
      lashes += `M${f(x)} ${f(y)}q${f(Math.cos(a) * l * .4 + (u - .5) * 3)} ${f(Math.sin(a) * l * .6)} ${f(Math.cos(a) * l)} ${f(Math.sin(a) * l)}`;
    }
    out.push(`<path d="${lashes}" fill="none" stroke="${ink}" stroke-width=".8" stroke-linecap="round"/>`);
    const defs = `<clipPath id="${id}-almond"><path d="${almond}"/></clipPath>` + hatch(id + '-lid', 20, 2, .5, ink, .8) + hatch(id + '-crease', -25, 2.2, .5, ink);
    return [defs, out.join('')];
  }

  // Консультирование: два лица напротив; между ними — пространство-ваза и росток.
  const FACE_EDGE = 'M78 40C79 55 79 66 80 76C81 82 79 86 81 90C85 96 92 98 92 102C92 106 86 107 84 108C87 111 88 113 86 115C88 118 88 121 86 124C87 130 88 136 85 141C82 148 76 152 74 160C72 172 70 188 70 205';
  function vase(r, t, id) {
    const ink = t.ink, out = [], mirror = 'translate(200 0) scale(-1 1)';
    const face = 'M0 40H78' + FACE_EDGE.slice(FACE_EDGE.indexOf('C')) + 'H0Z';
    out.push(`<g mask="url(#${id}-fade)"><path d="${face}" fill="url(#${id}-skin)"/><path d="${face}" transform="${mirror}" fill="url(#${id}-skin)"/></g>`,
      `<path d="${face}" fill="url(#${id}-shade)" clip-path="url(#${id}-edge)"/>`,
      `<path d="${face}" transform="${mirror}" fill="url(#${id}-shade)" clip-path="url(#${id}-edge)"/>`,
      `<path d="${FACE_EDGE}" fill="none" stroke="${ink}" stroke-width="1.3"/>`,
      `<path d="${FACE_EDGE}" transform="${mirror}" fill="none" stroke="${ink}" stroke-width="1.3"/>`,
      `<path d="M78 40H122M70 205H130" stroke="${ink}" stroke-width="1.1"/>`,
      `<path d="M88 58Q100 62 112 58M84 186Q100 191 116 186" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width=".6"/>`);
    for (let i = 0; i < 9; i++) {
      const y = 64 + i * 2.2;
      out.push(`<path d="M${f(92 + i * .2)} ${f(y)}H${f(108 - i * .2)}" stroke="${ink}" stroke-opacity=".18" stroke-width=".4"/>`);
    }
    out.push(`<path d="M100 40C100 33 99 28 100 19" fill="none" stroke="${t.accent}" stroke-width="1.2" stroke-linecap="round"/>`,
      `<path d="M100 31C94 27 89 27 85 30C90 34 96 34 100 31Z" fill="${t.accent}" stroke="${ink}" stroke-width=".5"/>`,
      `<path d="M100 25C106 20 111 20 115 23C110 28 104 28 100 25Z" fill="${t.accent}" stroke="${ink}" stroke-width=".5"/>`);
    const defs = hatch(id + '-skin', 90, 2.5, .7, ink) + hatch(id + '-shade', 45, 2.2, .5, ink, .9)
      + `<clipPath id="${id}-edge"><rect x="56" y="40" width="88" height="165"/></clipPath>`
      + `<linearGradient id="${id}-fg"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff"/><stop offset=".7" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      + `<linearGradient id="${id}-fv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".12" stop-color="#fff"/><stop offset=".88" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      + `<mask id="${id}-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="300"><rect x="0" y="40" width="200" height="165" fill="url(#${id}-fg)"/><rect x="56" y="40" width="88" height="165" fill="#fff"/></mask>`;
    return [defs, out.join('')];
  }

  // Допматериалы: веер карточек со скрепкой и карандаш.
  function cards(r, t, id) {
    const ink = t.ink, paper = '#efe7d6', out = [];
    const card = (x, y, rot, inner = '') => `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="-50" y="-33" width="100" height="66" rx="2.5" transform="translate(2.6 3.2)" fill="url(#${id}-shadow)"/><rect x="-50" y="-33" width="100" height="66" rx="2.5" fill="${paper}" stroke="${ink}" stroke-width=".9"/>${inner}</g>`;
    let ruled = `<path d="M-34 -33V33" stroke="${t.accent}" stroke-width=".8"/>`;
    for (let i = 0; i < 6; i++) ruled += `<path d="M-50 ${f(-20 + i * 9)}H50" stroke="${ink}" stroke-opacity=".28" stroke-width=".45"/>`;
    for (let i = 0; i < 4; i++) {
      const y = -23 + i * 9, len = 52 + r() * 26, pts = [];
      for (let x = -30; x < -30 + len; x += 2.5) pts.push([x, y + Math.sin(x * .9 + i) * 1.3 + (r() - .5) * .8]);
      ruled += `<path d="${pathOf(pts)}" fill="none" stroke="${ink}" stroke-width=".6" stroke-linecap="round"/>`;
    }
    ruled += `<path d="M-40 -40V-18a5 5 0 0 0 10 0V-44a3.5 3.5 0 0 0-7 0V-21" fill="none" stroke="${ink}" stroke-width="1.1" stroke-linecap="round"/>`;
    out.push(card(94, 118, -16), card(104, 110, -5), card(100, 100, 7, ruled));
    out.push(`<g transform="translate(130 164) rotate(-36)">`,
      `<rect x="-48" y="-4.5" width="78" height="9" fill="${paper}" stroke="${ink}" stroke-width=".9"/>`,
      `<rect x="-48" y="-4.5" width="78" height="9" fill="url(#${id}-wood)"/>`,
      `<path d="M-48 -1.5H30M-48 1.5H30" stroke="${ink}" stroke-opacity=".5" stroke-width=".5"/>`,
      `<rect x="-56" y="-4.5" width="8" height="9" fill="${t.cloth}" stroke="${ink}" stroke-width=".8"/>`,
      `<rect x="-62" y="-4.2" width="6" height="8.4" rx="1.6" fill="${t.accent}" stroke="${ink}" stroke-width=".8"/>`,
      `<path d="M30 -4.5L44 0L30 4.5Z" fill="${paper}" stroke="${ink}" stroke-width=".8"/>`,
      `<path d="M39.5 -1.5L44 0L39.5 1.5Z" fill="${ink}"/>`, '</g>');
    const defs = hatch(id + '-shadow', 45, 1.7, .55, ink, .6) + hatch(id + '-wood', 0, 2.4, .4, ink, .55);
    return [defs, out.join('')];
  }

  // Синемалогия и сериаловедение: бобина, лента с кадрами и луч проектора.
  function film(r, t, id) {
    const ink = t.ink, out = [], light = '#2a3150';
    let beam = '';
    for (let i = 0; i < 42; i++) {
      const a = 2.05 + i / 41 * .5, l = 150 + r() * 40;
      beam += `M198 14L${f(198 + Math.cos(a) * l)} ${f(14 + Math.sin(a) * l)}`;
    }
    out.push(`<path d="${beam}" stroke="${t.accent}" stroke-opacity=".2" stroke-width=".5"/>`);
    for (let i = 0; i < 26; i++) {
      const a = 2.05 + r() * .5, l = 30 + r() * 140;
      out.push(`<circle cx="${f(198 + Math.cos(a) * l)}" cy="${f(14 + Math.sin(a) * l)}" r="${f(.4 + r() * .7)}" fill="${t.accent}" opacity="${f(.35 + r() * .45)}"/>`);
    }
    const strip = cubic([[96, 100], [162, 108], [104, 172], [168, 198]], 140);
    const w = walker(strip), half = 12.5;
    const left = [], right = [];
    for (let s = 0; s <= w.total; s += 2) {
      const p = w.at(s), nx = -Math.sin(p.angle), ny = Math.cos(p.angle);
      left.push([p.x + nx * half, p.y + ny * half]); right.push([p.x - nx * half, p.y - ny * half]);
    }
    const ribbon = pathOf(left.concat(right.reverse())) + 'Z';
    out.push(`<path d="${ribbon}" fill="${light}" stroke="${ink}" stroke-width=".9"/>`);
    for (let s = 3; s < w.total - 3; s += 6.5) {
      const p = w.at(s), deg = f(p.angle * 180 / Math.PI);
      for (const side of [-1, 1]) {
        const nx = -Math.sin(p.angle) * 9.6 * side, ny = Math.cos(p.angle) * 9.6 * side;
        out.push(`<rect x="-1.5" y="-1.1" width="3" height="2.2" rx=".5" transform="translate(${f(p.x + nx)} ${f(p.y + ny)}) rotate(${deg})" fill="${t.cloth}" stroke="${ink}" stroke-width=".35"/>`);
      }
    }
    let frame = 0;
    for (let s = 14; s < w.total - 8; s += 23) {
      const p = w.at(s), deg = f(p.angle * 180 / Math.PI);
      out.push(`<g transform="translate(${f(p.x)} ${f(p.y)}) rotate(${deg})"><rect x="-9.5" y="-6.4" width="19" height="12.8" fill="url(#${id}-f${frame % 3})" stroke="${ink}" stroke-width=".55"/>${frame % 2 ? `<circle cx="1" cy="-1" r="2.3" fill="none" stroke="${ink}" stroke-width=".6"/><path d="M-3 5Q1 -1 5 5" fill="none" stroke="${ink}" stroke-width=".6"/>` : `<path d="M-8 4L-3 -2L1 2L4 -1L8 4" fill="none" stroke="${ink}" stroke-width=".6"/>`}</g>`);
      frame++;
    }
    let wound = '';
    for (let rr = 13; rr < 40; rr += 1.7) wound += `<circle cx="66" cy="84" r="${f(rr)}" fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width=".45"/>`;
    out.push(`<circle cx="66" cy="84" r="41" fill="${light}"/>`, wound,
      `<circle cx="66" cy="84" r="41" fill="none" stroke="${ink}" stroke-width="1.4"/>`);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU - Math.PI / 2;
      out.push(`<circle cx="${f(66 + Math.cos(a) * 25)}" cy="${f(84 + Math.sin(a) * 25)}" r="8.6" fill="${t.cloth}" stroke="${ink}" stroke-width=".9"/>`);
    }
    out.push(`<circle cx="66" cy="84" r="7" fill="${ink}"/>`, `<circle cx="66" cy="84" r="2.4" fill="${t.cloth}"/>`,
      `<path d="M104 92Q100 96 96 100" fill="none" stroke="${ink}" stroke-width=".8"/>`);
    const defs = hatch(id + '-f0', 45, 2, .45, ink, .7) + hatch(id + '-f1', -30, 2.4, .45, ink, .6) + hatch(id + '-f2', 90, 1.8, .45, ink, .7);
    return [defs, out.join('')];
  }

  // Психология интеллектов: многогранник — у ума много граней.
  function solid(r, t, id) {
    const ink = t.ink, out = [], phi = (1 + Math.sqrt(5)) / 2;
    const V = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) V.push([0, a, b * phi], [a, b * phi, 0], [b * phi, 0, a]);
    const d = (i, j) => Math.hypot(V[i][0] - V[j][0], V[i][1] - V[j][1], V[i][2] - V[j][2]);
    const F = [];
    for (let i = 0; i < 12; i++) for (let j = i + 1; j < 12; j++) for (let k = j + 1; k < 12; k++)
      if (Math.abs(d(i, j) - 2) < .01 && Math.abs(d(j, k) - 2) < .01 && Math.abs(d(i, k) - 2) < .01) F.push([i, j, k]);
    const ax = .5 + r() * .12, ay = .62 + r() * .12;
    const rot = ([x, y, z]) => {
      const y1 = y * Math.cos(ax) - z * Math.sin(ax), z1 = y * Math.sin(ax) + z * Math.cos(ax);
      return [x * Math.cos(ay) + z1 * Math.sin(ay), y1, -x * Math.sin(ay) + z1 * Math.cos(ay)];
    };
    const R = V.map(rot), cx = 100, cy = 106, s = 44;
    const P = R.map(([x, y, z]) => { const k = 1 / (1 - z * .07); return [cx + x * s * k, cy - y * s * k]; });
    out.push(`<ellipse cx="${cx}" cy="${cy}" rx="78" ry="21" transform="rotate(-16 ${cx} ${cy})" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width=".55"/>`,
      `<ellipse cx="${cx}" cy="${cy}" rx="72" ry="30" transform="rotate(30 ${cx} ${cy})" fill="none" stroke="${ink}" stroke-opacity=".28" stroke-width=".5" stroke-dasharray="2 2.5"/>`);
    for (let i = 0; i < 34; i++) out.push(`<circle cx="${f(10 + r() * 180)}" cy="${f(14 + r() * 190)}" r="${f(.3 + r() * .7)}" fill="${ink}" opacity="${f(.2 + r() * .4)}"/>`);
    const L = [-.42, .58, .7], ll = Math.hypot(...L);
    let defs = '';
    const faces = F.map((face, i) => {
      const [a, b, c] = face.map(v => R[v]);
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) n = n.map(x => -x);
      const nl = Math.hypot(...n);
      return {face, i, z: m[2], nz: n[2] / nl, light: (n[0] * L[0] + n[1] * L[1] + n[2] * L[2]) / nl / ll};
    });
    const back = faces.filter(x => x.nz <= 0), front = faces.filter(x => x.nz > 0).sort((p, q) => p.z - q.z);
    const poly = face => face.map(v => f(P[v][0]) + ',' + f(P[v][1])).join(' ');
    back.forEach(x => out.push(`<polygon points="${poly(x.face)}" fill="none" stroke="${ink}" stroke-opacity=".3" stroke-width=".5" stroke-dasharray="1.6 2"/>`));
    front.forEach(x => {
      const level = x.light > .72 ? 0 : x.light > .42 ? 1 : x.light > .1 ? 2 : 3;
      const pid = `${id}-face${x.i}`;
      if (level) defs += hatch(pid, (x.i * 37) % 180, [0, 3.2, 2.2, 1.5][level], .55, ink);
      out.push(`<polygon points="${poly(x.face)}" fill="${t.cloth}"/>`,
        `<polygon points="${poly(x.face)}" fill="${level ? `url(#${pid})` : t.cloth}" stroke="${ink}" stroke-width=".95" stroke-linejoin="round"/>`);
    });
    const seen = new Set(front.flatMap(x => x.face));
    seen.forEach(v => out.push(`<circle cx="${f(P[v][0])}" cy="${f(P[v][1])}" r="1.4" fill="${ink}"/>`));
    const a = 2.3, ex = cx + Math.cos(a) * 78, ey = cy + Math.sin(a) * 21;
    const c = Math.cos(-16 * Math.PI / 180), sn = Math.sin(-16 * Math.PI / 180);
    out.push(`<circle cx="${f(cx + (ex - cx) * c - (ey - cy) * sn)}" cy="${f(cy + (ex - cx) * sn + (ey - cy) * c)}" r="3.4" fill="${t.accent}" stroke="${ink}" stroke-width=".6"/>`);
    return [defs, out.join('')];
  }

  // Новая дисциплина без своего сюжета: созвездие над раскрытой книгой.
  function constellation(r, t, id) {
    const ink = t.ink, out = [], stars = [];
    for (let i = 0; i < 11; i++) stars.push([30 + r() * 140, 30 + r() * 110]);
    const path = [stars[0]], rest = stars.slice(1);
    while (rest.length) {
      const last = path[path.length - 1];
      rest.sort((a, b) => Math.hypot(a[0] - last[0], a[1] - last[1]) - Math.hypot(b[0] - last[0], b[1] - last[1]));
      path.push(rest.shift());
    }
    out.push(`<path d="${pathOf(path)}" fill="none" stroke="${ink}" stroke-opacity=".55" stroke-width=".6"/>`);
    stars.forEach(([x, y], i) => {
      const s = i === 0 ? 5 : 2 + r() * 2;
      out.push(`<path d="M${f(x)} ${f(y - s)}L${f(x + s * .25)} ${f(y - s * .25)}L${f(x + s)} ${f(y)}L${f(x + s * .25)} ${f(y + s * .25)}L${f(x)} ${f(y + s)}L${f(x - s * .25)} ${f(y + s * .25)}L${f(x - s)} ${f(y)}L${f(x - s * .25)} ${f(y - s * .25)}Z" fill="${i === 0 ? t.accent : ink}"/>`);
    });
    let rays = '';
    for (let i = 0; i < 30; i++) { const a = Math.PI + .25 + i / 29 * (Math.PI - .5); rays += `M100 170L${f(100 + Math.cos(a) * 40)} ${f(170 + Math.sin(a) * 40)}`; }
    out.push(`<path d="${rays}" stroke="${ink}" stroke-opacity=".25" stroke-width=".5"/>`,
      `<path d="M100 172C82 162 58 162 42 168V198C58 192 82 192 100 202C118 192 142 192 158 198V168C142 162 118 162 100 172Z" fill="${t.cloth}" stroke="${ink}" stroke-width="1.1"/>`,
      `<path d="M100 172V202" stroke="${ink}" stroke-width=".9"/>`);
    for (let i = 0; i < 4; i++) out.push(`<path d="M${50 + i} ${175 + i * 5}C66 ${171 + i * 5} 82 ${172 + i * 5} 94 ${178 + i * 5}M${150 - i} ${175 + i * 5}C134 ${171 + i * 5} 118 ${172 + i * 5} 106 ${178 + i * 5}" fill="none" stroke="${ink}" stroke-opacity=".45" stroke-width=".5"/>`);
    return ['', out.join('')];
  }

  const THEMES = [
    {key: 'neuro', test: /психофизиолог|нейро/, cloth: '#1d4a52', ink: '#efe3c6', accent: '#e2a85c', art: neuron, motto: 'Как нейрон становится мыслью'},
    {key: 'personality', test: /личност/, cloth: '#5e2130', ink: '#f1e2cb', accent: '#e7b071', art: layers, motto: 'Слой за слоем — к себе'},
    {key: 'general', test: /общая психолог/, cloth: '#e8dec6', ink: '#2b2621', accent: '#a5552e', art: eye, motto: 'Как мы видим, помним и думаем'},
    {key: 'counseling', test: /консульт|коучинг/, cloth: '#2c4637', ink: '#ece2c9', accent: '#d9a45c', art: vase, motto: 'Пространство между двумя людьми'},
    {key: 'materials', test: /допматериал|дополнительн/, cloth: '#b6a990', ink: '#2a2520', accent: '#9b3d2e', art: cards, motto: 'Всё, что не поместилось в лекции'},
    {key: 'cinema', test: /синема|сериал|кино|фильм/, cloth: '#1c2238', ink: '#ead9b8', accent: '#e3b25e', art: film, motto: 'Психология в кадре'},
    {key: 'intellect', test: /интеллект/, cloth: '#45304f', ink: '#efe1cf', accent: '#d9a96a', art: solid, motto: 'У ума много граней'},
  ];
  const FALLBACK = [['#3b4a5c', '#eee2c8'], ['#6a4a2e', '#f0e3c8'], ['#2f4f4a', '#ecdfc4'], ['#5a3a4a', '#f1e3ce'], ['#7a5b34', '#f3e6cc']];
  function theme(name) {
    const label = String(name || '').toLocaleLowerCase('ru');
    const known = THEMES.find(item => item.test.test(label));
    if (known) return known;
    const [cloth, ink] = FALLBACK[hash(label) % FALLBACK.length];
    return {key: 'default', cloth, ink, accent: '#d9a45c', art: constellation, motto: 'Новая книга на полке'};
  }

  function art(subject, colors, crop = false) {
    const t = colors || theme(subject.name), id = 'psb' + (++uidSeq);
    const [defs, body] = t.art(rng(t.key + ':' + subject.name), t, id);
    const grain = `<filter id="${id}-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${hash(subject.name) % 97}"/><feColorMatrix type="saturate" values="0"/></filter>`;
    return `<svg class="book-art" viewBox="${crop ? '0 6 200 206' : '0 0 200 300'}" preserveAspectRatio="xMidYMid ${crop ? 'meet' : 'slice'}" aria-hidden="true" focusable="false"><defs>${grain}${defs}</defs>${crop ? '' : `<rect width="200" height="300" fill="${t.cloth}"/>`}${body}${crop ? '' : `<rect width="200" height="300" filter="url(#${id}-grain)" opacity=".1"/>`}</svg>`;
  }

  // ---------- полка ----------
  const state = {selected: null, reading: null};
  let ctx = null;
  function remembered() { try { const v = Number(localStorage.getItem(STORE)); return Number.isSafeInteger(v) && v > 0 ? v : null; } catch (_) { return null; } }
  function remember(id) { try { if (id) localStorage.setItem(STORE, String(id)); else localStorage.removeItem(STORE); } catch (_) {} }
  const subjectOf = id => ctx?.list.find(s => s.id === Number(id)) || null;

  function geometry(subject) {
    const cards = num(subject.cards), k = ctx?.scale || 1;
    const w = Math.round(Math.min(56, Math.max(34, 30 + Math.sqrt(cards) * .45)) * (k > 1 ? 1.06 : 1));
    const h = Math.round(272 * k * (.93 + (hash(subject.name) % 9) / 100));
    return {w, h, cw: Math.round(h * .66)};
  }
  function coverFace(subject, t, extraClass = '') {
    const lectures = num(subject.lectures);
    const longest = Math.max(1, ...String(subject.name).split(/\s+/).map(word => word.length));
    const size = f(Math.min(1.86, 21.5 / longest));
    return `<span class="book-face book-cover ${extraClass}">${art(subject, t)}<span class="cover-text"><span class="cover-brand">PSU Hope</span><b class="cover-title" style="font-size:${size}em">${esc(subject.name)}</b><span class="cover-meta">${lectures ? count(lectures, LECTURES) : 'материалы готовятся'}</span></span><i class="cover-hinge" aria-hidden="true"></i></span>`;
  }
  function bookHtml(subject, index) {
    const t = theme(subject.name), g = geometry(subject), lectures = num(subject.lectures);
    const label = `${subject.name}. ${lectures ? count(lectures, LECTURES) : 'Лекций пока нет'}`;
    return `<button class="book theme-${t.key}" type="button" data-book-id="${subject.id}" data-index="${index}" aria-pressed="false" aria-label="${esc(label)}" style="--w:${g.w}px;--h:${g.h}px;--cw:${g.cw}px;--shadow-k:${f((g.w + 10) / (g.cw + 30))};--cloth:${t.cloth};--ink:${t.ink};--accent:${t.accent}"><span class="book-body"><span class="book-face book-spine"><span class="spine-band"></span><span class="spine-title">${esc(subject.name)}</span><span class="spine-mark" aria-hidden="true">Ψ</span><span class="spine-band low"></span></span>${coverFace(subject, t)}<span class="book-face book-back"></span></span><span class="book-shadow" aria-hidden="true"></span></button>`;
  }
  function captionHtml() {
    const subject = subjectOf(state.selected);
    if (!subject) return '<span class="shelf-hint">Выбери книгу на полке: нажми на корешок.</span>';
    const i = ctx.list.indexOf(subject) + 1, lectures = num(subject.lectures), due = num(subject.due);
    const meta = [lectures ? count(lectures, LECTURES) : '', due ? `к повтору ${due}` : ''].filter(Boolean).join(' · ');
    return `<span class="shelf-num">${String(i).padStart(2, '0')}</span><b class="shelf-title">${esc(subject.name)}</b>${meta ? `<span class="shelf-meta">${meta}</span>` : ''}<button class="shelf-link shelf-open" type="button" data-shelf="open">Открыть книгу <span aria-hidden="true">→</span></button><button class="shelf-link shelf-back" type="button" data-shelf="back">Поставить на полку</button>`;
  }
  function paintSelection(scroll = true) {
    if (!ctx) return;
    ctx.mount.querySelectorAll('.book').forEach(book => {
      const on = Number(book.dataset.bookId) === state.selected;
      book.classList.toggle('is-out', on);
      book.setAttribute('aria-pressed', String(on));
    });
    const caption = ctx.mount.querySelector('.shelf-caption');
    if (caption) caption.innerHTML = captionHtml();
    markScrollable();
    setTimeout(markScrollable, 820);
    const out = ctx.mount.querySelector('.book.is-out');
    if (scroll && out) {
      const row = ctx.mount.querySelector('.shelf-row');
      if (row && row.scrollWidth > row.clientWidth + 4) {
        const target = out.offsetLeft - (row.clientWidth - (geometry(subjectOf(state.selected)).cw + 22)) / 2;
        try { row.scrollTo({left: Math.max(0, target), behavior: reducedMotion() ? 'auto' : 'smooth'}); } catch (_) { row.scrollLeft = Math.max(0, target); }
      }
    }
  }
  function markScrollable() {
    const row = ctx?.mount.querySelector('.shelf-row');
    if (row) row.classList.toggle('is-scrollable', row.scrollWidth > row.clientWidth + 4);
  }
  // Соседи расступаются через transform: ширина слота меняется сразу, сдвиг доигрывает transition.
  let turning = 0;
  function select(id) {
    const subject = subjectOf(id);
    const previous = state.selected;
    state.selected = subject ? subject.id : null;
    remember(state.selected);
    const books = [...ctx.mount.querySelectorAll('.book')];
    if (reducedMotion()) { paintSelection(); return; }
    const center = b => { const r = b.getBoundingClientRect(); return r.left + r.width / 2; };
    const before = books.map(center);
    books.forEach(b => { const id = Number(b.dataset.bookId); if (id === previous || id === state.selected) b.classList.add('is-turning'); });
    paintSelection();
    books.forEach((b, i) => {
      const dx = before[i] - center(b);
      b.style.transition = 'none';
      b.style.transform = Math.abs(dx) > .5 ? `translateX(${f(dx)}px)` : '';
    });
    void ctx.mount.offsetWidth;
    books.forEach(b => { b.style.transition = ''; b.style.transform = ''; });
    clearTimeout(turning);
    turning = setTimeout(() => books.forEach(b => b.classList.remove('is-turning')), 620);
  }

  // ---------- раскрытая книга ----------
  const CHAPTERS = [
    {action: 'lectures', title: 'Лекции', note: 'Аудио, разбор и задания по каждой'},
    {action: 'study', title: 'Учить', note: 'Повторы по графику и новые карточки'},
    {action: 'terms', title: 'Термины', note: 'Понятия дисциплины и их определения'},
    {action: 'stats', title: 'Статистика', note: 'Что уже освоено и где ошибки'},
  ];
  const ROMAN = ['I', 'II', 'III', 'IV'];
  function chapterValue(action, s) {
    const cards = num(s.cards), due = num(s.due), fresh = num(s.new_avail), terms = num(s.terms), lectures = num(s.lectures);
    if (action === 'study') {
      if (!cards) return ['—', 'карточек нет', true];
      if (due) return [due, 'к повтору', false];
      if (fresh) return [fresh, plural(fresh, ['новая', 'новые', 'новых']), false];
      return ['✓', 'на сегодня всё', false];
    }
    if (action === 'terms') return terms ? [terms, plural(terms, TERMS), false] : ['—', 'терминов нет', true];
    if (action === 'lectures') return [lectures, plural(lectures, LECTURES), false];
    const acc = Number(s.acc);
    if (s.acc != null && Number.isFinite(acc)) return [`${Math.round(acc)}%`, 'верных', false];
    return [num(s.mature), 'освоено', false];
  }
  function readerHtml(subject, single) {
    const t = theme(subject.name);
    const paper = {key: t.key, cloth: PAPER, ink: PAPER_INK, accent: t.accent, art: t.art};
    const lectures = num(subject.lectures), cards = num(subject.cards), mature = num(subject.mature);
    const rows = CHAPTERS.map((c, i) => {
      const [value, unit, disabled] = chapterValue(c.action, subject);
      return `<li><button class="toc-item" type="button" data-action="${c.action}"${disabled ? ' disabled aria-disabled="true"' : ''}><span class="toc-roman">${ROMAN[i]}</span><span class="toc-body"><b>${c.title}</b><small>${c.note}</small></span><span class="toc-leader" aria-hidden="true"></span><span class="toc-value"><b>${esc(value)}</b><small>${esc(unit)}</small></span></button></li>`;
    }).join('');
    return `<div class="reader-stage" style="--cloth:${t.cloth};--ink:${t.ink};--accent:${t.accent}">
<div class="reader-page" role="region" aria-labelledby="reader-toc-title"><p class="toc-kicker" id="reader-toc-title">Оглавление</p><h3 class="toc-name">${esc(subject.name)}</h3><p class="toc-motto"><i>${esc(t.motto)}</i> · ${count(lectures, LECTURES)} · ${count(cards, CARDS)}</p><ol class="toc-list">${rows}</ol><div class="toc-foot"><button class="toc-close" type="button" data-reader="close"><span aria-hidden="true">←</span> Закрыть книгу</button></div></div>
<div class="reader-cover"><div class="reader-front" style="--cw:var(--pw)">${coverFace(subject, t, 'reader-cover-face')}</div><div class="reader-inside"><span class="tp-brand">PSU Hope · библиотека</span><div class="tp-art">${art(subject, paper, true)}</div><h3 class="tp-name">${esc(subject.name)}</h3><p class="tp-motto">${esc(t.motto)}</p><dl class="tp-facts"><div><dt>Лекций</dt><dd>${lectures}</dd></div><div><dt>Карточек</dt><dd>${cards}</dd></div><div><dt>Освоено</dt><dd>${mature}</dd></div></dl></div></div>
</div>`;
  }
  let timer = 0;
  function later(fn, ms) { clearTimeout(timer); if (reducedMotion() || !ms) { fn(); return; } timer = setTimeout(fn, ms); }
  function open(id, instant = false) {
    const subject = subjectOf(id);
    if (!ctx || !subject) return;
    state.selected = subject.id; state.reading = subject.id; remember(subject.id);
    const {mount} = ctx, shelf = mount.querySelector('.psu-shelf'), reader = mount.querySelector('.psu-reader');
    const width = mount.clientWidth || 720, single = width < 620;
    const pw = single ? Math.min(380, Math.max(260, width - 24)) : Math.min(340, Math.floor((width - 32) / 2));
    reader.classList.toggle('single', single);
    reader.style.setProperty('--pw', pw + 'px');
    reader.style.setProperty('--ph', Math.round(Math.max(pw * 1.42, single ? 470 : 0)) + 'px');
    reader.innerHTML = readerHtml(subject, single);
    reader.classList.remove('is-open', 'is-closing');
    shelf.hidden = true; reader.hidden = false;
    mount.dataset.state = 'reading';
    const focusFirst = () => (reader.querySelector('.toc-item:not([disabled])') || reader.querySelector('.toc-close'))?.focus({preventScroll: true});
    if (instant) { reader.classList.add('is-open'); return; }
    if (reducedMotion()) { reader.classList.add('is-open'); focusFirst(); return; }
    void reader.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => reader.classList.add('is-open')));
    if (single) try { mount.scrollIntoView({block: 'start', behavior: 'smooth'}); } catch (_) {}
    later(focusFirst, 720);
  }
  function close() {
    if (!ctx) return;
    const {mount} = ctx, shelf = mount.querySelector('.psu-shelf'), reader = mount.querySelector('.psu-reader');
    const id = state.reading; state.reading = null;
    reader.classList.add('is-closing');
    reader.classList.remove('is-open');
    later(() => {
      reader.hidden = true; reader.innerHTML = ''; reader.classList.remove('is-closing'); shelf.hidden = false; mount.dataset.state = 'shelf';
      paintSelection(false);
      mount.querySelector(`.book[data-book-id="${id}"]`)?.focus({preventScroll: true});
    }, 440);
  }
  function chapter(action, button) {
    const subject = subjectOf(state.reading);
    if (!subject || !CHAPTERS.some(c => c.action === action) || button?.disabled) return;
    ctx.mount.querySelectorAll('.toc-item').forEach(item => item.classList.toggle('is-chosen', item === button));
    clearTimeout(timer);
    ctx.handlers.action?.(subject.id, action);
  }

  function onClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || !ctx) return;
    const book = target.closest('.book');
    if (book) { const id = Number(book.dataset.bookId); if (id === state.selected) open(id); else select(id); return; }
    const shelfAction = target.closest('[data-shelf]')?.dataset.shelf;
    if (shelfAction === 'open') return open(state.selected);
    if (shelfAction === 'back') { select(null); return; }
    const item = target.closest('.toc-item');
    if (item) return chapter(item.dataset.action, item);
    if (target.closest('[data-reader="close"]')) return close();
  }
  function onKey(event) {
    if (!ctx) return;
    if (event.key === 'Escape' && state.reading) { event.preventDefault(); close(); return; }
    const book = event.target instanceof Element ? event.target.closest('.book') : null;
    if (!book || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const books = [...ctx.mount.querySelectorAll('.book')], i = books.indexOf(book);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? books.length - 1 : Math.min(books.length - 1, Math.max(0, i + (event.key === 'ArrowRight' ? 1 : -1)));
    event.preventDefault();
    books[next]?.focus();
  }

  function render(mount, subjects, handlers = {}) {
    if (!mount) return;
    const list = (Array.isArray(subjects) ? subjects : [])
      .filter(s => s && Number.isSafeInteger(Number(s.id)) && Number(s.id) > 0)
      .map(s => ({...s, id: Number(s.id), name: String(s.name ?? '')}));
    clearTimeout(timer);
    const width = mount.clientWidth || 720;
    ctx = {mount, list, handlers, scale: width >= 900 ? 1.12 : width < 430 ? .9 : 1};
    mount.classList.add('psu-library');
    if (!list.length) { mount.innerHTML = '<p class="empty">Дисциплины появятся после добавления материала.</p>'; return; }
    let selected = state.selected ?? remembered();
    if (!list.some(s => s.id === selected)) {
      const busiest = list.reduce((best, s) => num(s.due) > num(best?.due) ? s : best, null);
      selected = (busiest || list[0]).id;
    }
    state.selected = selected;
    mount.innerHTML = `<div class="psu-shelf"><div class="shelf-row" role="group" aria-label="Книги-дисциплины">${list.map(bookHtml).join('')}</div><div class="shelf-plank" aria-hidden="true"></div><div class="shelf-caption" aria-live="polite"></div></div><div class="psu-reader" hidden></div>`;
    mount.dataset.state = 'shelf';
    if (!mount.dataset.shelfBound) {
      mount.addEventListener('click', onClick);
      mount.addEventListener('keydown', onKey);
      mount.dataset.shelfBound = '1';
    }
    paintSelection(true);
    if (state.reading && list.some(s => s.id === state.reading)) open(state.reading, true);
    else state.reading = null;
  }

  window.PSUBookshelf = {render, open, close, select, theme, art, state, chapters: CHAPTERS.map(c => c.action)};
})();
