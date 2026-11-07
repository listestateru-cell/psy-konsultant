/* PSU Hope · Bloom: генеративное растение на canvas (по мотивам «Bloom Study»).
   Форма задаётся только зерном (seed + порода), рост (0..8) лишь раскрывает уже
   известный скелет: стебель, ветви, зонтики крошечных цветков. Никаких таймеров,
   сети и записи прогресса — только кадры requestAnimationFrame во время роста. */
(() => {
  'use strict';
  if (window.PSUBloomCanvas) return;
  const TAU = Math.PI * 2;
  const GOLD = 2.39996323;

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

  // ---------- породы ----------
  const GREEN_BUDS = ['#a7c886', '#cfdca2', '#b9d48f', '#e3e2b2'];
  const GREEN_LEAF = ['#7fa868', '#93b878', '#6c9a5e', '#a3c283'];
  const YOUNG = ['#6f9a62', '#86ad6f', '#a2c487'];
  const SPECIES = {
    sakura: {
      H: 310, R: 215, bloomAt: 6, petal: 'petal',
      stem: '#776653', branch: '#948270', twig: '#b9a084', ped: '#cfb0a8',
      bud: GREEN_BUDS,
      top: ['#f4d7e5', '#edc7dc', '#e5c8e4', '#f1d8e9'],
      mid: ['#e9b8d8', '#dca9de', '#f0c8e0', '#d0aae6', '#e4b0d2'],
      deep: ['#b08ade', '#bf82cc', '#9a88da', '#a47ed2'],
      shade: '#24183c', cube: '#efe3cf', wisps: 9,
    },
    wisteria: {
      H: 300, R: 170, bloomAt: 6, petal: 'petal',
      stem: '#706452', branch: '#8e806a', twig: '#b4a07e', ped: '#c6ad9f',
      bud: GREEN_BUDS,
      top: ['#c4ba82', '#cdc29c', '#bab2d6', '#b5ad78', '#c7b8da'],
      mid: ['#c4a6dc', '#d2afdc', '#b7a1e0', '#cdafe4', '#bd9fd0', '#dab7dc'],
      deep: ['#7d80d8', '#6d6fca', '#8a86dc', '#9a8ed8'],
      shade: '#131740', cube: '#ece6cf', wisps: 10,
    },
    maple: {
      H: 275, R: 225, bloomAt: 6, petal: 'leaf',
      stem: '#6d6253', branch: '#8d806c', twig: '#a88f78', ped: '#b89a83',
      bud: ['#86a96c', '#a9c27f', '#6f9a62', '#c3cf8c'],
      top: ['#ef9b62', '#f1ad71', '#e58254'],
      mid: ['#db573e', '#c84a39', '#ef7852', '#b74137'],
      deep: ['#b33a30', '#c94a3a', '#9a2f2c'],
      shade: '#2a120e', cube: '#f2dcc0', wisps: 7,
    },
    pine: {
      H: 270, R: 150, bloomAt: 0, petal: 'needle',
      stem: '#6b6d55', branch: '#7a7a5c', twig: '#7f8f6e', ped: '#8fa98a',
      bud: ['#7fbf9f', '#a6d6b7', '#5f9d86'],
      top: ['#d8ecbd', '#bfe3c4', '#e3efc8'],
      mid: ['#7fc1a5', '#69ae95', '#95cdb2', '#5ea08a'],
      deep: ['#3f7f6f', '#2f6c60', '#4b8c7a'],
      shade: '#0c2222', cube: '#d9ecd5', wisps: 4,
    },
    bamboo: {
      H: 330, R: 105, bloomAt: 0, petal: 'dot',
      stem:'#86a66b', branch:'#b9c99c', twig:'#91ac76', ped:'#b5cda0', bud:GREEN_BUDS,
      top:['#d4e3ab','#bdd699'], mid:GREEN_LEAF, deep:['#47774f','#5d8b61'],
      shade:'#152c20', cube:'#d9e9bc',
    },
  };

  function bezier3(c, t) {
    const m = 1 - t, a = m * m * m, b = 3 * m * m * t, d = 3 * m * t * t, e = t * t * t;
    return [0, 1, 2].map(i => a * c[0][i] + b * c[1][i] + d * c[2][i] + e * c[3][i]);
  }
  function polyline(pts, birth, dur, w, tone) {
    const n = pts.length, xyz = new Float32Array(n * 3), cum = new Float32Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) {
      xyz.set(pts[i], i * 3);
      if (i) total += vlen(sub(pts[i], pts[i - 1]));
      cum[i] = total;
    }
    for (let i = 0; i < n; i++) cum[i] = total ? cum[i] / total : 1;
    return { xyz, cum, n, birth, dur: Math.max(.05, dur), w, tone };
  }
  function at(pts, f) {
    const x = clamp(f) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x));
    return lerp(pts[i], pts[i + 1], x - i);
  }

  // ---------- скелет растения ----------
  function build(species, seed) {
    species = SPECIES[species] ? species : 'sakura';
    const P = SPECIES[species], R = rng(`${species}:${seed}`);
    const lines = [], flowers = [], leaves = [], hazes = [];
    const anatomy = { trunks: [], leaders: [], pads: [], racemes: [], culms: [] };
    const curve = (control, steps = 20) => Array.from({length: steps + 1}, (_, i) => bezier3(control, i / steps));
    function path(points, birth, dur, width, tone, kind) {
      const line = polyline(points, birth, dur, width, tone);
      if (kind) line.kind = kind;
      lines.push(line);
      return line;
    }
    function wood(points, birth, dur, width, kind = 'limb') {
      // Крупная древесная ветвь сужается к концу; времена стыков совпадают.
      for (let j = 0; j < 4; j++) {
        const start = j * (points.length - 1) / 4, end = (j + 1) * (points.length - 1) / 4;
        const segment = [at(points, start / (points.length - 1))];
        for (let k = Math.floor(start) + 1; k < end; k++) segment.push(points[k]);
        segment.push(at(points, end / (points.length - 1)));
        path(segment, birth + dur * j / 4, dur / 4, width * (1 - j * .2), 'stem', kind);
      }
    }
    function shoot(points, birth, duration, width = .65, kind = 'shoot') {
      path(points, birth, duration, width, 'branch', kind);
    }
    function rooted(trunk, duration, width) {
      anatomy.trunks.push(trunk);
      wood(trunk, .18, duration, width, 'trunk');
      for (let j = 0; j < 5; j++) {
        const angle = j * GOLD + R(), end = [Math.cos(angle) * (19 + R() * 13), -2, Math.sin(angle) * 16];
        wood(curve([[0, 3, 0], [end[0] * .4, 0, end[2] * .4], end, end], 8), 2.4 + j * .08, .7, width * .28, 'root');
      }
      for (const side of [-1, 1]) leaves.push({p: at(trunk, .07), dir: norm([side, .6, .12]), l: 13, w: 4.5,
        birth: .45, dur: .4, fade: [2.1, 3.1], color: YOUNG[1]});
    }
    function blossom(F, birth, size, pal = 'mid', open = null) {
      const idx = (R() * P[pal].length) | 0;
      flowers.push({x:F[0], y:F[1], z:F[2], birth, open:open == null ? (P.bloomAt ? Math.max(birth + .08, 6 + R() * .95) : birth) : open,
        keep:false, s:size, pal, idx, bud:(R() * P.bud.length) | 0, corners:null, tw:R()});
    }
    function cloud(C, radii, birth, count, size = 1) {
      // Отдельное облако сохраняет свою границу; хвойные лапы не сливаются.
      const [rx, ry, rz] = radii;
      hazes.push({x:C[0], y:C[1], z:C[2], r:Math.min(rx, ry * 1.3), birth:birth + .2,
        pal:'mid', idx:(R() * P.mid.length) | 0, open:P.bloomAt ? 6.2 : birth});
      const sockets = [];
      for (let j = 0; j < 12; j++) {
        const a = j * GOLD, d = .25 + R() * .6;
        const socket = [C[0] + Math.cos(a) * rx * d, C[1] + (R() - .5) * ry, C[2] + Math.sin(a) * rz * d];
        sockets.push(socket);
        shoot(curve([C, lerp(C,socket,.3), add(socket,[0,ry*.15,0]), socket], 5), birth, .5, .26, 'canopy-twig');
      }
      for (let j = 0; j < count; j++) {
        const az = R() * TAU, z = R() * 2 - 1, radial = Math.cbrt(R());
        const a = Math.sqrt(1 - z*z) * radial;
        const F = [C[0] + Math.cos(az) * a * rx, C[1] + z * radial * ry, C[2] + Math.sin(az) * a * rz];
        const A = sockets[j % sockets.length], b = birth + .3 + R() * .5;
        path([A, lerp(A,F,.55), F], b, .3, .13, 'ped', 'leaf-stalk');
        const pal = F[2] < -P.R * .18 ? 'deep' : F[1] > C[1] + ry * .4 && R() < .45 ? 'top' : 'mid';
        blossom(F, b + .12, size * (.85 + R() * .9), pal);
      }
    }
    function leafFan(A, direction, birth, n = 7, length = 20) {
      for (let j = 0; j < n; j++) {
        const side = j % 2 ? 1 : -1, angle = (j / n - .5) * 1.35;
        const dir = norm([direction[0] * .6 + side * (.35 + R() * .5), direction[1] + angle, direction[2] + (R() - .5) * .6]);
        leaves.push({p:add(A,mul(direction,j * 2)), dir, l:length * (.65 + R() * .6), w:1.5 + R() * .9,
          birth:birth + j * .035, dur:.45, fade:null, color:GREEN_LEAF[(R()*GREEN_LEAF.length)|0], blade:true});
      }
    }

    if (species === 'bamboo') {
      // Несколько самостоятельных членистых стеблей, без цветочной кроны.
      for (let i = 0; i < 7; i++) {
        const x = (i - 3) * 19 + (R() - .5) * 9, z = (R() - .5) * 30;
        const height = i === 3 ? 330 : 245 + R() * 75, lean = x * .22 + (R() - .5) * 20;
        const control = [[x,0,z], [x+lean*.15,height*.34,z+4], [x+lean*.7,height*.76,z-5], [x+lean,height,z]];
        const points = curve(control,32), birth = .2 + Math.abs(i-3) * .65, dur = 5.4 - Math.abs(i-3) * .2;
        anatomy.culms.push(points);
        path(points,birth,dur,i===3 ? 3.4 : 2.4,'stem','culm');
        for (let j=1;j<12;j++) {
          const f=j/12, A=at(points,f), born=birth+dur*f;
          path([[A[0]-3,A[1],A[2]],[A[0]+3,A[1],A[2]]],born,.12,1,'branch','node');
          if (j<4 || j%2!==i%2) continue;
          for (const side of [-1,1]) {
            const end=add(A,[side*(21+R()*25),12+R()*17,(R()-.5)*27]);
            const b=born+.08;
            shoot(curve([A,add(A,[side*12,12,0]),add(end,[-side*7,7,0]),end],8),b,.4,.45,'bamboo-shoot');
            leafFan(end,norm([side,.1,(R()-.5)*.6]),b+.25,6,22);
          }
        }
      }
    } else if (species === 'pine') {
      // Moyogi: тяжёлое основание, изгибы ствола и плоские отдельные лапы хвои.
      const trunk=curve([[0,0,0],[-61,60,4],[55,124,-7],[8,164,0]],28);
      const top=curve([[8,164,0],[-10,184,1],[23,202,3],[26,226,0]],14);
      rooted(trunk,3.2,12);wood(top,3.38,1.1,4.6,'trunk');anatomy.trunks.push(top);
      const pads=[[-79,103,-2,62,12,34],[78,139,8,65,13,35],[-58,174,5,55,12,32],
        [63,198,-7,43,11,28],[-10,218,7,42,12,29],[26,244,0,34,15,26]];
      pads.forEach((p,i)=>{
        const A=i<3 ? at(trunk,.53+i*.16) : at(top,.28+(i-3)*.27), C=p.slice(0,3);
        const branch=curve([A,add(A,[(C[0]-A[0])*.48,-16,0]),add(C,[-Math.sign(C[0])*15,-4,0]),C],14);
        const parentReady=i<3 ? .18+3.2*(.53+i*.16) : 3.38+1.1*(.28+(i-3)*.27);
        const birth=Math.max(2.4+i*.35,parentReady+.05);wood(branch,birth,.8,3.1-i*.27,'pine-limb');
        anatomy.pads.push({center:C,radii:p.slice(3)});
        cloud(C,p.slice(3),birth+.83,650,.95);
      });
    } else {
      const maple=species==='maple', wisteria=species==='wisteria';
      const trunkHeight=maple ? 53 : wisteria ? 113 : 82;
      const trunk=curve([[0,0,0],[-15,trunkHeight*.37,6],[17,trunkHeight*.76,-5],[3,trunkHeight,0]],22);
      rooted(trunk,2.5,maple ? 9.4 : wisteria ? 10.8 : 10);
      if(wisteria) {
        // Вторая линия древесной лианы обвивает основной ствол.
        const twist=trunk.map((p,i)=>add(p,[Math.sin(i*.57)*3.6,0,Math.cos(i*.57)*3.6]));
        wood(twist,.28,2.5,4.1,'twining-vine');
      }
      const leaderCount=maple ? 7 : 6;
      for(let i=0;i<leaderCount;i++) {
        const phi=i*GOLD+.4, radius=(maple ? 91 : 86)+R()*30;
        const end=[Math.cos(phi)*radius,(maple ? 157 : wisteria ? 229 : 193)+R()*42,Math.sin(phi)*radius*.65];
        const forkF=.57+R()*.4, A=at(trunk,forkF);
        const limb=curve([A,add(A,[Math.cos(phi)*(maple ? 65 : wisteria ? 55 : 36),maple ? 32 : 50,Math.sin(phi)*21]),
          add(end,[-Math.cos(phi)*30,maple ? 25 : wisteria ? 14 : -27,Math.sin(phi)*10]),end],20);
        const birth=Math.max(1.9+i*.12,.18+2.5*forkF+.04);
        wood(limb,birth,1.65,4.6-i*.26,'leader');
        anatomy.leaders.push({points:limb,birth,dur:1.65});
      }
      const canopyY=maple ? 125 : wisteria ? 231 : 160, rx=maple ? 185 : wisteria ? 144 : 174;
      const crownNodes=[];
      for(let i=0;i<32;i++) {
        const angle=i*GOLD+R()*.35, r=Math.sqrt((i+.65)/32);
        const C=[Math.cos(angle)*r*rx,canopyY+(1-r*r)*(wisteria ? 63 : 100)+(R()-.5)*(wisteria ? 16 : 36),Math.sin(angle)*r*rx*.58];
        let nearest=anatomy.leaders[0];
        for(const leader of anatomy.leaders)if(vlen(sub(at(leader.points,.85),C))<vlen(sub(at(nearest.points,.85),C)))nearest=leader;
        const f=.62+R()*.35, A=at(nearest.points,f), birth=nearest.birth+nearest.dur*f+.12;
        const twig=curve([A,add(lerp(A,C,.35),[0,17,0]),add(C,[0,9,0]),C],9);
        shoot(twig,birth,.7,.65,'crown-branch');
        const b=birth+.7;
        crownNodes.push({C,birth:b,twig});
        if(!wisteria) cloud(C,[27+R()*13,maple ? 26+R()*11 : 35+R()*15,23+R()*13],b,maple ? 160 : 185,maple ? 1.85 : 1.25);
        else {
          leafFan(C,norm([Math.cos(angle),.45,Math.sin(angle)]),b,5,11);
          // Редкие листья оставляют просветы между свисающими кистями.
          if(i%3===0)leafFan(at(twig,.6),norm([-Math.cos(angle),.3,-Math.sin(angle)]),b,4,12);
        }
      }
      if(wisteria) for(let i=0;i<46;i++) {
        const crown=crownNodes[i%crownNodes.length], A=at(crown.twig,.55+R()*.45);
        const length=48+R()*57, radius=9+R()*5, sway=(R()-.5)*16;
        const end=add(A,[sway,-length,(R()-.5)*9]);
        const central=curve([A,add(A,[sway*.4,-length*.25,0]),add(end,[-sway*.25,length*.2,0]),end],14);
        const birth=crown.birth+.15+R()*.3;
        path(central,birth,.8,.32,'ped','raceme');
        anatomy.racemes.push({base:A,tip:end});
        for(let j=0;j<142;j++) {
          const u=(j+.5)/142, az=j*GOLD+R()*.4, center=at(central,u);
          const r=radius*Math.pow(1-u,.62)*(.4+R()*.6);
          const F=add(center,[Math.cos(az)*r,(R()-.5)*5,Math.sin(az)*r]);
          const b=birth+u*.64;
          path([center,F],b,.18,.12,'ped','raceme-pedicel');
          blossom(F,b+.15,1.05+R()*.85,u>.62 ? 'deep' : i%4===0 ? 'top' : 'mid',Math.max(6+u*.8+R()*.35,b+.1));
        }
      }
    }
    // Граница последней стадии общая для всех видов, геометрия не пересчитывается.
    let end=0;
    for(const line of lines)end=Math.max(end,line.birth+line.dur);
    for(const f of flowers)end=Math.max(end,f.birth+.3,f.open+.35);
    for(const leaf of leaves)end=Math.max(end,leaf.birth+leaf.dur);
    if(end>7.9) {
      const k=(7.9-5)/(end-5), time=t=>t>5 ? 5+(t-5)*k : t;
      for(const line of lines){const finish=time(line.birth+line.dur);line.birth=time(line.birth);line.dur=Math.max(.025,finish-line.birth);}
      for(const f of flowers){f.birth=time(f.birth);f.open=time(f.open);}
      for(const h of hazes){h.birth=time(h.birth);h.open=time(h.open);}
      for(const leaf of leaves){const finish=time(leaf.birth+leaf.dur);leaf.birth=time(leaf.birth);leaf.dur=Math.max(.025,finish-leaf.birth);}
    }
    return {P,H:P.H,lines,flowers,leaves,hazes,anatomy,theta0:(R()-.5)*.28};
  }

  // ---------- спрайты ----------
  const sprites = new Map();
  function sprite(kind, color) {
    const key = kind + color;
    let c = sprites.get(key);
    if (c) return c;
    const S = 48, h = S / 2;
    c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const [r, g, b] = hex(color);
    const rgba = a => `rgba(${r},${g},${b},${a})`;
    const halo = (a0, a1) => {
      const gr = x.createRadialGradient(h, h, 0, h, h, h);
      gr.addColorStop(0, rgba(a0)); gr.addColorStop(.42, rgba(a1)); gr.addColorStop(1, rgba(0));
      x.fillStyle = gr; x.fillRect(0, 0, S, S);
    };
    if (kind === 'petal') {
      halo(.16, .05);
      x.translate(h, h);
      x.fillStyle = rgba(.96);
      for (let i = 0; i < 5; i++) {
        x.rotate(TAU / 5);
        x.beginPath(); x.ellipse(0, -6.2, 4.4, 6.4, 0, 0, TAU); x.fill();
      }
      x.fillStyle = 'rgba(250,240,210,.95)';
      x.beginPath(); x.arc(0, 0, 2.1, 0, TAU); x.fill();
    } else if (kind === 'leaf') {
      halo(.15, .04);
      x.translate(h, h);
      x.fillStyle = rgba(.95);
      x.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * TAU / 10, rad = i % 2 ? 4.6 : 12.5;
        x.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      x.closePath(); x.fill();
    } else if (kind === 'needle') {
      halo(.12, .035); x.translate(h,h); x.strokeStyle=rgba(.95); x.lineWidth=1.15;
      x.beginPath();
      for(let i=0;i<5;i++){const a=-Math.PI*.82+i*.27;x.moveTo(0,5);x.lineTo(Math.cos(a)*11,Math.sin(a)*13);}
      x.stroke();
    } else if (kind === 'dot') {
      halo(.4, .14);
      const gr = x.createRadialGradient(h, h, 0, h, h, 9);
      gr.addColorStop(0, rgba(1)); gr.addColorStop(.6, rgba(.85)); gr.addColorStop(1, rgba(0));
      x.fillStyle = gr; x.beginPath(); x.arc(h, h, 9, 0, TAU); x.fill();
    } else if (kind === 'bud') {
      halo(.25, .06);
      const gr = x.createRadialGradient(h - 1.5, h - 1.5, 0, h, h, 10);
      gr.addColorStop(0, 'rgba(255,255,240,.95)'); gr.addColorStop(.4, rgba(1)); gr.addColorStop(1, rgba(0));
      x.fillStyle = gr; x.beginPath(); x.arc(h, h, 10, 0, TAU); x.fill();
    } else { // bokeh: размытый цветок вне фокуса
      const gr = x.createRadialGradient(h, h, 0, h, h, h * .92);
      gr.addColorStop(0, rgba(.75)); gr.addColorStop(.55, rgba(.5)); gr.addColorStop(.8, rgba(.18)); gr.addColorStop(1, rgba(0));
      x.fillStyle = gr; x.fillRect(0, 0, S, S);
    }
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

  const BUCKETS = 24;
  const CUBE_EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 0, 2, 1, 3, 4, 6, 5, 7, 0, 4, 1, 5, 2, 6, 3, 7];
  const CUBE_PTS = new Float32Array(16);
  const PETAL_CELL = { petal: 0, leaf: 1, dot: 2, needle: 5 };
  function spriteTable(P) {
    const flat = [...P.top, ...P.mid, ...P.deep];
    const each = (colors, kind) => colors.flatMap(c => shades(P, c).map(s => sprite(kind, s)));
    const rgb = colors => Float32Array.from(colors.flatMap(c => shades(P, c).flatMap(s => hex(s).map(v => v / 255))));
    return { base: { top: 0, mid: P.top.length, deep: P.top.length + P.mid.length },
      petal: each(flat, P.petal), bokeh: each(flat, 'bokeh'), bud: each(P.bud, 'bud'),
      budBokeh: each(P.bud, 'bokeh'), keep: each(P.top, 'bud'), keepBokeh: each(P.top, 'bokeh'),
      rgbPetal: rgb(flat), rgbBud: rgb(P.bud), rgbKeep: rgb(P.top) };
  }

  // ---------- WebGL: общий холст для всех растений на странице ----------
  let GLS = null, glFailed = false;
  const ATLAS_CELLS = 8, CELL = 64;
  function atlas() {
    // Белые формы: A — покрытие, R — доля цвета точки (0 — кремовая серединка цветка).
    const c = document.createElement('canvas');
    c.width = ATLAS_CELLS * CELL; c.height = CELL;
    const x = c.getContext('2d'), h = CELL / 2, sc = CELL / 48 * .86;
    const cell = (i, fn) => { x.save(); x.translate(i * CELL + h, h); x.scale(sc, sc); fn(); x.restore(); };
    const halo = (a0, a1, r = 24) => {
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, r);
      gr.addColorStop(0, `rgba(255,0,0,${a0})`); gr.addColorStop(.42, `rgba(255,0,0,${a1})`); gr.addColorStop(1, 'rgba(255,0,0,0)');
      x.fillStyle = gr; x.fillRect(-r, -r, 2 * r, 2 * r);
    };
    cell(0, () => {
      halo(.16, .05); x.fillStyle = 'rgba(255,0,0,.96)';
      for (let i = 0; i < 5; i++) { x.rotate(TAU / 5); x.beginPath(); x.ellipse(0, -6.2, 4.4, 6.4, 0, 0, TAU); x.fill(); }
      x.fillStyle = 'rgba(0,0,0,.95)'; x.beginPath(); x.arc(0, 0, 2.1, 0, TAU); x.fill();
    });
    cell(1, () => {
      halo(.15, .04); x.fillStyle = 'rgba(255,0,0,.95)'; x.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * TAU / 10, r = i % 2 ? 4.6 : 12.5; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      x.closePath(); x.fill();
    });
    cell(2, () => {
      halo(.4, .14);
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, 9);
      gr.addColorStop(0, 'rgba(255,0,0,1)'); gr.addColorStop(.6, 'rgba(255,0,0,.85)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 9, 0, TAU); x.fill();
    });
    cell(3, () => {
      halo(.25, .06);
      const gr = x.createRadialGradient(-1.5, -1.5, 0, 0, 0, 10);
      gr.addColorStop(0, 'rgba(90,0,0,.95)'); gr.addColorStop(.4, 'rgba(255,0,0,1)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(0, 0, 10, 0, TAU); x.fill();
    });
    cell(4, () => {
      const gr = x.createRadialGradient(0, 0, 0, 0, 0, 22);
      gr.addColorStop(0, 'rgba(255,0,0,.75)'); gr.addColorStop(.55, 'rgba(255,0,0,.5)'); gr.addColorStop(.8, 'rgba(255,0,0,.18)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
      x.fillStyle = gr; x.fillRect(-24, -24, 48, 48);
    });
    cell(5, () => {
      halo(.12,.035);x.strokeStyle='rgba(255,0,0,.95)';x.lineWidth=1.15;x.beginPath();
      for(let i=0;i<5;i++){const a=-Math.PI*.82+i*.27;x.moveTo(0,5);x.lineTo(Math.cos(a)*11,Math.sin(a)*13);}
      x.stroke();
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
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `precision mediump float;uniform sampler2D uTex;varying vec3 vCol;varying float vA;varying float vCell;
void main(){vec2 uv=vec2((vCell+.04+gl_PointCoord.x*.92)/${ATLAS_CELLS}.0,.04+gl_PointCoord.y*.92);vec4 t=texture2D(uTex,uv);
vec3 rgb=mix(vec3(.98,.94,.82),vCol,t.r);float a=t.a*vA;gl_FragColor=vec4(rgb*a,a);}`));
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
      uMax: gl.getUniformLocation(prog, 'uMax'), maxPoint: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64 };
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
  function glDraw(G, W, H, n) {
    const gl = G.gl;
    gl.viewport(0, 0, W, H);
    gl.enable(gl.SCISSOR_TEST); gl.scissor(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(G.uRes, W, H); gl.uniform1f(G.uMax, G.maxPoint);
    gl.bufferData(gl.ARRAY_BUFFER, G.data.subarray(0, n * 8), gl.DYNAMIC_DRAW);
    gl.drawArrays(gl.POINTS, 0, n);
  }

  // ---------- кадр ----------
  const DECOR_EMOJI = { moon: '🌕', fuji: '🗻', pagoda: '🏯', torii: '⛩', teahouse: '🍵', lantern: '🏮',
    stone: '🪨', bell: '🎐', koi: '🐟', dragon: '🐉' };
  const BACK = new Set(['moon', 'fuji', 'dragon', 'bell']);
  const layers = new WeakMap();

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
     fit {top,bottom,half} — куда вписывать растение, decor, thirsty, preview, background */
  function draw(canvas, tree, o) {
    const dpr = o.dpr || 1;
    const W = Math.max(1, Math.round(o.width * dpr)), Hh = Math.max(1, Math.round(o.height * dpr));
    if (canvas.width !== W || canvas.height !== Hh) { canvas.width = W; canvas.height = Hh; }
    const ctx = canvas.getContext('2d');
    const P = tree.P, g = clamp(o.growth, 0, 8);
    const v = o.view;
    // viewBox → пиксели, как preserveAspectRatio="xMidYMax meet"
    const k = Math.min(W / v.w, Hh / v.h);
    const ox = (W - v.w * k) / 2 - v.x * k, oy = (Hh - v.h * k) - v.y * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // фон
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
    const ext = extent(tree, g);
    const fit = o.fit;
    const zoom = Math.min(o.maxZoom || 2.4, (fit.bottom - fit.top) / (ext.top + 14), fit.half / (ext.rad + 10));
    const theta = o.theta;
    const cs = Math.cos(theta), sn = Math.sin(theta), F = 1150;
    const R = P.R;

    // растение рисуем в отдельный слой: от него же строится свечение
    const plant = layer(canvas, W, Hh, 'plant');
    const pc = plant.getContext('2d');
    pc.setTransform(1, 0, 0, 1, 0, 0);
    pc.clearRect(0, 0, W, Hh);
    pc.setTransform(k, 0, 0, k, ox, oy);
    pc.lineCap = 'round'; pc.lineJoin = 'round';
    const px = new Float32Array(3);
    function project(x, y, z) {
      const xr = x * cs + z * sn, zr = -x * sn + z * cs, p = F / (F - zr * zoom);
      px[0] = gx + xr * p * zoom; px[1] = gy - y * p * zoom; px[2] = zr;
      return p;
    }

    // семечко
    if (g < 2.4) {
      pc.globalAlpha = clamp(1 - g / 2.4) * .9;
      pc.fillStyle = '#8a7255';
      pc.beginPath(); pc.ellipse(gx + 1, gy - 2.2, 4.4 * Math.min(zoom, 1.8), 3 * Math.min(zoom, 1.8), -.3, 0, TAU); pc.fill();
      pc.globalAlpha = 1;
    }

    // листья у основания
    for (const L of tree.leaves) {
      let a = smooth((g - L.birth) / L.dur);
      if (L.fade) a *= 1 - (1 - (L.fadeTo || 0)) * smooth((g - L.fade[0]) / (L.fade[1] - L.fade[0]));
      if (a <= .01) continue;
      const tip = add(L.p, mul(L.dir, L.l * a));
      const side = norm(cross(L.dir, [0, 0, 1]));
      const c1 = add(lerp(L.p, tip, .45), mul(side, L.w * a)), c2 = add(lerp(L.p, tip, .55), mul(side, -L.w * a * (L.blade ? .2 : 1)));
      project(L.p[0], L.p[1], L.p[2]); const ax = px[0], ay = px[1];
      project(tip[0], tip[1], tip[2]); const bx = px[0], by = px[1];
      project(c1[0], c1[1], c1[2]); const c1x = px[0], c1y = px[1];
      project(c2[0], c2[1], c2[2]); const c2x = px[0], c2y = px[1];
      pc.globalAlpha = .85 * a;
      pc.fillStyle = L.color;
      pc.beginPath(); pc.moveTo(ax, ay); pc.quadraticCurveTo(c1x, c1y, bx, by); pc.quadraticCurveTo(c2x, c2y, ax, ay); pc.fill();
    }
    pc.globalAlpha = 1;

    // стебли: один путь на тон
    // молодые побеги зелёные, к цветению буреют
    const age = smooth((g - 4.6) / 1.8);
    const tones = {
      stem: { c: P.stem, a: .9, w: 1 }, branch: { c: mixHex(YOUNG[0], P.branch, age), a: .55, w: 1 },
      twig: { c: mixHex(YOUNG[1], P.twig, age), a: .5, w: 1 }, ped: { c: mixHex(YOUNG[2], P.ped, age), a: .34, w: 1 },
    };
    for (const tone of ['stem', 'branch', 'twig', 'ped']) {
      const T = tones[tone];
      const byWidth = new Map();
      for (const L of tree.lines) {
        if (L.tone !== tone) continue;
        const f = (g - L.birth) / L.dur;
        if (f <= 0) continue;
        let arr = byWidth.get(L.w);
        if (!arr) byWidth.set(L.w, arr = []);
        arr.push([L, Math.min(1, f)]);
      }
      for (const [w, arr] of byWidth) {
        pc.beginPath();
        for (const [L, f] of arr) {
          const xyz = L.xyz, cum = L.cum;
          project(xyz[0], xyz[1], xyz[2]);
          pc.moveTo(px[0], px[1]);
          let i = 1;
          for (; i < L.n && cum[i] <= f; i++) { project(xyz[i * 3], xyz[i * 3 + 1], xyz[i * 3 + 2]); pc.lineTo(px[0], px[1]); }
          if (i < L.n && f < 1) {
            const t = (f - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), j = i * 3, q = (i - 1) * 3;
            project(xyz[q] + (xyz[j] - xyz[q]) * t, xyz[q + 1] + (xyz[j + 1] - xyz[q + 1]) * t, xyz[q + 2] + (xyz[j + 2] - xyz[q + 2]) * t);
            pc.lineTo(px[0], px[1]);
          }
        }
        if (tone === 'stem') {
          const gr = pc.createLinearGradient(0, gy, 0, gy - tree.H * zoom);
          gr.addColorStop(0, mixHex('#3d5c44','#76634e',age));
          gr.addColorStop(.6, mixHex(YOUNG[0],P.stem,age));
          gr.addColorStop(1, P===SPECIES.bamboo ? '#a3c283' : mixHex('#86a676','#b3a68c',age));
          pc.strokeStyle = gr;
        } else pc.strokeStyle = T.c;
        pc.globalAlpha = T.a;
        const thickening=tone==='stem'&&P!==SPECIES.bamboo ? .18+.82*smooth((g-1)/5) : 1;
        pc.lineWidth = w * Math.max(.75, Math.min(zoom, 1.6)) * thickening;
        pc.stroke();
      }
    }
    pc.globalAlpha = 1;

    // Цветки, бутоны и дымка соцветий. Основной путь — WebGL одной пачкой точек
    // (тысячи спрайтов за один вызов); без WebGL — те же спрайты через canvas 2D.
    const FL = tree.flowers, nF = FL.length;
    const S = tree.spr || (tree.spr = spriteTable(P));
    if (!tree.buf || tree.buf.n !== nF) tree.buf = { n: nF, x: new Float32Array(nF), y: new Float32Array(nF),
      z: new Float32Array(nF), p: new Float32Array(nF), bucket: new Uint8Array(nF), order: new Uint32Array(nF),
      count: new Uint32Array(BUCKETS + 1) };
    const B = tree.buf, count = B.count;
    const G = o.no3d ? null : glReady(W, Hh, tree.hazes.length + nF * 2);
    let V = G ? G.data : null, nv = 0;
    // cell: 0 лепестки, 1 лист клёна, 2 точка хвои, 3 бутон, 4 размытое пятно
    const put = (cell, x, y, d, rgb, ci, a, img) => {
      if (a <= .004 || d <= .05) return;
      if (V) {
        const k = nv * 8;
        V[k] = x; V[k + 1] = y; V[k + 2] = d; V[k + 3] = rgb[ci]; V[k + 4] = rgb[ci + 1]; V[k + 5] = rgb[ci + 2];
        V[k + 6] = a; V[k + 7] = cell; nv++;
      } else {
        pc.globalAlpha = a > 1 ? 1 : a;
        pc.drawImage(img[ci / 3], x - d / 2, y - d / 2, d, d);
      }
    };
    if (V) pc.setTransform(1, 0, 0, 1, 0, 0);
    const toPx = V ? k : 1, offX = V ? ox : 0, offY = V ? oy : 0;
    const scr = (v, off) => v * toPx + off;

    // дымка соцветий: мягкий объём между цветками
    for (const hz of tree.hazes) {
      const grow = smooth((g - hz.birth) / .6);
      if (grow <= 0) continue;
      const p = project(hz.x, hz.y, hz.z);
      const bloom = P.bloomAt ? smooth((g - hz.open) / .5) : 1;
      const depth = px[2] / R, sh = depth < -.3 ? 1 : 2;
      const D = hz.r * 2 * p * zoom * (.6 + .4 * grow) * toPx;
      const a = (o.preview ? .08 : .05) * grow * (.55 + .45 * bloom) * (depth < -.4 ? .5 : 1);
      if (bloom > .5) put(4, scr(px[0], offX), scr(px[1], offY), D, S.rgbPetal, ((S.base[hz.pal] + hz.idx % P[hz.pal].length) * 4 + sh) * 3, a, S.bokeh);
      else put(4, scr(px[0], offX), scr(px[1], offY), D, S.rgbBud, ((hz.idx % P.bud.length) * 4 + sh) * 3, a, S.budBokeh);
    }
    if (!V) pc.globalAlpha = 1;

    // цветки: от дальних к ближним, глубина по корзинам вместо сортировки
    count.fill(0);
    let cnt = 0;
    const step = o.preview || o.fast ? 2 : 1;
    for (let i = 0; i < nF; i += step) {
      const f = FL[i];
      if (g <= f.birth) continue;
      B.p[i] = project(f.x, f.y, f.z); B.x[i] = px[0]; B.y[i] = px[1]; B.z[i] = px[2];
      const q = Math.max(0, Math.min(BUCKETS - 1, ((px[2] / R + 1.1) * BUCKETS / 2.2) | 0));
      B.bucket[i] = q; count[q + 1]++; cnt++;
    }
    for (let q = 1; q <= BUCKETS; q++) count[q] += count[q - 1];
    const ord = B.order;
    for (let i = 0; i < nF; i += step) if (g > FL[i].birth) ord[count[B.bucket[i]]++] = i;
    const unit = zoom * (o.preview ? 1.25 : 1) * 48 / 26 * toPx;
    const flowering = !!P.bloomAt, keepOpen = g > P.bloomAt, petalCell = PETAL_CELL[P.petal] || 0;
    const cubes = [];
    for (let n = 0; n < cnt; n++) {
      const i = ord[n], f = FL[i];
      const x = scr(B.x[i], offX), y = scr(B.y[i], offY), grow = Math.min(1, (g - f.birth) / .3);
      const bloom = flowering ? smooth((g - f.open) / .35) : 1;
      const depth = B.z[i] / R; // -1 дальний … +1 ближний
      const shade = depth < -.45 ? 0 : depth < -.05 ? 1 : depth < .55 ? 2 : 3;
      const ad = depth < 0 ? -depth : depth, blur = ad <= .5 ? 0 : ad >= 1 ? 1 : (ad - .5) * 2;
      const D = f.s * B.p[i] * unit * (.66 + .34 * bloom) * (.4 + .6 * grow);
      if (f.corners && bloom > .5) { cubes.push(f, grow); continue; }
      if (bloom < 1) {
        const sh = shade < 3 ? shade + 1 : 3, bokeh = blur > .6, a = (1 - bloom) * (.85 - blur * .35) * grow;
        if (f.keep && keepOpen) put(bokeh ? 4 : 3, x, y, D * 1.05, S.rgbKeep, ((f.bud % P.top.length) * 4 + sh) * 3, a, bokeh ? S.keepBokeh : S.keep);
        else put(bokeh ? 4 : 3, x, y, D * 1.05, S.rgbBud, (f.bud * 4 + sh) * 3, a, bokeh ? S.budBokeh : S.bud);
      }
      if (bloom > 0) {
        if (f.pi === undefined) f.pi = S.base[f.pal] + f.idx;
        const ci = (f.pi * 4 + shade) * 3;
        if (blur > .55) put(4, x, y, D * (1 + blur * .9), S.rgbPetal, ci, bloom * (.22 + .34 * (1 - blur)) * grow, S.bokeh);
        else put(petalCell, x, y, D, S.rgbPetal, ci, bloom * (.84 - blur * .36) * grow, S.petal);
      }
    }
    if (V) {
      glDraw(G, W, Hh, nv);
      pc.setTransform(1, 0, 0, 1, 0, 0);
      pc.globalAlpha = 1;
      pc.drawImage(G.canvas, 0, G.canvas.height - Hh, W, Hh, 0, 0, W, Hh);
      pc.setTransform(k, 0, 0, k, ox, oy);
    }
    // кубики-контуры — немного, их проще обвести линиями
    pc.strokeStyle = P.cube;
    pc.lineWidth = .28;
    for (let n = 0; n < cubes.length; n += 2) {
      const f = cubes[n], c = f.corners;
      pc.globalAlpha = .45 * cubes[n + 1];
      for (let q = 0; q < 8; q++) {
        project(f.x + c[q * 3] * .6, f.y + c[q * 3 + 1] * .6, f.z + c[q * 3 + 2] * .6);
        CUBE_PTS[q * 2] = px[0]; CUBE_PTS[q * 2 + 1] = px[1];
      }
      pc.beginPath();
      for (let e = 0; e < 24; e += 2) {
        const u = CUBE_EDGES[e] * 2, v = CUBE_EDGES[e + 1] * 2;
        pc.moveTo(CUBE_PTS[u], CUBE_PTS[u + 1]); pc.lineTo(CUBE_PTS[v], CUBE_PTS[v + 1]);
      }
      pc.stroke();
    }
    pc.globalAlpha = 1;

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
