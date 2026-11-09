/* PSU Hope · Bloom: генеративное растение на canvas (по мотивам «Bloom Study»).
   Форма задаётся только зерном (порода + seed), рост 0..8 лишь раскрывает уже
   известный скелет. У каждой породы свой силуэт: сакура — широкий зонтик на
   низких развилках, клён — плоские ярусы с парными ветками, сосна — бонсай с
   изогнутым стволом и плоскими лапами хвои, глициния — купол свисающих кистей,
   бамбук — роща членистых стеблей. Никаких таймеров, сети и записи прогресса:
   только кадры requestAnimationFrame во время роста. */
(() => {
  'use strict';
  if (window.PSUBloomCanvas) return;
  const TAU = Math.PI * 2;
  const GOLD = 2.39996323;
  const UP = [0, 1, 0];

  // ---------- случайность по зерну ----------
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(key) {
    let a = hashStr(key) || 1;
    return () => {
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a = 0, b = 1) => v < a ? a : v > b ? b : v;
  const smooth = v => { v = clamp(v); return v * v * (3 - 2 * v); };
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const vlen = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function hex(c) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  function mixHex(a, b, t) {
    const x = hex(a), y = hex(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  function perp(d) {
    const u = norm(cross(d, Math.abs(d[1]) < .9 ? UP : [1, 0, 0]));
    return [u, cross(d, u)];
  }

  // ---------- породы ----------
  const YOUNG = ['#6f9a62', '#86ad6f', '#a2c487'];
  const SPECIES = {
    sakura: {
      R: 190, bloomAt: 6, petal: 0, budCell: 3, light: '#fff8f3',
      young: '#7f9b5c', youngHi: '#b9cf8e', bark: '#4a3a37', barkHi: '#9b8276', barkLo: '#211817',
      marks: 'lenticel', markCol: '#b9a596', twig: '#6c4a44', ped: '#c4909c',
      bud: ['#c9a3a0', '#d4b0a8', '#bf9a98', '#d9bcb2'],
      blush: ['#e48aa2', '#ee9fb3', '#da7894', '#f2b2c2'], blushAt: [4.85, 5.55],
      keepCol: ['#e07b98', '#d76c8c', '#ec93aa'],
      top: ['#fde3ec', '#fbd9e6', '#fae2ec', '#ffe6ee'],
      mid: ['#f4bed2', '#f0afc7', '#eaa4c0', '#f6c8d8', '#e4a7c6'],
      deep: ['#c48ab6', '#b087c4', '#d391b8', '#a181bd'],
      shade: '#2a1a33', leaf: ['#7fae5c', '#8fbd66', '#6e9f50', '#a2c676', '#8aa85a'],
      foliage: { until: 4.95, cols: ['#7fae5c', '#8fbd66', '#6e9f50', '#a2c676', '#5f9048', '#94b85e'] },
    },
    maple: {
      R: 205, bloomAt: 6, petal: 1, budCell: 1, light: '#ffd979',
      young: '#7c8f55', youngHi: '#b8c58c', bark: '#4e4943', barkHi: '#8a8376', barkLo: '#211e1b',
      marks: 'streak', markCol: '#77705f', twig: '#8a3c31', ped: '#b5503f',
      bud: ['#76a658', '#8bb862', '#679a4c', '#9ec46f', '#5b8b46'],
      blush: ['#a3ad4e', '#b3a449', '#94a24a', '#bfa84d', '#8a9845'],
      keepCol: ['#d8a43d', '#e0b347', '#c9963a'],
      top: ['#ff7b3e', '#ff8f47', '#f4683a', '#ff9c52'],
      mid: ['#d9312c', '#c4272b', '#e3412f', '#b8222e', '#ea5531'],
      deep: ['#8b1527', '#751330', '#9d1b2d', '#650f2a'],
      shade: '#24090c', leaf: ['#7fa868'],
    },
    pine: {
      R: 120, bloomAt: 0, petal: 5, budCell: 5, light: '#eef6b8',
      young: '#7a8a55', youngHi: '#b3bf86', bark: '#5a3f33', barkHi: '#a37c5d', barkLo: '#25180f',
      marks: 'plate', markCol: '#2c1d14', twig: '#5e4a38', ped: '#5b6b43',
      bud: ['#7fae76'],
      top: ['#b3d37f', '#a4ca73', '#c3dd8f', '#99c36d'],
      mid: ['#609959', '#508b51', '#6ca563', '#427a4b', '#58905a'],
      deep: ['#2c5940', '#244d39', '#346440', '#1f4535'],
      candle: ['#ece6b4', '#f2e9c4', '#ddd9a4'],
      shade: '#081c16', leaf: ['#7fae76'],
    },
    wisteria: {
      R: 150, bloomAt: 6, petal: 6, budCell: 3, light: '#fff1bf', staticPal: true,
      young: '#7f945c', youngHi: '#b6c58f', bark: '#544e47', barkHi: '#8e8679', barkLo: '#221f1b',
      marks: 'twist', markCol: '#403a33', twig: '#7a6f61', ped: '#9c8fb2',
      bud: ['#a4c283', '#b7cf92', '#98b979'],
      blush: ['#9b87d5', '#a894dc', '#8d79cd'],
      keepCol: ['#6f5dc5', '#604fb9', '#7b67cd'],
      top: ['#efe6fa', '#e6d8f6', '#f5edfb'],
      mid: ['#c8afee', '#b99ee8', '#d3bdf2', '#ac91e2'],
      deep: ['#8b70d7', '#7b63cd', '#9b81df'],
      shade: '#140f33', leaf: ['#7fae5e', '#8fbb69', '#6c9c52', '#9cc574'],
    },
    bamboo: {
      R: 100, bloomAt: 0, petal: 2, budCell: 2, light: '#f2f7d0',
      young: '#9cc46a', youngHi: '#d2e8a0', bark: '#6b9150', barkHi: '#b5d38a', barkLo: '#2c4423',
      marks: 'none', markCol: '#4b6a34', node: '#3c5a2b', woodSpan: 7, twig: '#8aab61', ped: '#9ab872',
      bud: ['#7fb05a'], top: ['#c8e09a'], mid: ['#7fb05a'], deep: ['#3f6e40'],
      shade: '#0b1f14', leaf: ['#6f9e52', '#86b35e', '#5a8a45', '#9cc06e', '#4e7c3e', '#78a855', '#a9c97c'],
    },
  };

  // ---------- кривые ----------
  function bezier3(c, t) {
    const m = 1 - t, a = m * m * m, b = 3 * m * m * t, d = 3 * m * t * t, e = t * t * t;
    return [0, 1, 2].map(i => a * c[0][i] + b * c[1][i] + d * c[2][i] + e * c[3][i]);
  }
  const bez = (c, n) => Array.from({length: n + 1}, (_, i) => bezier3(c, i / n));
  function catmull(keys, per) {
    const out = [];
    for (let i = 0; i < keys.length - 1; i++) {
      const p0 = keys[Math.max(0, i - 1)], p1 = keys[i], p2 = keys[i + 1], p3 = keys[Math.min(keys.length - 1, i + 2)];
      for (let k = 0; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        out.push([0, 1, 2].map(a => .5 * (2 * p1[a] + (p2[a] - p0[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t2 +
          (3 * p1[a] - p0[a] - 3 * p2[a] + p3[a]) * t3)));
      }
    }
    out.push(keys[keys.length - 1].slice());
    return out;
  }
  function arcLen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += vlen(sub(pts[i], pts[i - 1])); return s; }
  // Равные по длине шаги: доля индекса совпадает с долей пути, а значит и со временем роста.
  function resample(dense, n) {
    const cum = [0];
    for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + vlen(sub(dense[i], dense[i - 1])));
    const total = cum[cum.length - 1], out = [];
    let j = 1;
    for (let i = 0; i < n; i++) {
      const s = total * i / (n - 1);
      while (j < dense.length - 1 && cum[j] < s) j++;
      out.push(lerp(dense[j - 1], dense[j], clamp((s - cum[j - 1]) / ((cum[j] - cum[j - 1]) || 1))));
    }
    return out;
  }
  function at(pts, f) {
    const x = clamp(f) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x));
    return lerp(pts[i], pts[i + 1], x - i);
  }
  const dirAt = (pts, f) => norm(sub(at(pts, Math.min(1, f + .04)), at(pts, Math.max(0, f - .04))));
  function polyline(pts, birth, dur, w, tone, w1, wp) {
    const n = pts.length, xyz = new Float32Array(n * 3), cum = new Float32Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      xyz.set(pts[i], i * 3);
      if (i) total += vlen(sub(pts[i], pts[i - 1]));
      cum[i] = total;
    }
    for (let i = 0; i < n; i++) cum[i] = total ? cum[i] / total : 1;
    return { xyz, cum, n, birth, dur: Math.max(.05, dur), w, w1: w1 == null ? w : w1, wp: wp || 1, tone };
  }

  // ---------- скелет растения ----------
  function build(species, seed) {
    species = SPECIES[species] ? species : 'sakura';
    const P = SPECIES[species], R = rng(`${species}:${seed}`);
    const rr = (a, b) => a + (b - a) * R();
    const pick = a => a[(R() * a.length) | 0];
    const randUnit = () => { const z = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - z * z); return [Math.cos(a) * s, z, Math.sin(a) * s]; };
    const lines = [], flowers = [], leaves = [], hazes = [], fallen = [];
    const anatomy = { trunks: [], leaders: [], pads: [], racemes: [], culms: [] };

    function path(points, birth, dur, w, tone, kind, w1, wp) {
      const line = polyline(points, birth, dur, w, tone, w1, wp);
      if (kind) line.kind = kind;
      lines.push(line);
      return line;
    }
    // Ветка — гладкая кривая от A к T: d0 задаёт выход, d1 — с каким наклоном она приходит.
    function limb(A, T, d0, d1, o) {
      const L = vlen(sub(T, A)) || 1;
      let dense = bez([A, add(A, mul(d0, L * (o.k0 || .38))), sub(T, mul(d1, L * (o.k1 || .3))), T], 28);
      if (o.wiggle) {
        const [u, v] = perp(norm(sub(T, A))), p1 = R() * TAU, p2 = R() * TAU, fr = o.freq || 6;
        dense = dense.map((p, i) => {
          const t = i / 28, e = Math.sin(t * Math.PI) * o.wiggle;
          return add(p, add(mul(u, Math.sin(t * fr + p1) * e), mul(v, Math.sin(t * fr * .8 + p2) * e)));
        });
      }
      const pts = resample(dense, o.n || Math.max(4, Math.min(22, Math.round(L / 8) + 3)));
      const dur = Math.max(.12, arcLen(pts) / o.speed);
      const w1 = o.w1 == null ? o.w0 : o.w1;
      path(pts, o.birth, dur, o.w0, o.tone, o.kind, w1, o.wp);
      return { pts, birth: o.birth, dur, w0: o.w0, w1 };
    }
    const when = (b, f) => b.birth + b.dur * f;
    const wAt = (b, f) => b.w0 + (b.w1 - b.w0) * f;
    function blossom(F, birth, s, v, pal = 'mid') {
      const f = { x: F[0], y: F[1], z: F[2], birth, open: birth, keep: false, s, pal,
        idx: (R() * 997) | 0, bud: (R() * 97) | 0, corners: null, tw: R(), v };
      flowers.push(f);
      return f;
    }
    function leaf(p, dir, l, w, birth, color, o = {}) {
      leaves.push({ p, dir, l, w, birth, dur: o.dur || .45, fade: o.fade || null, fadeTo: o.fadeTo || 0,
        color, blade: !!o.blade, droop: o.droop || 0 });
    }
    function haze(Q, r, birth, pal = 'mid') {
      hazes.push({ x: Q[0], y: Q[1], z: Q[2], r, birth, pal, idx: (R() * 97) | 0, open: P.bloomAt ? 6.2 : birth });
    }
    function roots(tp, n, w, birth, reach) {
      const base = tp[0];
      for (let j = 0; j < n; j++) {
        const a = j * TAU / n + rr(-.4, .4), r = reach * rr(.7, 1.25);
        const end = [base[0] + Math.cos(a) * r, -1.2, base[2] + Math.sin(a) * r * .8];
        const mid = [base[0] + Math.cos(a) * r * .3, 1.6, base[2] + Math.sin(a) * r * .26];
        const pts = resample(bez([add(base, [Math.cos(a) * w * .25, 7, Math.sin(a) * w * .25]), mid, lerp(mid, end, .55), end], 16), 8);
        path(pts, birth + j * .07, .7, w * rr(.85, 1.1), 'stem', 'root', .6, 2.2);
      }
    }
    // Семядоли ростка, у бамбука и сосны — узкие.
    function sprout(tp, narrow, count = 2) {
      const p = at(tp, .05);
      for (let j = 0; j < count; j++) {
        const a = j * TAU / count + .3;
        leaf(p, norm([Math.cos(a), narrow ? 1.1 : .55, Math.sin(a) * .4]), narrow ? 10 : 10, narrow ? 1.3 : 4.2, .42,
          narrow ? '#86b46c' : '#86ad6f', { fade: [2.1, 3.1], dur: .4, blade: narrow });
      }
    }
    // Молодые листья на главном побеге: держатся, пока стебель не одревеснеет.
    function youngStem(b, fs, fade = [3.4, 4.6]) {
      let a = R() * TAU;
      fs.forEach(f => {
        // листья по спирали и вбок, чтобы не смотрели прямо от зрителя
        a += GOLD;
        const A = at(b.pts, f), d = dirAt(b.pts, f);
        leaf(A, norm(add([Math.cos(a), .3, Math.sin(a) * .45], mul(d, .25))), rr(11, 14), rr(4.4, 5.4), when(b, f) + .12,
          pick(P.leaf), { fade, dur: .5 });
      });
    }
    // Хвоя молодой сосны: мутовки иголок вдоль ствола, пока не выросли лапы.
    function needles(b, from, to, stepF, fade) {
      for (let f = from; f <= to; f += stepF) {
        const A = at(b.pts, f), d = dirAt(b.pts, f), t = when(b, f) + .08, a0 = R() * TAU;
        for (let j = 0; j < 9; j++) {
          const a = a0 + j * TAU / 9;
          leaf(A, norm(add([Math.cos(a), rr(.2, .9), Math.sin(a) * .7], mul(d, .5))), rr(6.5, 9), rr(.42, .55), t + j * .015,
            pick(['#6f9e5e', '#7fae6a', '#5f8f52', '#8cb874']), { fade, dur: .35, blade: true });
        }
      }
    }
    function youngLeaves(b, fs, fade) {
      for (const f of fs) {
        const A = at(b.pts, f), d = add(add(dirAt(b.pts, f), mul(randUnit(), .7)), [0, .25, 0]);
        leaf(A, norm(d), rr(7, 10), rr(2.8, 3.6), when(b, f) + .12, pick(P.leaf), { fade, dur: .5 });
      }
    }
    // Оболочка кроны: купол с разной высотой верха и низа.
    function clampTo(T, c, lim = .97) {
      const r = Math.hypot(T[0], T[2] / c.rz) / c.rx, dy = T[1] - c.cy, e = Math.hypot(r, dy / (dy > 0 ? c.ryT : c.ryB));
      if (e <= lim) return T;
      const k = lim / e;
      return [T[0] * k, c.cy + dy * k, T[2] * k];
    }
    const domeV = (F, c) => clamp((F[1] - c.cy) / c.ryT * .75 + (Math.hypot(F[0], F[2] / c.rz) / c.rx - .55) * .8, -1, 1);
    function trunkOf(pts, birth, dur, w0, w1, wp) {
      path(pts, birth, dur, w0, 'stem', 'trunk', w1, wp);
      anatomy.trunks.push(pts);
      return { pts, birth, dur, w0, w1 };
    }
    function leader(A, T, d0, d1, o) {
      const b = limb(A, T, d0, d1, Object.assign({ tone: 'stem', kind: 'leader' }, o));
      anatomy.leaders.push({ points: b.pts, birth: b.birth, dur: b.dur });
      return b;
    }

    // --- сакура: короткий ствол, низкие развилки, широкий купол цветущих зонтиков ---
    function sakura() {
      const hT = rr(54, 66), top = [rr(-9, 9), hT, rr(-5, 5)];
      const tp = resample(bez([[0, 0, 0], [rr(-5, 5), hT * .38, rr(-3, 3)], [top[0] * .6 + rr(-4, 4), hT * .72, top[2] * .5], top], 28), 12);
      const trunk = trunkOf(tp, .15, 1.2, 15, 10, 1.5);
      roots(tp, 5, 7, 1.7, 20);
      sprout(tp, false);
      youngStem(trunk, [.4, .7]);
      const crown = { cy: hT + 82, rx: 178, ryT: 70, ryB: 56, rz: .84 };
      const nL = R() < .55 ? 6 : 5, az0 = R() * TAU;
      for (let i = 0; i < nL; i++) {
        const central = i === 0;
        const f = central ? 1 : Math.min(1, .7 + .28 * (i - 1) / Math.max(1, nL - 2) + rr(-.03, .02));
        const A = at(tp, f), az = az0 + i * TAU / nL + rr(-.3, .3);
        let T;
        if (central) T = [A[0] + Math.cos(az) * rr(8, 26), hT + rr(122, 138), A[2] + Math.sin(az) * rr(8, 20)];
        else { const reach = rr(112, 152); T = [Math.cos(az) * reach, hT + rr(52, 98), Math.sin(az) * reach * crown.rz]; }
        const chord = norm(sub(T, A));
        const b = leader(A, T, norm(lerp(chord, UP, central ? .25 : .5)), central ? chord : norm([chord[0], chord[1] * .2 - .08, chord[2]]),
          { birth: when(trunk, f) + .03, speed: 92, w0: central ? 9 : rr(7, 8.6), w1: 1.4, wiggle: 2.2, n: 18 });
        if (central) youngStem(b, [.12, .26, .4, .54, .68, .82, .95]);
        else youngLeaves(b, [.3, .42, .54, .66, .78, .9], [5.3, 6.05]);
        sakuraKids(b, 1, crown);
      }
      for (let j = 0; j < 220; j++) {
        const a = R() * TAU, r = crown.rx * .9 * Math.pow(R(), .7);
        fallen.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * crown.rz, birth: rr(6.9, 7.9), idx: (R() * 97) | 0,
          s: rr(.7, 1.15), rot: R() * Math.PI, pal: R() < .5 ? 'top' : 'mid' });
      }
    }
    const SAKURA = [null,
      { n: [7, 9], f: [.12, .97], ang: [.55, 1], len: [58, 98], shrink: .45, w: .52, speed: 62, tone: 'branch', np: 10, wig: 1.6 },
      { n: [4, 6], f: [.18, 1], ang: [.5, 1], len: [20, 38], shrink: .35, w: .5, speed: 46, tone: 'twig', np: 6, wig: .7 },
      { n: [2, 3], f: [.35, 1], ang: [.5, 1.05], len: [8, 15], shrink: .25, w: .55, speed: 36, tone: 'twig', np: 4, wig: .3 }];
    function sakuraKids(parent, depth, crown) {
      const S = SAKURA[depth];
      if (!S) return;
      const n = S.n[0] + ((R() * (S.n[1] - S.n[0] + 1)) | 0);
      let phase = R() * TAU;
      for (let i = 0; i < n; i++) {
        const f = clamp(S.f[0] + (S.f[1] - S.f[0]) * (i + rr(.15, .85)) / n, .05, 1);
        const A = at(parent.pts, f), d = dirAt(parent.pts, f), [u, v] = perp(d);
        phase += GOLD;
        const ang = rr(S.ang[0], S.ang[1]);
        let dir = add(mul(d, Math.cos(ang)), add(mul(u, Math.sin(ang) * Math.cos(phase)), mul(v, Math.sin(ang) * Math.sin(phase))));
        const out = [A[0], 0, A[2] / crown.rz], ol = vlen(out);
        dir = norm(add(dir, add(ol > 1 ? mul(out, .5 / ol) : [0, 0, 0], [0, .2, 0])));
        const T = clampTo(add(A, mul(dir, rr(S.len[0], S.len[1]) * (1 - S.shrink * f))), crown);
        const chord = norm(sub(T, A));
        const b = limb(A, T, dir, norm([chord[0], chord[1] - .4, chord[2]]), { birth: when(parent, f) + .03, speed: S.speed,
          w0: Math.max(.3, wAt(parent, f) * S.w), w1: .28, tone: S.tone, kind: 'branch', n: S.np, wiggle: S.wig });
        if (depth === 1) { youngLeaves(b, [.3, .6, .9], [5.3, 6.05]); sakuraClusters(b, [rr(.72, .95)], crown); }
        if (depth === 2) youngLeaves(b, [.6], [5.3, 6.05]);
        if (depth >= 2) sakuraClusters(b, depth === 3 ? [.45, .75, 1] : [rr(.3, .55), rr(.65, .95)], crown);
        sakuraKids(b, depth + 1, crown);
      }
    }
    // Зонтик из 3–5 цветков на длинных цветоножках, как у настоящей сакуры.
    function sakuraClusters(b, fs, crown) {
      for (const f of fs) {
        const Q = at(b.pts, f), t = when(b, f) + .06;
        const out = norm(add(norm([Q[0], (Q[1] - crown.cy) * .6, Q[2]]), [0, .3, 0]));
        const n = 4 + ((R() * 3) | 0);
        for (let m = 0; m < n; m++) {
          const dir = norm(add(randUnit(), mul(out, .85))), pl = rr(3.5, 7.5), F = add(Q, mul(dir, pl));
          path([Q, add(lerp(Q, F, .5), [0, -pl * .14, 0]), F], t, .2, .12, 'ped', 'pedicel');
          const fl = blossom(F, t + .16, rr(1.5, 2.3), domeV(F, crown));
          fl.ob = 6 + R() * .85 + (1 - fl.v) * .25;
          if (R() < .07) fl.keep = true;
        }
        if (R() < .55) haze(Q, rr(8, 13), t + .2);
      }
    }

    // --- японский клён: очень низкая развилка, плоские ярусы, парные ветки ---
    function maple() {
      const hT = rr(24, 31), top = [rr(-6, 6), hT, rr(-4, 4)];
      const tp = resample(bez([[0, 0, 0], [rr(-5, 5), hT * .4, rr(-3, 3)], [top[0] * .5 + rr(-4, 4), hT * .75, top[2] * .5], top], 24), 8);
      const trunk = trunkOf(tp, .15, .8, 13.5, 10, 1.4);
      roots(tp, 5, 6.5, 1.4, 19);
      sprout(tp, false);
      youngStem(trunk, [.5, .9]);
      const crown = { cy: hT + 100, rx: 208, ryT: 74, ryB: 56, rz: .85 };
      const nL = R() < .45 ? 6 : 5, az0 = R() * TAU;
      for (let i = 0; i < nL; i++) {
        const central = i === 0;
        const f = central ? 1 : Math.min(1, .45 + .55 * (i - 1) / Math.max(1, nL - 2) + rr(-.04, .03));
        const A = at(tp, f), az = az0 + i * TAU / nL + rr(-.28, .28);
        let T;
        if (central) T = [A[0] + Math.cos(az) * rr(20, 45), hT + rr(125, 140), A[2] + Math.sin(az) * rr(15, 35)];
        else { const reach = rr(135, 188); T = [Math.cos(az) * reach, hT + rr(60, 132), Math.sin(az) * reach * crown.rz]; }
        const chord = norm(sub(T, A));
        const b = leader(A, T, norm(lerp(chord, UP, central ? .2 : .55)), central ? chord : norm([chord[0], -.28, chord[2]]),
          { birth: when(trunk, f) + .03, speed: 92, w0: central ? 7.6 : rr(6.6, 8.2), w1: 1.4, wiggle: 7, freq: 5, n: 22 });
        if (central) youngStem(b, [.15, .35, .55, .75, .95]);
        mapleKids(b, 1, crown);
      }
      for (let j = 0; j < 260; j++) {
        const a = R() * TAU, r = crown.rx * .92 * Math.sqrt(R());
        fallen.push({ x: Math.cos(a) * r, z: Math.sin(a) * r * crown.rz, birth: rr(6.8, 7.9), idx: (R() * 97) | 0,
          s: rr(1.3, 2), rot: R() * Math.PI, pal: R() < .6 ? 'mid' : 'deep' });
      }
    }
    const MAPLE = [null,
      { pairs: [4, 5], f: [.2, .95], ang: [.8, 1.15], len: [55, 96], shrink: .45, w: .5, speed: 62, tone: 'branch', np: 12, wig: 3 },
      { pairs: [2, 3], f: [.25, 1], ang: [.7, 1.1], len: [16, 32], shrink: .35, w: .5, speed: 46, tone: 'twig', np: 6, wig: 1 },
      { pairs: [1, 1], f: [.55, .95], ang: [.6, 1], len: [7, 12], shrink: .2, w: .55, speed: 36, tone: 'twig', np: 4, wig: .4 }];
    function mapleKids(parent, depth, crown) {
      const S = MAPLE[depth];
      if (!S) return;
      const n = S.pairs[0] + ((R() * (S.pairs[1] - S.pairs[0] + 1)) | 0);
      for (let i = 0; i < n; i++) {
        const f = clamp(S.f[0] + (S.f[1] - S.f[0]) * (i + rr(.2, .8)) / n, .05, 1);
        const A = at(parent.pts, f), d = dirAt(parent.pts, f);
        let h = cross(d, UP);
        h = vlen(h) < .1 ? [1, 0, 0] : norm(h);
        const tilt = rr(-.5, .5);
        // супротивные ветки: пара в одной точке, в разные стороны
        for (const s of [-1, 1]) {
          const ang = rr(S.ang[0], S.ang[1]);
          let dir = add(mul(d, Math.cos(ang)), mul(h, s * Math.sin(ang)));
          dir = norm([dir[0], dir[1] * .3 + rr(-.06, .3) + tilt * s * .15, dir[2]]);
          const out = [A[0], 0, A[2]], ol = vlen(out);
          dir = norm(add(dir, ol > 1 ? mul(out, .35 / ol) : [0, 0, 0]));
          const T = clampTo(add(A, mul(dir, rr(S.len[0], S.len[1]) * (1 - S.shrink * f))), crown);
          const chord = norm(sub(T, A));
          const b = limb(A, T, dir, norm([chord[0], chord[1] - .3, chord[2]]), { birth: when(parent, f) + .03, speed: S.speed,
            w0: Math.max(.3, wAt(parent, f) * S.w), w1: .28, tone: S.tone, kind: 'branch', n: S.np, wiggle: S.wig });
          if (depth >= 2) spray(b, 1, crown);
          if (depth === 2) spray(b, rr(.35, .6), crown);
          if (depth === 1) spray(b, rr(.75, .95), crown);
          mapleKids(b, depth + 1, crown);
        }
      }
    }
    // Плоская веточка резных листьев с опущенными краями.
    function spray(b, f, crown) {
      const Q = at(b.pts, f), t = when(b, f) + .06, d = dirAt(b.pts, f), base = Math.atan2(d[2], d[0]);
      const n = 8 + ((R() * 6) | 0);
      for (let m = 0; m < n; m++) {
        const phi = base + rr(-1.9, 1.9), r = rr(3, 13);
        const F = add(Q, [Math.cos(phi) * r, rr(-3, 4.5) - r * .26, Math.sin(phi) * r]);
        path([Q, F], t, .18, .1, 'ped', 'petiole');
        const fl = blossom(F, t + .14, rr(2.3, 3.3), domeV(F, crown));
        fl.ob = 6 + R() * 1.1 + (1 - fl.v) * .35;
        if (R() < .05) fl.keep = true;
      }
      if (R() < .35) haze(Q, rr(7, 11), t + .2);
    }

    // --- сосна-бонсай: изогнутый ствол, корни-нэбари, плоские лапы хвои, джин ---
    function pine() {
      const s = R() < .5 ? -1 : 1;
      const keys = [[0, 0, 0], [s * rr(-34, -24), rr(42, 52), rr(-6, 6)], [s * rr(24, 36), rr(96, 108), rr(-6, 6)],
        [s * rr(-18, -8), rr(146, 156), rr(-6, 6)], [s * rr(4, 12), rr(184, 192), rr(-4, 4)], [rr(-4, 4), rr(206, 214), 0]];
      const tp = resample(catmull(keys, 10), 32);
      const trunk = trunkOf(tp, .15, 2.6, 16, 3.2, 1.7);
      const wTrunk = c => 3.2 + 12.8 * Math.pow(1 - c, 1.7);
      roots(tp, 6, 9, 1.3, 28);
      sprout(tp, true, 7);
      needles(trunk, .08, .96, .07, [3.3, 4.6]);
      const chordX = c => tp[0][0] + (tp[tp.length - 1][0] - tp[0][0]) * c;
      const pads = [];
      let lastY = -1e9;
      [.34, .48, .61, .73, .84].forEach((c, i) => {
        c += rr(-.02, .02);
        const A = at(tp, c);
        let side = Math.sign(A[0] - chordX(c)) || 1;
        if (i > 0 && side === pads[i - 1].side) side = -side;
        const back = i === 3;
        const rx = rr(54, 62) * (1 - i * .1), ry = rr(11, 13) * (1 - i * .05), rz = rx * rr(.58, .66);
        const cy = Math.max(A[1] + rr(-10, 3), lastY + 26);
        const C = back ? [A[0] + side * rx * .3, cy, A[2] - rz - 12] : [A[0] + side * (rx * .8 + 14), cy, A[2] + rr(-12, 12)];
        lastY = cy;
        pads.push({ C, rx, ry, rz, side, c, A });
      });
      const T0 = tp[tp.length - 1];
      pads.push({ C: [T0[0] + rr(-3, 3), Math.max(T0[1] + 12, lastY + 26), T0[2]], rx: rr(32, 37), ry: rr(14, 16), rz: rr(26, 30), side: 0, c: 1, A: T0 });
      pads.forEach(pd => {
        const { C, A, c } = pd;
        const out = vlen([C[0] - A[0], 0, C[2] - A[2]]) > 1 ? norm([C[0] - A[0], 0, C[2] - A[2]]) : [0, 0, 0];
        const apex = c === 1;
        const b = limb(A, C, apex ? norm(add(out, UP)) : norm(add(out, [0, -.45, 0])), apex ? UP : norm(add(out, [0, .35, 0])),
          { birth: when(trunk, c) + .03, speed: 62, w0: apex ? 3 : Math.min(wTrunk(c) * .55, 6), w1: 1.8, tone: 'stem',
            kind: 'pine-limb', wiggle: apex ? 0 : 2.5, n: apex ? 6 : 14, k0: .35, k1: .35 });
        anatomy.pads.push({ center: C, radii: [pd.rx, pd.ry, pd.rz] });
        if (!apex) needles(b, .3, .9, .2, [3.9, 4.9]);
        padFill(pd, b);
      });
      if (R() < .75) {
        const c = rr(.2, .3), A = at(tp, c), side = -(pads[0].side || 1);
        const E = add(A, [side * rr(16, 24), rr(10, 20), rr(-8, 8)]), M = add(lerp(A, E, .5), [rr(-4, 4), rr(-2, 5), 0]);
        path(resample(bez([A, M, M, E], 12), 6), when(trunk, c) + .5, .6, 3, 'jin', 'jin', .5, 1.3);
      }
    }
    function padFill(pd, b) {
      const { C, rx, ry, rz } = pd, t0 = when(b, 1), tips = [];
      const nb = 7 + ((R() * 3) | 0), base = Math.atan2(C[2] - pd.A[2], C[0] - pd.A[0]);
      for (let j = 0; j < nb; j++) {
        const phi = base + (j / nb - .5) * TAU * .95 + rr(-.2, .2), reach = rr(.6, .85);
        const E = [C[0] + Math.cos(phi) * rx * reach, C[1] + rr(.05, .35) * ry, C[2] + Math.sin(phi) * rz * reach];
        const d = norm(sub(E, C));
        const sb = limb(C, E, norm(add(d, [0, .3, 0])), norm(add(d, [0, -.1, 0])), { birth: t0 + rr(0, .15), speed: 40,
          w0: 1.25, w1: .45, tone: 'branch', kind: 'pad-branch', wiggle: 1.6, n: 6 });
        for (let q = 2; q < sb.pts.length; q++) tips.push([sb.pts[q], when(sb, q / (sb.pts.length - 1))]);
        const h = norm(cross(d, UP));
        for (let q = 0; q < 2; q++) {
          const f = rr(.45, .9), B = at(sb.pts, f);
          let E2 = add(B, add(mul(h, (q ? 1 : -1) * rr(7, 14)), mul(d, rr(3, 8))));
          const e = Math.hypot((E2[0] - C[0]) / rx, (E2[2] - C[2]) / rz);
          if (e > .92) E2 = [C[0] + (E2[0] - C[0]) * .92 / e, E2[1], C[2] + (E2[2] - C[2]) * .92 / e];
          const dd = norm(sub(E2, B));
          const tw = limb(B, E2, dd, dd, { birth: when(sb, f) + .02, speed: 30, w0: .6, w1: .3, tone: 'twig', kind: 'pad-twig', n: 4 });
          for (let k = 1; k < tw.pts.length; k++) tips.push([tw.pts[k], when(tw, k / (tw.pts.length - 1))]);
        }
      }
      // Пучки хвои плотнее у верхней поверхности лапы, низ плоский.
      const N = Math.round(380 + rx * rz * .12);
      for (let j = 0; j < N; j++) {
        const a = R() * TAU, r = Math.sqrt(R()), x = Math.cos(a) * r, z = Math.sin(a) * r;
        const topY = -.22 + 1.2 * Math.sqrt(Math.max(0, 1 - r * r)), y = topY - R() * R() * .9 * (topY + .22);
        const F = [C[0] + x * rx, C[1] + y * ry, C[2] + z * rz];
        let best = tips[0], bd = Infinity;
        for (const tip of tips) {
          const q = tip[0], dd = (q[0] - F[0]) ** 2 + 4 * (q[1] - F[1]) ** 2 + (q[2] - F[2]) ** 2;
          if (dd < bd) { bd = dd; best = tip; }
        }
        const bt = R() < .3 ? Math.max(best[1] + .1, rr(4.9, 6.2)) : best[1] + rr(.08, .6);
        path([best[0], F], bt, .2, .16, 'ped', 'needle-stalk');
        blossom(F, bt + .1, rr(1.8, 2.8), clamp(y * 1.3 - .2, -1, 1));
        if (R() < .1) {
          const cd = blossom(add(F, [rr(-.5, .5), rr(1.6, 3), rr(-.5, .5)]), rr(6.4, 7.4), rr(.8, 1.1), 1, 'top');
          cd.cd = true;
        }
      }
      for (let j = 0; j < 10; j++) {
        const a = R() * TAU, r = Math.sqrt(R()) * .7;
        haze([C[0] + Math.cos(a) * r * rx, C[1] + ry * rr(.1, .6), C[2] + Math.sin(a) * r * rz], ry * rr(1.2, 1.7), t0 + rr(.3, 1.2));
      }
    }

    // --- глициния: перекрученный ствол-лиана, купол дуг и свисающие кисти ---
    function wisteria() {
      const hT = rr(106, 122);
      const tp = resample(catmull([[0, 0, 0], [rr(-9, 9), hT * .3, rr(-4, 4)], [rr(-11, 11), hT * .62, rr(-5, 5)], [rr(-6, 6), hT, rr(-3, 3)]], 10), 20);
      const trunk = trunkOf(tp, .15, 1.7, 9.6, 6.4, 1.2);
      const dense = resample(tp, 64);
      for (const [ph, r, w] of [[R() * TAU, 4.4, 3.8], [R() * TAU + 2.5, 3.3, 2.4]]) {
        const coil = dense.map((p, i) => {
          const t = i / 63, a = ph + t * TAU * 2.6, k = r * (1 - .25 * t);
          return add(p, [Math.cos(a) * k, 0, Math.sin(a) * k]);
        });
        path(coil, .3, 1.7, w, 'stem', 'twining-vine', w * .7, 1);
      }
      roots(tp, 5, 4.5, 1.5, 20);
      sprout(tp, false);
      youngStem(trunk, [.3, .55, .8]);
      const crown = { cy: hT + 50, rx: 150, ryT: 50, ryB: 70, rz: .85 };
      const nL = R() < .4 ? 7 : 6, az0 = R() * TAU, arms = [];
      for (let i = 0; i < nL; i++) {
        const f = Math.min(1, .8 + .2 * i / (nL - 1) + rr(-.02, .02));
        const A = at(tp, f), az = az0 + i * TAU / nL + rr(-.3, .3), reach = rr(85, 138);
        const T = [Math.cos(az) * reach, hT + rr(8, 42), Math.sin(az) * reach * crown.rz];
        const chord = norm(sub(T, A));
        const b = leader(A, T, norm(lerp(chord, UP, .8)), norm([chord[0], -.75, chord[2]]),
          { birth: when(trunk, f) + .03, speed: 78, w0: rr(4, 5.2), w1: 1.1, wiggle: 3, n: 20, k0: .5, k1: .35 });
        arms.push([b, .45, 4]);
        const ns = 2 + ((R() * 2) | 0);
        for (let j = 0; j < ns; j++) {
          const q = .35 + .6 * (j + rr(.2, .8)) / ns, B = at(b.pts, q), d = dirAt(b.pts, q);
          const out = norm([B[0], 0, B[2]]), side = norm(cross(d, UP));
          const dir = norm(add(add(mul(out, .7), mul(side, (j % 2 ? 1 : -1) * rr(.4, .8))), [0, rr(.1, .5), 0]));
          const len = rr(32, 58), T2 = add(B, add(mul(dir, len), [0, -len * .2, 0])), c2 = norm(sub(T2, B));
          const sb = limb(B, T2, norm(lerp(dir, UP, .3)), norm([c2[0], -.8, c2[2]]), { birth: when(b, q) + .03, speed: 55,
            w0: Math.max(.6, wAt(b, q) * .5), w1: .4, tone: 'branch', kind: 'branch', wiggle: 1.5, n: 9 });
          arms.push([sb, .3, 3]);
        }
      }
      for (const [b, f0, k] of arms) {
        for (let j = 0; j < k; j++) {
          const f = f0 + (1 - f0) * (j + rr(.15, .85)) / k, A = at(b.pts, f);
          raceme(A, when(b, f), Math.hypot(A[0], A[2] / crown.rz));
        }
        // перистые листья: черешок и пары листочков
        const nl = k + 2;
        for (let j = 0; j < nl; j++) {
          const f = .2 + .8 * (j + rr(.2, .8)) / nl, B = at(b.pts, f), t = when(b, f) + .1;
          const out = norm([B[0] + rr(-20, 20), 0, B[2] + rr(-20, 20)]);
          const rd = norm(add(add(mul(out, .8), mul(randUnit(), .3)), [0, rr(-.3, .25), 0])), rl = rr(19, 28);
          const rp = resample(bez([B, add(B, add(mul(rd, rl * .35), [0, 3, 0])), add(B, add(mul(rd, rl * .8), [0, -1, 0])),
            add(B, add(mul(rd, rl), [0, -5, 0]))], 12), 6);
          path(rp, t, .45, .4, 'twig', 'rachis', .2);
          const h = norm(cross(rd, UP)), o = { fade: [6.3, 7.3], fadeTo: .62 };
          for (let q = 0; q < 4; q++) {
            const u = .3 + q * .17, Pq = at(rp, u);
            for (const sd of [-1, 1]) leaf(Pq, norm(add(add(mul(h, sd), mul(rd, .5)), [0, -.25, 0])), rr(6, 8.5), rr(2.3, 3),
              t + .15 + u * .3, pick(P.leaf), o);
          }
          leaf(rp[rp.length - 1], norm(add(rd, [0, -.3, 0])), rr(6.5, 8.5), rr(2.4, 3), t + .5, pick(P.leaf), o);
        }
      }
    }
    // Кисть-конус: сверху крупные раскрытые цветки, к низу мелкие тёмные бутоны.
    function raceme(A, t, radial) {
      const Lr = clamp(40 + 62 * radial / 130 + rr(-8, 14), 38, 112), sx = rr(-5, 5), sz = rr(-5, 5), end = add(A, [sx, -Lr, sz]);
      const pts = resample(bez([A, add(A, [sx * .1, -Lr * .3, sz * .1]), add(end, [-sx * .25, Lr * .3, -sz * .25]), end], 24), 16);
      const rb = Math.max(t + .15, rr(4.3, 5.1));
      path(pts, rb, .9, .55, 'ped', 'raceme', .2);
      anatomy.racemes.push({ base: A, tip: end });
      const N = Math.round(Lr * 1.35), R0 = 6.5 + Lr * .04;
      for (let j = 0; j < N; j++) {
        const u = (j + .5) / N, az = j * GOLD + R() * .5, C = at(pts, u), r = R0 * Math.pow(1 - u, .7) + 1.3;
        const F = add(C, [Math.cos(az) * r, -r * .25 + rr(-1.2, 1.2), Math.sin(az) * r]), bt = rb + u * .75;
        path([C, F], bt, .15, .1, 'ped', 'raceme-pedicel');
        const fl = blossom(F, bt + .1, (2.1 - .9 * u) * rr(.85, 1.15), 1 - 2 * u, u < .28 ? 'top' : u < .7 ? 'mid' : 'deep');
        fl.ob = 6 + u * 1.3 + rr(0, .25);
        if (u > .84) fl.keep = true;
      }
      for (let j = 0; j < 3; j++) haze(at(pts, .1 + j * .22), R0 * 1.25, rb + .3 + j * .2, j ? 'mid' : 'top');
    }

    // --- бамбук: роща членистых стеблей, ветки из узлов, веера узких листьев ---
    function bamboo() {
      const n = R() < .5 ? 8 : 7, mid = (n - 1) / 2, sp = rr(16, 19.5);
      const order = Array.from({length: n}, (_, i) => i).map(i => [i, Math.abs(i - mid) + R() * .9]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
      order.forEach((i, rank) => {
        const x = (i - mid) * sp + rr(-3.5, 3.5), z = rr(-26, 26);
        const H = clamp(332 - Math.abs(i - mid) * rr(15, 24) + rr(-10, 8), 232, 336);
        const w0 = clamp(4.6 - Math.abs(i - mid) * .32 + rr(-.3, .3), 2.6, 4.8), w1 = w0 * .5;
        const lx = x * .1 + rr(-9, 9), lz = rr(-9, 9);
        const pts = resample(bez([[x, 0, z], [x + lx * .08, H * .35, z + lz * .08], [x + lx * .5, H * .72, z + lz * .5], [x + lx, H, z + lz]], 40), 44);
        const b0 = .15 + rank * .45, dur = 2.4 + H / 330 * .7;
        path(pts, b0, dur, w0, 'stem', 'culm', w1, 1);
        const culm = { pts, birth: b0, dur, w0, w1 };
        anatomy.culms.push(pts);
        if (!rank) sprout(pts, true);
        let y = rr(7, 10), k = 0;
        const phi0 = R() * TAU;
        while (y < H - 10) {
          const f = y / H, A = at(pts, f), w = wAt(culm, f);
          path([add(A, [-w * .6, 0, 0]), add(A, [w * .6, 0, 0])], when(culm, f) + .01, .1, w, 'node', 'node');
          if (f > .36) {
            const phi = phi0 + k * Math.PI + rr(-.5, .5), d = norm([Math.cos(phi), rr(.55, .95), Math.sin(phi) * .8]);
            const bl = rr(24, 46) * (1 - .3 * f), E = add(A, add(mul(d, bl), [0, -bl * .25, 0]));
            const br = limb(A, E, d, norm(add(d, [0, -.9, 0])), { birth: when(culm, f) + .12, speed: 60, w0: .95, w1: .32,
              tone: 'twig', kind: 'bamboo-branch', n: 6, wiggle: 1 });
            const nt = 2 + ((R() * 2) | 0);
            for (let q = 0; q < nt; q++) {
              const ff = .4 + .6 * (q + rr(.2, .8)) / nt, B = at(br.pts, ff);
              const td = norm(add(add(dirAt(br.pts, ff), mul(randUnit(), .7)), [0, -.25, 0])), T = add(B, mul(td, rr(7, 13)));
              const tw = limb(B, T, td, norm(add(td, [0, -.6, 0])), { birth: when(br, ff) + .03, speed: 40, w0: .5, w1: .25,
                tone: 'twig', kind: 'bamboo-twig', n: 4 });
              leafSpray(T, td, when(tw, 1) + .02, 3 + ((R() * 4) | 0));
            }
            leafSpray(E, d, when(br, 1) + .02, 3 + ((R() * 3) | 0));
          }
          k++;
          y += 10 + 19 * (1 - Math.exp(-k / 2.6)) * (1 - .25 * f) + rr(-1.5, 1.5);
        }
        leafSpray(pts[pts.length - 1], norm([rr(-.3, .3), 1, rr(-.3, .3)]), b0 + dur + .05, 5);
      });
      for (let j = 0; j < 3; j++) {
        const x = rr(-70, 70), z = rr(-20, 30), h = rr(9, 17);
        path([[x, 0, z], [x + rr(-1, 1), h * .5, z], [x + rr(-2, 2), h, z]], rr(6.4, 7.3), .5, rr(4.5, 6), 'sheath', 'shoot', .4, 1);
      }
    }
    function leafSpray(Q, d, t, n) {
      let h = cross(d, UP);
      h = vlen(h) < .1 ? [1, 0, 0] : norm(h);
      const base = norm([d[0], -.15, d[2]]);
      for (let m = 0; m < n; m++) {
        const s = (m / Math.max(1, n - 1) - .5) * 2;
        const dir = norm(add(add(base, mul(h, s * rr(.6, 1.1))), [0, -rr(.25, .7), 0]));
        const l = rr(13, 22), w = Math.min(rr(1.9, 2.8), l / 5.8);
        leaf(Q, dir, l, w, t + m * .04, pick(P.leaf), { blade: true, droop: rr(.15, .35), dur: .5 });
      }
    }

    ({ sakura, maple, pine, wisteria, bamboo })[species]();

    // Граница последней стадии общая для всех пород; геометрия не пересчитывается.
    let end = 0;
    for (const line of lines) end = Math.max(end, line.birth + line.dur);
    for (const f of flowers) end = Math.max(end, f.birth + .3);
    for (const leaf of leaves) end = Math.max(end, leaf.birth + leaf.dur);
    if (end > 7.9) {
      const k = (7.9 - 3) / (end - 3), time = t => t > 3 ? 3 + (t - 3) * k : t;
      for (const line of lines) { const finish = time(line.birth + line.dur); line.birth = time(line.birth); line.dur = Math.max(.025, finish - line.birth); }
      for (const f of flowers) f.birth = time(f.birth);
      for (const h of hazes) h.birth = time(h.birth);
      for (const leaf of leaves) { const finish = time(leaf.birth + leaf.dur); leaf.birth = time(leaf.birth); leaf.dur = Math.max(.025, finish - leaf.birth); }
    }
    // Цвет приходит только со стадии цветения; часть бутонов так и не раскрывается.
    for (const f of flowers) {
      f.open = P.bloomAt ? clamp(Math.max(f.ob == null ? 6.3 : f.ob, f.birth + .15), P.bloomAt, 7.62) : f.birth;
      delete f.ob;
    }
    for (const h of hazes) if (P.bloomAt) h.open = Math.max(h.open, 6.2);
    let rad = 40, top = 40;
    for (const f of flowers) { rad = Math.max(rad, Math.hypot(f.x, f.z)); top = Math.max(top, f.y); }
    for (const l of leaves) { rad = Math.max(rad, Math.hypot(l.p[0], l.p[2]) + l.l * .5); top = Math.max(top, l.p[1]); }
    return { P, H: top, R: rad, lines, flowers, leaves, hazes, fallen, anatomy, theta0: (R() - .5) * .28 };
  }

  // ---------- формы спрайтов ----------
  // col(доля цвета, прозрачность): 1 — цвет точки, 0 — светлый оттенок породы.
  function halo(x, col, a0, a1) {
    const gr = x.createRadialGradient(0, 0, 0, 0, 0, 24);
    gr.addColorStop(0, col(1, a0)); gr.addColorStop(.42, col(1, a1)); gr.addColorStop(1, col(1, 0));
    x.fillStyle = gr; x.fillRect(-24, -24, 48, 48);
  }
  const SHAPES = [
    (x, col) => { // 0 цветок сакуры: пять лепестков с выемкой, светлые кончики, тычинки
      halo(x, col, .13, .04);
      for (let i = 0; i < 5; i++) {
        x.save(); x.rotate(i * TAU / 5);
        const gr = x.createLinearGradient(0, -1, 0, -13);
        gr.addColorStop(0, col(1, .97)); gr.addColorStop(1, col(.5, .95));
        x.fillStyle = gr; x.beginPath(); x.moveTo(0, -1.2);
        x.bezierCurveTo(-6.2, -3.6, -6.6, -10.8, -2.7, -12.8); x.lineTo(0, -11); x.lineTo(2.7, -12.8);
        x.bezierCurveTo(6.6, -10.8, 6.2, -3.6, 0, -1.2); x.fill(); x.restore();
      }
      x.fillStyle = col(1, 1); x.beginPath(); x.arc(0, 0, 2.6, 0, TAU); x.fill();
      x.fillStyle = col(0, .95);
      for (let i = 0; i < 9; i++) { const a = i * TAU / 9; x.beginPath(); x.arc(Math.cos(a) * 3.6, Math.sin(a) * 3.6, .75, 0, TAU); x.fill(); }
    },
    (x, col) => { // 1 резной лист японского клёна, семь лопастей
      halo(x, col, .12, .04);
      const gr = x.createRadialGradient(0, 2, 0, 0, 2, 15);
      gr.addColorStop(0, col(1, .97)); gr.addColorStop(1, col(.72, .95));
      x.fillStyle = gr; x.beginPath();
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * .78, L = i === 0 || i === 6 ? 7.5 : i === 3 ? 14 : 12;
        if (!i) x.moveTo(Math.cos(a - .39) * 3, 2 + Math.sin(a - .39) * 3);
        x.quadraticCurveTo(Math.cos(a - .14) * L * .7, 2 + Math.sin(a - .14) * L * .7, Math.cos(a) * L, 2 + Math.sin(a) * L);
        x.quadraticCurveTo(Math.cos(a + .14) * L * .7, 2 + Math.sin(a + .14) * L * .7, Math.cos(a + .39) * 3, 2 + Math.sin(a + .39) * 3);
      }
      x.closePath(); x.fill();
      x.strokeStyle = col(1, .9); x.lineWidth = 1; x.beginPath(); x.moveTo(0, 2); x.lineTo(0, 9); x.stroke();
    },
    (x, col) => { // 2 мягкая точка
      halo(x, col, .38, .13);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, 9);
      gr.addColorStop(0, col(1, 1)); gr.addColorStop(.6, col(1, .85)); gr.addColorStop(1, col(1, 0));
      x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 9, 0, TAU); x.fill();
    },
    (x, col) => { // 3 бутон с бликом
      halo(x, col, .24, .06);
      const gr = x.createRadialGradient(-1.6, -2, 0, 0, 0, 9.5);
      gr.addColorStop(0, col(.35, .96)); gr.addColorStop(.45, col(1, 1)); gr.addColorStop(1, col(1, 0));
      x.fillStyle = gr; x.beginPath(); x.ellipse(0, 0, 7.5, 9.5, 0, 0, TAU); x.fill();
    },
    (x, col) => { // 4 боке: цветок вне фокуса
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, 22);
      gr.addColorStop(0, col(1, .75)); gr.addColorStop(.55, col(1, .5)); gr.addColorStop(.8, col(1, .18)); gr.addColorStop(1, col(1, 0));
      x.fillStyle = gr; x.fillRect(-24, -24, 48, 48);
    },
    (x, col) => { // 5 пучок хвои: веер иголок со светлыми кончиками
      halo(x, col, .1, .03);
      x.lineCap = 'round'; x.lineWidth = 1.05;
      for (let i = 0; i < 26; i++) {
        const u = i / 25, a = -Math.PI / 2 + (u - .5) * 3.6 + Math.sin(i * 12.9898) * .09;
        const len = 11 + (1 - Math.abs(u - .5) * 2) * 8 + Math.sin(i * 78.233) * 1.5;
        const ex = Math.cos(a) * len, ey = 5 + Math.sin(a) * len * .85;
        const gr = x.createLinearGradient(0, 5, ex, ey);
        gr.addColorStop(0, col(1, .95)); gr.addColorStop(1, col(.45, .9));
        x.strokeStyle = gr; x.beginPath(); x.moveTo(0, 5); x.lineTo(ex, ey); x.stroke();
      }
    },
    (x, col) => { // 6 цветок глицинии: парус с жёлтым пятнышком и лодочка
      halo(x, col, .13, .04);
      x.fillStyle = col(1, .96); x.beginPath(); x.ellipse(0, -3.5, 8.6, 7.4, 0, 0, TAU); x.fill();
      x.fillStyle = col(.05, .9); x.beginPath(); x.ellipse(0, -2.2, 2.4, 1.9, 0, 0, TAU); x.fill();
      x.fillStyle = col(.92, .97);
      x.beginPath(); x.ellipse(-3.4, 4.6, 3.4, 4.8, .45, 0, TAU); x.fill();
      x.beginPath(); x.ellipse(3.4, 4.6, 3.4, 4.8, -.45, 0, TAU); x.fill();
    },
    (x, col) => { // 7 «свечка» сосны: светлый молодой побег
      halo(x, col, .2, .05);
      const gr = x.createLinearGradient(0, 10, 0, -11);
      gr.addColorStop(0, col(1, .95)); gr.addColorStop(1, col(.3, .95));
      x.fillStyle = gr; x.beginPath(); x.ellipse(0, 0, 3.2, 10.5, 0, 0, TAU); x.fill();
    },    (x, col) => { // 8 молодой лист: заострённый овал с жилкой
      halo(x, col, .1, .03);
      x.save(); x.rotate(-.5);
      const gr = x.createLinearGradient(-6, 0, 6, 0);
      gr.addColorStop(0, col(1, .96)); gr.addColorStop(1, col(.82, .96));
      x.fillStyle = gr; x.beginPath(); x.moveTo(0, 13);
      x.quadraticCurveTo(9, 2, 0, -13); x.quadraticCurveTo(-9, 2, 0, 13); x.fill();
      x.strokeStyle = col(.45, .8); x.lineWidth = .9; x.beginPath(); x.moveTo(0, 12); x.lineTo(0, -10); x.stroke();
      x.restore();
    },
  ];
  // Запасной путь без WebGL: те же формы, раскрашенные заранее.
  const sprites = new Map();
  function sprite(cell, color, light) {
    const key = cell + color + light;
    let c = sprites.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 48;
    const x = c.getContext('2d'), A = hex(color), B = hex(light);
    x.translate(24, 24); x.scale(.86, .86);
    SHAPES[cell](x, (fr, a) => `rgba(${A.map((v, i) => Math.round(B[i] + (v - B[i]) * fr)).join(',')},${a})`);
    sprites.set(key, c);
    return c;
  }
  const shadeCache = new Map();
  function shades(P, color) {
    const key = P.shade + color;
    let s = shadeCache.get(key);
    if (!s) {
      s = [mixHex(color, P.shade, .55), mixHex(color, P.shade, .25), color, mixHex(color, '#ffffff', .14)];
      shadeCache.set(key, s);
    }
    return s;
  }
  function spriteTable(P) {
    const flat = [...P.top, ...P.mid, ...P.deep];
    const blush = P.blush || P.bud, keep = P.keepCol || P.top, candle = P.candle || P.top;
    const each = (colors, cell) => colors.flatMap(c => shades(P, c).map(s => sprite(cell, s, P.light)));
    const rgb = colors => Float32Array.from(colors.flatMap(c => shades(P, c).flatMap(s => hex(s).map(v => v / 255))));
    const budBlush = P.bud.map((_, i) => blush[i % blush.length]);
    const S = { base: { top: 0, mid: P.top.length, deep: P.top.length + P.mid.length },
      rgbPetal: rgb(flat), rgbBud: rgb(P.bud), rgbBlush: rgb(budBlush), rgbKeep: rgb(keep), rgbCandle: rgb(candle),
      budNow: new Float32Array(P.bud.length * 12), light: hex(P.light).map(v => v / 255),
      nKeep: keep.length, nCandle: candle.length, img: null,
      rgbLeaf: P.foliage ? rgb(P.foliage.cols) : null, nLeaf: P.foliage ? P.foliage.cols.length : 0 };
    // Готовые картинки нужны только без WebGL — собираем их при первой надобности.
    S.images = () => S.img || (S.img = { petal: each(flat, P.petal), bokeh: each(flat, 4), bud: each(P.bud, P.budCell),
      blush: each(budBlush, P.budCell), budBokeh: each(P.bud, 4), keep: each(keep, P.budCell), keepBokeh: each(keep, 4),
      candle: each(candle, 7), leaf: P.foliage ? each(P.foliage.cols, 8) : null });
    return S;
  }

  // ---------- WebGL: общий холст для всех растений на странице ----------
  let GLS = null, glFailed = false;
  const ATLAS_CELLS = 16, CELL = 64; // ширина атласа — степень двойки, иначе WebGL1 не строит мипмапы
  function atlas() {
    // Белые формы: A — покрытие, R — доля цвета точки (0 — светлый оттенок породы).
    const c = document.createElement('canvas');
    c.width = ATLAS_CELLS * CELL; c.height = CELL;
    const x = c.getContext('2d'), sc = CELL / 48 * .86;
    SHAPES.forEach((shape, i) => {
      x.save(); x.translate(i * CELL + CELL / 2, CELL / 2); x.scale(sc, sc);
      shape(x, (fr, a) => `rgba(${Math.round(255 * fr)},0,0,${a})`);
      x.restore();
    });
    return c;
  }
  function glInit() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 2;
    const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false,
      depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl) return null;
    const sh = (type, src) => {
      const o = gl.createShader(type); gl.shaderSource(o, src); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(o));
      return o;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, `attribute vec2 aPos;attribute float aSize;attribute vec3 aCol;attribute float aA;attribute float aCell;
uniform vec2 uRes;uniform float uMax;varying vec3 vCol;varying float vA;varying float vCell;
void main(){vec2 c=aPos/uRes*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);float s=min(aSize,uMax);
gl_PointSize=max(s,1.0);vCol=aCol;vA=aA*min(1.0,s*s);vCell=aCell;}`));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `precision mediump float;uniform sampler2D uTex;uniform vec3 uLight;varying vec3 vCol;varying float vA;varying float vCell;
void main(){vec2 uv=vec2((vCell+.04+gl_PointCoord.x*.92)/${ATLAS_CELLS}.0,.04+gl_PointCoord.y*.92);vec4 t=texture2D(uTex,uv);
vec3 rgb=mix(uLight,vCol,t.r);float a=t.a*vA;gl_FragColor=vec4(rgb*a,a);}`));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas());
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const attr = (name, size, off) => {
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 32, off * 4);
    };
    attr('aPos', 2, 0); attr('aSize', 1, 2); attr('aCol', 3, 3); attr('aA', 1, 6); attr('aCell', 1, 7);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const state = { canvas, gl, prog, data: new Float32Array(8 * 4096), uRes: gl.getUniformLocation(prog, 'uRes'),
      uMax: gl.getUniformLocation(prog, 'uMax'), uLight: gl.getUniformLocation(prog, 'uLight'),
      maxPoint: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64 };
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); GLS = null; glFailed = true; });
    return state;
  }
  function glReady(W, H, points) {
    if (glFailed) return null;
    if (!GLS) {
      try { GLS = glInit(); } catch (_) { GLS = null; }
      if (!GLS) { glFailed = true; return null; }
    }
    const c = GLS.canvas;
    if (c.width < W || c.height < H) { c.width = Math.max(c.width, W); c.height = Math.max(c.height, H); }
    if (GLS.data.length < points * 8) GLS.data = new Float32Array(Math.ceil(points * 1.25) * 8);
    return GLS;
  }
  function glDraw(G, W, H, n, light) {
    const gl = G.gl;
    gl.viewport(0, 0, W, H);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(G.uRes, W, H); gl.uniform1f(G.uMax, G.maxPoint);
    gl.uniform3f(G.uLight, light[0], light[1], light[2]);
    gl.bufferData(gl.ARRAY_BUFFER, G.data.subarray(0, n * 8), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, n);
  }

  // ---------- кадр ----------
  const DECOR_EMOJI = { moon: '🌕', fuji: '🗻', pagoda: '🏯', torii: '⛩', teahouse: '🍵', lantern: '🏮',
    stone: '🪨', bell: '🎐', koi: '🐟', dragon: '🐉' };
  const BACK = new Set(['moon', 'fuji', 'dragon', 'bell']);
  const layers = new WeakMap();
  const LX = -.62, LY = -.78; // свет сверху слева, в экранных координатах
  const JIN = ['#bdb4a4', '#efe8da', '#6f675b', '#8e8577'], SHEATH = ['#8c6a40', '#caa66c', '#4e3a22', '#a8844e'];
  const WOOD = { stem: 1, branch: 1, jin: 1, sheath: 1 };
  const BARKED = { trunk: 1, root: 1, leader: 1, 'pine-limb': 1, 'twining-vine': 1 };
  const GROUNDED = { trunk: 1, culm: 1, root: 1, shoot: 1, 'twining-vine': 1 };
  const RX = new Float32Array(80), RY = new Float32Array(80), RT = new Float32Array(80), RW = new Float32Array(80),
    NX = new Float32Array(80), NY = new Float32Array(80), HO = new Float32Array(80);

  function layer(canvas, w, h, name) {
    let L = layers.get(canvas);
    if (!L) { L = {}; layers.set(canvas, L); }
    let c = L[name];
    if (!c) { c = L[name] = document.createElement('canvas'); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }

  function extent(tree, g) {
    // Размер видимой части без учёта поворота: высота и радиус от оси.
    let top = 6, rad = 6;
    for (const L of tree.lines) {
      const f = (g - L.birth) / L.dur;
      if (f <= 0) continue;
      const k = f >= 1 ? L.n - 1 : Math.max(0, Math.floor(f * (L.n - 1)));
      for (let i = 0; i <= k; i += (L.tone === 'ped' ? 2 : 3)) {
        const y = L.xyz[i * 3 + 1], r = Math.hypot(L.xyz[i * 3], L.xyz[i * 3 + 2]);
        if (y > top) top = y;
        if (r > rad) rad = r;
      }
    }
    for (const f of tree.flowers) if (g > f.birth) {
      top = Math.max(top, f.y + f.s);
      rad = Math.max(rad, Math.hypot(f.x, f.z) + f.s);
    }
    for (const L of tree.leaves) {
      let a = smooth((g - L.birth) / L.dur);
      if (L.fade) a *= 1 - (1 - (L.fadeTo || 0)) * smooth((g - L.fade[0]) / (L.fade[1] - L.fade[0]));
      if (a < .01) continue;
      const tip = add(L.p, mul(L.dir, L.l * a));
      top = Math.max(top, tip[1] + L.w);
      rad = Math.max(rad, Math.hypot(tip[0], tip[2]) + L.w);
    }
    return { top, rad };
  }

  /* opts: growth, theta, width, height (css px), dpr, view {x,y,w,h}, ground {x,y},
     fit {top,bottom,half} — куда вписывать растение, decor, thirsty, preview, fast, no3d, noGlow */
  function draw(canvas, tree, o) {
    const dpr = o.dpr || 1;
    const W = Math.max(1, Math.round(o.width * dpr)), Hh = Math.max(1, Math.round(o.height * dpr));
    if (canvas.width !== W || canvas.height !== Hh) { canvas.width = W; canvas.height = Hh; }
    const ctx = canvas.getContext('2d');
    const P = tree.P, g = clamp(o.growth, 0, 8), v = o.view;
    // viewBox → пиксели, как preserveAspectRatio="xMidYMax meet"
    const k = Math.min(W / v.w, Hh / v.h);
    const ox = (W - v.w * k) / 2 - v.x * k, oy = (Hh - v.h * k) - v.y * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const bg = ctx.createRadialGradient(W / 2, Hh * .42, 0, W / 2, Hh * .45, Math.max(W, Hh) * .75);
    bg.addColorStop(0, o.preview ? '#0c1012' : '#0d1212'); bg.addColorStop(1, '#040506');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, Hh);
    ctx.setTransform(k, 0, 0, k, ox, oy);
    const gx = o.ground.x, gy = o.ground.y;
    if (!o.preview) {
      const ge = ctx.createRadialGradient(gx, gy + 4, 0, gx, gy + 4, 170);
      ge.addColorStop(0, 'rgba(34,52,44,.16)'); ge.addColorStop(1, 'rgba(34,52,44,0)');
      ctx.fillStyle = ge; ctx.beginPath(); ctx.ellipse(gx, gy + 5, 170, 16, 0, 0, TAU); ctx.fill();
    }
    drawDecor(ctx, o.decor, true);

    // масштаб: вписать видимую часть в отведённую область
    const ext = extent(tree, g), fit = o.fit;
    const zoom = Math.min(o.maxZoom || 2.4, (fit.bottom - fit.top) / (ext.top + 14), fit.half / (ext.rad + 10));
    const theta = o.theta, cs = Math.cos(theta), sn = Math.sin(theta), F = 1150, Rd = tree.R || P.R;
    // тень кроны на земле
    if (g > .4) {
      const r = Math.max(12, ext.rad * zoom * .85);
      ctx.save(); ctx.translate(gx, gy + 2); ctx.scale(1, .12);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      sg.addColorStop(0, 'rgba(0,0,0,.5)'); sg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // растение рисуем в отдельный слой: от него же строится свечение
    const plant = layer(canvas, W, Hh, 'plant');
    const pc = plant.getContext('2d');
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.clearRect(0, 0, W, Hh);
    pc.setTransform(k, 0, 0, k, ox, oy);
    pc.lineCap = 'round'; pc.lineJoin = 'round';
    const px = new Float32Array(3);
    // камера чуть выше земли: опавшие лепестки и корни ложатся на плоскость, а не в линию
    function project(x, y, z) {
      const xr = x * cs + z * sn, zr = -x * sn + z * cs, p = F / (F - zr * zoom);
      px[0] = gx + xr * p * zoom; px[1] = gy - (y * .993 - zr * .12) * p * zoom; px[2] = zr;
      return p;
    }

    // семечко
    if (g < 2.4) {
      pc.globalAlpha = clamp(1 - g / 2.4) * .9;
      pc.fillStyle = '#8a7255';
      pc.beginPath(); pc.ellipse(gx + 1, gy - 2.2, 4.4 * Math.min(zoom, 1.8), 3 * Math.min(zoom, 1.8), -.3, 0, TAU); pc.fill();
      pc.globalAlpha = 1;
    }

    // опавшие лепестки и листья на земле — у старого дерева
    if (tree.fallen.length && g > tree.fallen[0].birth - 1) {
      for (const f of tree.fallen) {
        const a = smooth((g - f.birth) / .5);
        if (a <= 0) continue;
        const p = project(f.x, .4, f.z), r = f.s * zoom * p * 1.1;
        const list = P[f.pal];
        pc.globalAlpha = a * .55;
        pc.fillStyle = shades(P, list[f.idx % list.length])[px[2] < 0 ? 0 : 1];
        pc.beginPath(); pc.ellipse(px[0], px[1], r, r * .42, f.rot, 0, TAU); pc.fill();
      }
      pc.globalAlpha = 1;
    }

    // древесина: ствол, корни и крупные ветви — сужающиеся ленты со светом и тенью
    const woodCache = tree.wood || (tree.wood = []);
    function woodColors(L) {
      if (L.tone === 'jin') return JIN;
      if (L.tone === 'sheath') return SHEATH;
      const q = Math.round(smooth((g - L.birth - (L.kind === 'trunk' ? .4 : .9)) / (P.woodSpan || 2.4)) * 12);
      return woodCache[q] || (woodCache[q] = [mixHex(P.young, P.bark, q / 12), mixHex(P.youngHi, P.barkHi, q / 12),
        mixHex(mixHex(P.young, '#000000', .45), P.barkLo, q / 12), P.markCol]);
    }
    function thick(L) {
      if (L.kind === 'culm') return .82 + .18 * smooth((g - L.birth) / 1.5);
      if (L.kind === 'shoot' || L.tone === 'jin') return 1;
      const span = L.kind === 'trunk' || L.kind === 'root' || L.kind === 'twining-vine' ? 6.6
        : L.kind === 'leader' || L.kind === 'pine-limb' ? 5 : 3.5;
      return .1 + .9 * Math.pow(smooth((g - L.birth) / span), 1.25);
    }
    function ribbon(L, f) {
      const xyz = L.xyz, cum = L.cum, n = L.n;
      let m = 0;
      for (let i = 0; i < n && m < 79; i++) {
        if (i === 0 || cum[i] <= f) {
          project(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]); RX[m] = px[0]; RY[m] = px[1]; RT[m] = cum[i]; m++;
        } else {
          const q = (i - 1) * 3, j = i * 3, t = (f - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1);
          project(xyz[q] + (xyz[j] - xyz[q]) * t, xyz[q + 1] + (xyz[j + 1] - xyz[q + 1]) * t, xyz[q + 2] + (xyz[j + 2] - xyz[q + 2]) * t);
          RX[m] = px[0]; RY[m] = px[1]; RT[m] = f; m++;
          break;
        }
      }
      if (m < 2) return;
      const sc = zoom * thick(L) * .5, wp = L.wp || 1, ff = Math.max(f, 1e-4);
      for (let i = 0; i < m; i++) {
        const t = RT[i] / ff;
        RW[i] = Math.max(.16, (L.w1 + (L.w - L.w1) * Math.pow(1 - t, wp)) * sc);
        const a = i ? i - 1 : 0, b = i < m - 1 ? i + 1 : m - 1;
        const dx = RX[b] - RX[a], dy = RY[b] - RY[a], l = Math.hypot(dx, dy) || 1;
        NX[i] = -dy / l; NY[i] = dx / l;
        HO[i] = clamp((NX[i] * LX + NY[i] * LY) * 2.5, -1, 1);
      }
      const col = woodColors(L);
      pc.globalAlpha = 1;
      pc.fillStyle = col[0];
      pc.beginPath();
      for (let i = 0; i < m; i++) pc.lineTo(RX[i] + NX[i] * RW[i], RY[i] + NY[i] * RW[i]);
      for (let i = m - 1; i >= 0; i--) pc.lineTo(RX[i] - NX[i] * RW[i], RY[i] - NY[i] * RW[i]);
      pc.closePath(); pc.fill();
      if (RW[0] > .6 && !GROUNDED[L.kind]) { pc.beginPath(); pc.arc(RX[0], RY[0], RW[0], 0, TAU); pc.fill(); }
      if (RW[0] * k < 1.1) return;
      // теневая сторона
      pc.fillStyle = col[2]; pc.globalAlpha = .6; pc.beginPath();
      for (let i = 0; i < m; i++) pc.lineTo(RX[i] - NX[i] * HO[i] * RW[i], RY[i] - NY[i] * HO[i] * RW[i]);
      for (let i = m - 1; i >= 0; i--) pc.lineTo(RX[i] - NX[i] * HO[i] * RW[i] * .2, RY[i] - NY[i] * HO[i] * RW[i] * .2);
      pc.closePath(); pc.fill();
      // блик на освещённой стороне
      pc.fillStyle = col[1]; pc.globalAlpha = .5; pc.beginPath();
      for (let i = 0; i < m; i++) pc.lineTo(RX[i] + NX[i] * HO[i] * RW[i] * .72, RY[i] + NY[i] * HO[i] * RW[i] * .72);
      for (let i = m - 1; i >= 0; i--) pc.lineTo(RX[i] + NX[i] * HO[i] * RW[i] * .18, RY[i] + NY[i] * HO[i] * RW[i] * .18);
      pc.closePath(); pc.fill();
      if (P.marks !== 'none' && BARKED[L.kind] && RW[0] * k > 2.6) bark(L, f, m, col);
      pc.globalAlpha = 1;
    }
    // Кора: чечевички сакуры поперёк ствола, пластины сосны и прожилки клёна вдоль, витки глицинии наискось.
    function bark(L, f, m, col) {
      if (!L.marks) {
        const r = rng('bark' + L.birth.toFixed(5) + ':' + L.w + ':' + L.n), cnt = Math.round(10 + L.w * 5);
        L.marks = Float32Array.from({length: cnt * 3}, r);
      }
      const M = L.marks, kind = P.marks;
      pc.beginPath();
      for (let q = 0; q < M.length; q += 3) {
        const t = M[q];
        if (t > f) continue;
        let i = 1;
        while (i < m - 1 && RT[i] < t) i++;
        const u = clamp((t - RT[i - 1]) / ((RT[i] - RT[i - 1]) || 1));
        const cx = RX[i - 1] + (RX[i] - RX[i - 1]) * u, cy = RY[i - 1] + (RY[i] - RY[i - 1]) * u;
        const w = RW[i - 1] + (RW[i] - RW[i - 1]) * u, nx = NX[i], ny = NY[i];
        const s = (M[q + 1] * 2 - 1) * .75, h = (.2 + M[q + 2] * .5) * w * (kind === 'lenticel' ? .5 : 1.1);
        const bx = cx + nx * s * w, by = cy + ny * s * w;
        let dx = ny, dy = -nx;
        if (kind === 'lenticel') { dx = nx; dy = ny; } else if (kind === 'twist') { dx = ny * .75 + nx * .65; dy = -nx * .75 + ny * .65; }
        pc.moveTo(bx - dx * h, by - dy * h); pc.lineTo(bx + dx * h, by + dy * h);
      }
      pc.strokeStyle = col[3];
      pc.globalAlpha = kind === 'lenticel' ? .55 : .5;
      pc.lineWidth = clamp(RW[0] * (kind === 'lenticel' ? .1 : .13), .2, 2.2);
      pc.stroke();
    }
    const ribs = [];
    for (const L of tree.lines) {
      if (!WOOD[L.tone]) continue;
      const f = (g - L.birth) / L.dur;
      if (f <= 0) continue;
      const mi = ((L.n - 1) >> 1) * 3;
      ribs.push({ L, f: f > 1 ? 1 : f, z: -L.xyz[mi] * sn + L.xyz[mi + 2] * cs, trunk: L.kind === 'trunk' || L.kind === 'culm' });
    }
    ribs.sort((a, b) => a.z - b.z);
    const front = ribs.findIndex(r => r.z > 0 && !r.trunk);
    const split = front < 0 ? ribs.length : front;
    for (let i = 0; i < split; i++) ribbon(ribs[i].L, ribs[i].f);

    // тонкие веточки и цветоножки: один путь на ширину
    const age = smooth((g - 4.4) / 2);
    const thin = { twig: [mixHex(YOUNG[1], P.twig, age), .66, .24], ped: [mixHex(YOUNG[2], P.ped, smooth((g - 5) / 1.5)), .36, .14] };
    for (const tone of ['twig', 'ped']) {
      const T = thin[tone], byWidth = new Map();
      for (const L of tree.lines) {
        if (L.tone !== tone) continue;
        const f = (g - L.birth) / L.dur;
        if (f <= 0) continue;
        const key = Math.round(L.w * 10);
        let arr = byWidth.get(key);
        if (!arr) byWidth.set(key, arr = []);
        arr.push(L, f > 1 ? 1 : f);
      }
      pc.strokeStyle = T[0]; pc.globalAlpha = T[1];
      for (const [key, arr] of byWidth) {
        pc.beginPath();
        for (let q = 0; q < arr.length; q += 2) {
          const L = arr[q], f = arr[q + 1], xyz = L.xyz, cum = L.cum;
          project(xyz[0], xyz[1], xyz[2]);
          pc.moveTo(px[0], px[1]);
          let i = 1;
          for (; i < L.n && cum[i] <= f; i++) { project(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]); pc.lineTo(px[0], px[1]); }
          if (i < L.n && f < 1) {
            const t = (f - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), j = i * 3, q3 = (i - 1) * 3;
            project(xyz[q3] + (xyz[j] - xyz[q3]) * t, xyz[q3 + 1] + (xyz[j + 1] - xyz[q3 + 1]) * t, xyz[q3 + 2] + (xyz[j + 2] - xyz[q3 + 2]) * t);
            pc.lineTo(px[0], px[1]);
          }
        }
        pc.lineWidth = Math.max(T[2], key / 10 * zoom);
        pc.stroke();
      }
    }
    pc.globalAlpha = 1;
    for (let i = split; i < ribs.length; i++) ribbon(ribs[i].L, ribs[i].f);

    // узлы бамбука: тёмное кольцо и светлый налёт под ним
    if (P.node) {
      pc.beginPath();
      const light = [];
      for (const L of tree.lines) {
        if (L.tone !== 'node' || g <= L.birth) continue;
        project((L.xyz[0] + L.xyz[3]) / 2, L.xyz[1], (L.xyz[2] + L.xyz[5]) / 2);
        const h = L.w * zoom * .58, y = px[1];
        pc.moveTo(px[0] - h, y); pc.lineTo(px[0] + h, y);
        light.push(px[0], y, h);
      }
      pc.strokeStyle = P.node; pc.globalAlpha = .9; pc.lineWidth = Math.max(.35, zoom * .9); pc.stroke();
      pc.beginPath();
      for (let i = 0; i < light.length; i += 3) {
        const y = light[i + 1] + Math.max(.5, zoom * 1.1);
        pc.moveTo(light[i] - light[i + 2] * .8, y); pc.lineTo(light[i] + light[i + 2] * .8, y);
      }
      pc.strokeStyle = '#e8f0d4'; pc.globalAlpha = .35; pc.lineWidth = Math.max(.25, zoom * .55); pc.stroke();
      pc.globalAlpha = 1;
    }

    // листья: семядоли, молодые листья, листочки глицинии, веера бамбука
    for (const L of tree.leaves) {
      let a = smooth((g - L.birth) / L.dur);
      if (L.fade) a *= 1 - (1 - (L.fadeTo || 0)) * smooth((g - L.fade[0]) / (L.fade[1] - L.fade[0]));
      if (a <= .01) continue;
      const grow = Math.min(1, (g - L.birth) / L.dur), l = L.l * (.35 + .65 * grow);
      const tip = add(L.p, add(mul(L.dir, l), [0, -l * L.droop, 0]));
      const mid = add(lerp(L.p, tip, .45), [0, l * L.droop * .45, 0]);
      const p0 = project(L.p[0], L.p[1], L.p[2]), ax = px[0], ay = px[1], z0 = px[2];
      project(tip[0], tip[1], tip[2]); const bx = px[0], by = px[1];
      project(mid[0], mid[1], mid[2]); const mx = px[0], my = px[1];
      const dx = bx - ax, dy = by - ay, dl = Math.hypot(dx, dy) || 1, ww = L.w * zoom * p0 * (L.blade ? .62 : .58);
      const nx = -dy / dl * ww, ny = dx / dl * ww;
      const sh = shades(P, L.color);
      pc.globalAlpha = .88 * a;
      pc.fillStyle = sh[z0 < -Rd * .25 ? 1 : z0 > Rd * .3 ? 3 : 2];
      pc.beginPath(); pc.moveTo(ax, ay);
      pc.quadraticCurveTo(mx + nx * 2, my + ny * 2, bx, by);
      pc.quadraticCurveTo(mx - nx * 2, my - ny * 2, ax, ay);
      pc.fill();
    }
    pc.globalAlpha = 1;

    // Цветки, бутоны, хвоя и дымка соцветий. Основной путь — WebGL одной пачкой точек;
    // без WebGL — те же спрайты через canvas 2D.
    const FL = tree.flowers, nF = FL.length;
    if (nF || tree.hazes.length) {
      const S = tree.spr || (tree.spr = spriteTable(P));
      if (!tree.buf || tree.buf.n !== nF) tree.buf = { n: nF, x: new Float32Array(nF), y: new Float32Array(nF),
        z: new Float32Array(nF), p: new Float32Array(nF), l: new Float32Array(nF), bucket: new Uint8Array(nF),
        order: new Uint32Array(nF), count: new Uint32Array(BUCKETS + 1) };
      const B = tree.buf, count = B.count;
      const G = o.no3d ? null : glReady(W, Hh, tree.hazes.length + nF * 2);
      const V = G ? G.data : null;
      let nv = 0;
      const put = (cell, x, y, d, rgb, ci, a, img) => {
        if (a <= .004 || d <= .05) return;
        if (V) {
          const q = nv * 8;
          V[q] = x; V[q + 1] = y; V[q + 2] = d; V[q + 3] = rgb[ci]; V[q + 4] = rgb[ci + 1]; V[q + 5] = rgb[ci + 2];
          V[q + 6] = a; V[q + 7] = cell; nv++;
        } else {
          pc.globalAlpha = a > 1 ? 1 : a;
          pc.drawImage(img[ci / 3], x - d / 2, y - d / 2, d, d);
        }
      };
      if (V) pc.setTransform(1, 0, 0, 1, 0, 0);
      const toPx = V ? k : 1, offX = V ? ox : 0, offY = V ? oy : 0;
      // бутоны краснеют перед цветением
      const bw = P.blushAt || [5.1, 5.95], blush = P.blush ? smooth((g - bw[0]) / (bw[1] - bw[0])) : 0, bn = S.budNow;
      for (let i = 0; i < bn.length; i++) bn[i] = S.rgbBud[i] + (S.rgbBlush[i] - S.rgbBud[i]) * blush;
      const I = V ? {} : S.images(), budImg = blush > .5 ? I.blush : I.bud;

      for (const hz of tree.hazes) {
        const grow = smooth((g - hz.birth) / .6);
        if (grow <= 0) continue;
        const p = project(hz.x, hz.y, hz.z);
        const bloom = P.bloomAt ? smooth((g - hz.open) / .5) : 1;
        const depth = px[2] / Rd, sh = depth < -.3 ? 1 : 2;
        const D = hz.r * 2 * p * zoom * (.6 + .4 * grow) * toPx;
        const a = (o.preview ? .08 : .05) * grow * (.55 + .45 * bloom) * (depth < -.4 ? .5 : 1);
        const x = px[0] * toPx + offX, y = px[1] * toPx + offY;
        if (bloom > .5) put(4, x, y, D, S.rgbPetal, ((S.base[hz.pal] + hz.idx % P[hz.pal].length) * 4 + sh) * 3, a, I.bokeh);
        else if (S.rgbLeaf && g < P.foliage.until + .3) put(4, x, y, D, S.rgbLeaf, ((hz.idx % S.nLeaf) * 4 + sh) * 3, a, I.budBokeh);
        else put(4, x, y, D, bn, ((hz.idx % P.bud.length) * 4 + sh) * 3, a, I.budBokeh);
      }
      if (!V) pc.globalAlpha = 1;

      // от дальних к ближним, глубина по корзинам вместо сортировки
      count.fill(0);
      let cnt = 0;
      const step = o.preview || o.fast ? 2 : 1;
      for (let i = 0; i < nF; i += step) {
        const f = FL[i];
        if (g <= f.birth) continue;
        B.p[i] = project(f.x, f.y, f.z); B.x[i] = px[0]; B.y[i] = px[1]; B.z[i] = px[2];
        // освещение: верх и ближняя сторона светлее, свет слева
        B.l[i] = f.v * .55 + px[2] / Rd * .35 - (f.x * cs + f.z * sn) / Rd * .2;
        const q = Math.max(0, Math.min(BUCKETS - 1, ((px[2] / Rd + 1.1) * BUCKETS / 2.2) | 0));
        B.bucket[i] = q; count[q + 1]++; cnt++;
      }
      for (let q = 1; q <= BUCKETS; q++) count[q] += count[q - 1];
      const ord = B.order;
      for (let i = 0; i < nF; i += step) if (g > FL[i].birth) ord[count[B.bucket[i]]++] = i;
      const unit = zoom * (o.preview ? 1.25 : 1) * 48 / 26 * toPx;
      const flowering = !!P.bloomAt, keepOpen = g > P.bloomAt, petalCell = P.petal, budCell = P.budCell;
      const nTop = P.top.length, nMid = P.mid.length, nDeep = P.deep.length, staticPal = !!P.staticPal;
      for (let n = 0; n < cnt; n++) {
        const i = ord[n], f = FL[i];
        const x = B.x[i] * toPx + offX, y = B.y[i] * toPx + offY, grow = Math.min(1, (g - f.birth) / .3);
        const depth = B.z[i] / Rd, L = B.l[i];
        const shade = L < -.45 ? 0 : L < -.05 ? 1 : L < .42 ? 2 : 3;
        const ad = depth < 0 ? -depth : depth, blur = ad <= .5 ? 0 : ad >= 1 ? 1 : (ad - .5) * 2;
        if (f.cd) { // светлые «свечки» молодой хвои
          const D = f.s * B.p[i] * unit * (.4 + .6 * grow);
          put(7, x, y, D, S.rgbCandle, ((f.idx % S.nCandle) * 4 + 3) * 3, .8 * grow, I.candle);
          continue;
        }
        const bloom = flowering ? smooth((g - f.open) / .35) : 1;
        const D = f.s * B.p[i] * unit * (.66 + .34 * bloom) * (.4 + .6 * grow);
        // у молодого дерева на месте будущих бутонов — свежие листочки
        const leafy = S.rgbLeaf ? 1 - smooth((g - P.foliage.until) / .6) : 0;
        if (leafy > 0) {
          put(blur > .6 ? 4 : 8, x, y, D * 1.45, S.rgbLeaf, ((f.bud % S.nLeaf) * 4 + shade) * 3, leafy * (.9 - blur * .4) * grow,
            blur > .6 ? I.budBokeh : I.leaf);
        }
        if (bloom < 1 && leafy < 1) {
          const sh = shade < 3 ? shade + 1 : 3, bokeh = blur > .6, a = (1 - bloom) * (1 - leafy) * (.85 - blur * .35) * grow;
          if (f.keep && keepOpen) put(bokeh ? 4 : budCell, x, y, D * 1.05, S.rgbKeep, ((f.bud % S.nKeep) * 4 + sh) * 3, a, bokeh ? I.keepBokeh : I.keep);
          else put(bokeh ? 4 : budCell, x, y, D * 1.05, bn, ((f.bud % P.bud.length) * 4 + sh) * 3, a, bokeh ? I.budBokeh : budImg);
        }
        if (bloom > 0) {
          let pi;
          if (staticPal) pi = S.base[f.pal] + f.idx % P[f.pal].length;
          else pi = L > .4 ? f.idx % nTop : L < -.32 ? nTop + nMid + f.idx % nDeep : nTop + f.idx % nMid;
          const ci = (pi * 4 + shade) * 3;
          if (blur > .55) put(4, x, y, D * (1 + blur * .9), S.rgbPetal, ci, bloom * (.22 + .34 * (1 - blur)) * grow, I.bokeh);
          else put(petalCell, x, y, D, S.rgbPetal, ci, bloom * (.86 - blur * .36) * grow, I.petal);
        }
      }
      if (V) {
        glDraw(G, W, Hh, nv, S.light);
        pc.setTransform(1, 0, 0, 1, 0, 0);
        pc.globalAlpha = 1;
        pc.drawImage(G.canvas, 0, G.canvas.height - Hh, W, Hh, 0, 0, W, Hh);
        pc.setTransform(k, 0, 0, k, ox, oy);
      }
      pc.globalAlpha = 1;
    }

    // слой растения + мягкое свечение поверх
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = o.thirsty ? .6 : 1;
    ctx.drawImage(plant, 0, 0);
    if (!o.noGlow && !o.fast) {
      let src = plant, w = W, h = Hh;
      for (let s = 0; s < 3; s++) {
        w = Math.max(1, w >> 1); h = Math.max(1, h >> 1);
        const d = layer(canvas, w, h, 'g' + s), dc = d.getContext('2d');
        dc.clearRect(0, 0, w, h); dc.drawImage(src, 0, 0, w, h); src = d;
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (o.thirsty ? .14 : .24) * (o.preview ? .8 : 1);
      ctx.drawImage(src, 0, 0, W, Hh);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (o.thirsty) {
      ctx.globalCompositeOperation = 'saturation';
      ctx.globalAlpha = .55; ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, Hh);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(k, 0, 0, k, ox, oy);
    drawDecor(ctx, o.decor, false);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  const BUCKETS = 24;

  function drawDecor(ctx, decor, back) {
    if (!decor || !decor.length) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    for (const d of decor) {
      if (BACK.has(d.name) !== back) continue;
      if (d.name === 'koi') {
        ctx.globalAlpha = .8; ctx.fillStyle = '#345c63';
        ctx.beginPath(); ctx.ellipse(d.x, d.y - 6, 48, 14, 0, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = .85;
      ctx.font = `${d.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
      ctx.fillText(d.text || DECOR_EMOJI[d.name] || '', d.x, d.y);
    }
    ctx.globalAlpha = 1;
  }

  const cache = new Map();
  function tree(species, seed) {
    const key = species + ':' + seed;
    let t = cache.get(key);
    if (!t) {
      t = build(SPECIES[species] ? species : 'sakura', seed);
      cache.set(key, t);
      if (cache.size > 24) cache.delete(cache.keys().next().value);
    }
    return t;
  }

  // ---------- холст поверх SVG ----------
  // SVG остаётся в разметке: он держит место, подпись для читалок экрана и
  // служит запасным рисунком, если canvas недоступен.
  const mounted = new WeakMap();
  let canPaint = null;
  function supported() {
    if (canPaint === null) {
      try { canPaint = !!document.createElement('canvas').getContext('2d'); } catch (_) { canPaint = false; }
    }
    return canPaint;
  }
  function viewOf(svg) {
    const v = (svg.getAttribute('viewBox') || '140 4 360 416').trim().split(/[\s,]+/).map(Number);
    return v.length === 4 && v.every(Number.isFinite) && v[2] > 0 && v[3] > 0
      ? { x: v[0], y: v[1], w: v[2], h: v[3] } : { x: 140, y: 4, w: 360, h: 416 };
  }
  function decorOf(svg) {
    return Array.from(svg.querySelectorAll('text[data-decor]'), t => ({
      name: t.getAttribute('data-decor'), x: +t.getAttribute('x') || 0, y: +t.getAttribute('y') || 0,
      size: +t.getAttribute('font-size') || 28, text: t.textContent || '' }));
  }
  function place(st) {
    const { svg, canvas } = st, parent = canvas.parentElement;
    if (!parent || !svg.isConnected) return false;
    const a = svg.getBoundingClientRect(), b = parent.getBoundingClientRect();
    if (a.width < 2 || a.height < 2) return false;
    const left = a.left - b.left - parent.clientLeft + parent.scrollLeft;
    const top = a.top - b.top - parent.clientTop + parent.scrollTop;
    const changed = Math.abs(a.width - (st.w || 0)) > .5 || Math.abs(a.height - (st.h || 0)) > .5;
    canvas.style.left = left + 'px'; canvas.style.top = top + 'px';
    canvas.style.width = a.width + 'px'; canvas.style.height = a.height + 'px';
    st.w = a.width; st.h = a.height;
    return changed || !st.painted;
  }
  function startTheta(st, from, to) { return st.tree.theta0 - (.4 + Math.max(0, to - from) * .16); }
  function paint(st, g, theta, fast) {
    if (!st.w || !st.h) return;
    const v = st.view, half = Math.min(320 - v.x, v.x + v.w - 320);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    draw(st.canvas, st.tree, {
      growth: g, theta, width: st.w, height: st.h, dpr: fast ? Math.min(dpr, 1.25) : dpr, fast,
      view: v, ground: { x: 320, y: 360 }, decor: st.decor, thirsty: st.thirsty, preview: !st.scene,
      fit: { top: v.y + (st.scene ? 10 : 6), bottom: 360, half: half - (st.scene ? 8 : 4) },
      maxZoom: st.scene ? 2.4 : 3,
    });
    st.painted = true;
  }
  function stop(st) {
    if (st.raf) cancelAnimationFrame(st.raf);
    st.raf = 0;
  }
  function settle(st) {
    stop(st);
    st.shown = st.growth; st.theta = st.tree.theta0;
    if (place(st) || st.w) paint(st, st.shown, st.theta, false);
  }

  /* Рисует растение поверх SVG. from — с какого роста начать (до reveal):
     0 для первого показа, прошлый рост для подросшего, текущий — без анимации. */
  function mount(svg, opts = {}) {
    if (!svg || !svg.isConnected || !supported()) return false;
    let st = mounted.get(svg);
    if (st) return true;
    const species = svg.getAttribute('data-species');
    if (!SPECIES[species]) return false;
    const parent = svg.parentElement;
    if (!parent) return false;
    const scene = svg.getAttribute('data-scene') === 'true';
    const growth = clamp(+svg.getAttribute('data-growth') || 0, 0, 8);
    const canvas = document.createElement('canvas');
    canvas.className = 'bloom-canvas' + (scene ? ' bloom-canvas--scene' : '');
    canvas.setAttribute('aria-hidden', 'true');
    const radius = getComputedStyle(svg).borderRadius;
    if (radius) canvas.style.borderRadius = radius;
    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
    svg.after(canvas);
    svg.classList.add('bloom-painted');
    const from = clamp(opts.from == null ? growth : +opts.from, 0, growth);
    st = { svg, canvas, scene, growth, view: viewOf(svg), decor: scene ? decorOf(svg) : [],
      thirsty: svg.classList.contains('bloom-tree--thirsty'),
      tree: tree(species, svg.getAttribute('data-seed') || '0'), shown: from, raf: 0, fast: false };
    st.theta = from < growth ? startTheta(st, from, growth) : st.tree.theta0;
    mounted.set(svg, st);
    if (place(st)) paint(st, st.shown, st.theta, false);
    if (typeof ResizeObserver === 'function') {
      st.resize = new ResizeObserver(() => {
        if (!svg.isConnected) { st.resize.disconnect(); return; }
        if (place(st) && !st.raf) paint(st, st.shown, st.theta, false);
      });
      st.resize.observe(svg);
    }
    if (scene) canvas.addEventListener('click', () => play(svg, 0, st.growth));
    return true;
  }

  // Рост от from до to: стебель тянется, ветви ветвятся, зонтики раскрываются.
  function play(svg, from, to) {
    const st = mounted.get(svg);
    if (!st) return false;
    stop(st);
    from = clamp(+from || 0, 0, 8); to = clamp(to == null ? st.growth : +to, 0, 8);
    const span = Math.max(0, to - from);
    if (span < .001) { settle(st); return true; }
    const D = Math.min(5600, 1400 + span * 560);
    const th1 = st.tree.theta0, th0 = startTheta(st, from, to);
    let t0 = 0, slowFrames = 0;
    const step = now => {
      if (!st.canvas.isConnected) { st.raf = 0; return; }
      if (!t0) t0 = now;
      place(st);
      const t = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - t, 2.4);
      if (t < 1) {
        st.shown = from + span * e; st.theta = th0 + (th1 - th0) * e;
        const a = performance.now();
        paint(st, st.shown, st.theta, st.fast);
        // слабому телефону — облегчённые кадры, последний кадр всегда полный
        if (performance.now() - a > 34 && ++slowFrames > 2) st.fast = true;
        st.raf = requestAnimationFrame(step);
      } else {
        st.raf = 0; st.shown = to; st.theta = th1;
        paint(st, to, th1, false);
      }
    };
    st.raf = requestAnimationFrame(step);
    return true;
  }
  function show(svg) { const st = mounted.get(svg); if (st) settle(st); return !!st; }

  window.PSUBloomCanvas = { SPECIES, tree, draw, build, mount, play, show };
})();
