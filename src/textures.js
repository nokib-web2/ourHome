import * as THREE from 'three';

// Every texture in the scene is painted here on a <canvas>, so the site has no
// heavy asset downloads besides your own photos.

export const SERIF = '"Cormorant Garamond", "Times New Roman", serif';
export const SANS = '"Jost", "Helvetica Neue", Arial, sans-serif';

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d', { willReadFrequently: false })];
}

export function toTexture(canvas, { srgb = true, repeat = 0 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
  }
  // The renderer clamps this to the GPU's supported maximum. A higher request
  // keeps floorboards and other tiled textures stable at grazing angles.
  t.anisotropy = 16;
  return t;
}

function noise(ctx, w, h, amount, seed = 1) {
  const r = rng(seed);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// draw something at (x, y) plus its wrapped copies so the texture tiles seamlessly
function wrapped(S, x, y, rad, fn) {
  for (const ox of [-S, 0, S]) {
    for (const oy of [-S, 0, S]) {
      const px = x + ox;
      const py = y + oy;
      if (px + rad < 0 || px - rad > S || py + rad < 0 || py - rad > S) continue;
      fn(px, py);
    }
  }
}

function spacing(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ── surfaces ────────────────────────────────────────────────────────────────

export function plasterTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, S, S);
  const r = rng(11);
  for (let i = 0; i < 170; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 30 + r() * 110;
    const dark = r() < 0.55;
    wrapped(S, x, y, rad, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, dark ? 'rgba(70,55,40,0.015)' : 'rgba(255,255,255,0.03)');
      g.addColorStop(1, 'rgba(128,128,128,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  noise(ctx, S, S, 5, 5);
  return toTexture(c, { repeat: 0.25 }); // 4 m tile
}

export function woodTexture() {
  const S = 1024;
  const rows = 22;
  const rh = S / rows;
  const [c, ctx] = makeCanvas(S);
  const r = rng(4);
  ctx.fillStyle = '#8a6a4c';
  ctx.fillRect(0, 0, S, S);
  for (let row = 0; row < rows; row++) {
    const y = row * rh;
    const start = r() * S;
    let x = start;
    while (x < start + S - 1) {
      let len = 200 + r() * 260;
      if (x + len > start + S - 120) len = start + S - x;
      const col = `hsl(${32 + r() * 5},${26 + r() * 8}%,${66 + r() * 6}%)`;
      const grains = Array.from({ length: 7 }, () => [r() * rh, 0.02 + r() * 0.05, r() * 6.28]);
      for (const ox of [0, -S]) {
        const px = x + ox;
        if (px + len < 0 || px > S) continue;
        ctx.fillStyle = col;
        ctx.fillRect(px + 1, y + 1, len - 2, rh - 2);
        const lg = ctx.createLinearGradient(px, 0, px + len, 0);
        lg.addColorStop(0, 'rgba(255,240,220,0.07)');
        lg.addColorStop(1, 'rgba(60,30,10,0.07)');
        ctx.fillStyle = lg;
        ctx.fillRect(px + 1, y + 1, len - 2, rh - 2);
        ctx.save();
        ctx.beginPath();
        ctx.rect(px + 1, y + 1, len - 2, rh - 2);
        ctx.clip();
        for (const [gy, ga, ph] of grains) {
          ctx.strokeStyle = `rgba(70,40,20,${ga})`;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          for (let k = 0; k <= len; k += 16) {
            const yy = y + gy + Math.sin(k * 0.012 + ph) * 3;
            if (k === 0) ctx.moveTo(px + k, yy);
            else ctx.lineTo(px + k, yy);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
      x += len;
    }
  }
  noise(ctx, S, S, 10, 9);
  const t = toTexture(c, { repeat: 0.25 });
  t.rotation = Math.PI / 2; // planks run along the corridor
  return t;
}

export function stoneTexture() {
  const S = 1024;
  const rows = 8;
  const rh = S / rows;
  const bw = S / 4;
  const [c, ctx] = makeCanvas(S);
  const r = rng(21);
  ctx.fillStyle = '#c8baa4';
  ctx.fillRect(0, 0, S, S);
  for (let row = 0; row < rows; row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let k = 0; k < 4; k++) {
      const x0 = k * bw + off;
      const y = row * rh;
      const col = `hsl(${36 + r() * 6}, ${20 + r() * 10}%, ${84 + r() * 5 - 2.5}%)`;
      for (const x of [x0, x0 - S]) {
        if (x + bw < 0 || x > S) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + 2, y + 2, bw - 4, rh - 4);
        const g = ctx.createLinearGradient(0, y, 0, y + rh);
        g.addColorStop(0, 'rgba(255,255,255,0.06)');
        g.addColorStop(1, 'rgba(90,70,50,0.08)');
        ctx.fillStyle = g;
        ctx.fillRect(x + 2, y + 2, bw - 4, rh - 4);
      }
    }
  }
  for (let i = 0; i < 60; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 20 + r() * 80;
    wrapped(S, x, y, rad, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, 'rgba(110,90,70,0.06)');
      g.addColorStop(1, 'rgba(110,90,70,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  noise(ctx, S, S, 14, 3);
  return toTexture(c, { repeat: 1 / 4.8 }); // 4.8 m tile, 0.6 m courses
}

export function pavingTexture() {
  const S = 512;
  const n = 4;
  const s = S / n;
  const [c, ctx] = makeCanvas(S);
  const r = rng(8);
  ctx.fillStyle = '#6d655b';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      ctx.fillStyle = `hsl(${32 + r() * 8}, ${10 + r() * 8}%, ${66 + r() * 10}%)`;
      ctx.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    }
  }
  noise(ctx, S, S, 18, 12);
  return toTexture(c, { repeat: 0.5 }); // 2 m tile
}

export function grassTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const r = rng(31);
  ctx.fillStyle = '#34462c';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 120; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 20 + r() * 70;
    const light = r() < 0.5;
    wrapped(S, x, y, rad, (px, py) => {
      const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
      g.addColorStop(0, light ? 'rgba(90,120,70,0.25)' : 'rgba(20,30,15,0.25)');
      g.addColorStop(1, 'rgba(50,70,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    });
  }
  noise(ctx, S, S, 30, 2);
  return toTexture(c, { repeat: 0.25 });
}

export function hedgeTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  const r = rng(17);
  ctx.fillStyle = '#2a3d27';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {
    const x = r() * S;
    const y = r() * S;
    const rad = 2 + r() * 5;
    const l = 18 + r() * 22;
    ctx.fillStyle = `hsl(${95 + r() * 30}, ${25 + r() * 20}%, ${l}%)`;
    wrapped(S, x, y, rad, (px, py) => {
      ctx.beginPath();
      ctx.ellipse(px, py, rad, rad * 0.6, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  noise(ctx, S, S, 20, 4);
  return toTexture(c, { repeat: 1 });
}

export function fluteTexture() {
  const [c, ctx] = makeCanvas(128, 8);
  const g = ctx.createLinearGradient(0, 0, 128, 0);
  g.addColorStop(0, '#fff');
  g.addColorStop(0.18, '#fff');
  g.addColorStop(0.5, '#555');
  g.addColorStop(0.82, '#fff');
  g.addColorStop(1, '#fff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 8);
  const t = toTexture(c, { srgb: false });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(20, 1);
  return t;
}

// ── light & glass ───────────────────────────────────────────────────────────

export function glowTexture() {
  const S = 128;
  const [c, ctx] = makeCanvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}

// soft pool of light a picture lamp throws on the wall
export function washTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  // brightest just under the lamp, fading out fully before the texture edges
  const g = ctx.createRadialGradient(S / 2, S * 0.28, 0, S / 2, S / 2, S * 0.49);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}

export function windowTexture() {
  const W = 256;
  const H = 512;
  const [c, ctx] = makeCanvas(W, H);
  const g = ctx.createLinearGradient(0, H, 0, 0);
  g.addColorStop(0, '#ffb867');
  g.addColorStop(0.55, '#ffd49a');
  g.addColorStop(1, '#ffe6c0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // curtains
  for (const side of [0, 1]) {
    const x0 = side ? W : 0;
    const cg = ctx.createLinearGradient(x0, 0, side ? W - 90 : 90, 0);
    cg.addColorStop(0, 'rgba(140,60,30,0.6)');
    cg.addColorStop(1, 'rgba(140,60,30,0)');
    ctx.fillStyle = cg;
    ctx.fillRect(side ? W - 90 : 0, 0, 90, H);
  }
  for (let x = 0; x < W; x += 12) {
    ctx.fillStyle = `rgba(150,80,40,${0.03 + 0.03 * Math.sin(x * 0.4)})`;
    ctx.fillRect(x, 0, 6, H);
  }
  // mullions
  ctx.fillStyle = '#3b2b20';
  ctx.fillRect(W / 2 - 4, 0, 8, H);
  for (const y of [0.42, 0.7]) ctx.fillRect(0, H * y - 4, W, 8);
  return toTexture(c);
}

export function roundWindowTexture() {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, '#ffe2b0');
  g.addColorStop(1, '#ffae5e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = '#3b2b20';
  ctx.lineWidth = 8;
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 4;
    ctx.beginPath();
    ctx.moveTo(S / 2 - Math.cos(a) * S, S / 2 - Math.sin(a) * S);
    ctx.lineTo(S / 2 + Math.cos(a) * S, S / 2 + Math.sin(a) * S);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S * 0.22, 0, Math.PI * 2);
  ctx.stroke();
  return toTexture(c);
}

// sunburst glass above the front door
export function fanlightTexture() {
  const W = 512;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  const g = ctx.createRadialGradient(W / 2, H, 0, W / 2, H, H);
  g.addColorStop(0, '#ffe8c2');
  g.addColorStop(1, '#ffb266');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#1d3a33';
  ctx.lineWidth = 9;
  for (let k = 1; k < 8; k++) {
    const a = Math.PI - (k * Math.PI) / 8;
    ctx.beginPath();
    ctx.moveTo(W / 2 + Math.cos(a) * 70, H - Math.sin(a) * 70);
    ctx.lineTo(W / 2 + Math.cos(a) * W, H - Math.sin(a) * W);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(W / 2, H, 70, Math.PI, 0);
  ctx.stroke();
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(W / 2, H, H - 7, Math.PI, 0);
  ctx.stroke();
  return toTexture(c);
}

export function skylightTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = 'rgba(190,178,160,1)';
  for (let k = 1; k < 4; k++) ctx.fillRect((k * S) / 4 - 3, 0, 6, S);
  for (let k = 1; k < 6; k++) ctx.fillRect(0, (k * S) / 6 - 3, S, 6);
  const e = ctx.createRadialGradient(S / 2, S / 2, S * 0.2, S / 2, S / 2, S * 0.75);
  e.addColorStop(0, 'rgba(255,255,255,0)');
  e.addColorStop(1, 'rgba(230,215,195,0.8)');
  ctx.fillStyle = e;
  ctx.fillRect(0, 0, S, S);
  return toTexture(c);
}

// ── typography ──────────────────────────────────────────────────────────────

export function signTexture({ eyebrow, title, ink, accent }) {
  const W = 2048;
  const H = 340;
  const [c, ctx] = makeCanvas(W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent;
  ctx.font = `500 42px ${SANS}`;
  spacing(ctx, 16);
  ctx.fillText(String(eyebrow).toUpperCase(), W / 2 + 8, 78);
  spacing(ctx, 0);
  ctx.fillRect(W / 2 - 50, 112, 100, 3);
  ctx.fillStyle = ink;
  ctx.font = `italic 400 168px ${SERIF}`;
  ctx.fillText(title, W / 2, 275, W - 100);
  return toTexture(c);
}

export function captionTexture({ title, date, ink, accent, video = false }) {
  const W = 1024;
  const H = 200;
  const [c, ctx] = makeCanvas(W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = `italic 500 74px ${SERIF}`;
  ctx.fillText(title, W / 2, 86, W - 40);
  const line = date ? String(date).toUpperCase() : video ? 'VIDEO' : '';
  if (line) {
    ctx.fillStyle = accent;
    ctx.font = `500 27px ${SANS}`;
    spacing(ctx, 9);
    const w = Math.min(ctx.measureText(line).width, W - 80);
    const shift = video ? 22 : 0; // make room for the play mark
    ctx.fillText(line, W / 2 + 4 + shift, 150, W - 80);
    if (video) {
      // a small ▶ before the date says "this one is a video"
      const x = W / 2 + shift - w / 2 - 30;
      ctx.beginPath();
      ctx.moveTo(x, 130);
      ctx.lineTo(x + 18, 140);
      ctx.lineTo(x, 150);
      ctx.closePath();
      ctx.fill();
    }
  }
  return toTexture(c);
}

export function panelTexture({ title, text, ink, accent }) {
  const W = 1400;
  const H = 1000;
  const [c, ctx] = makeCanvas(W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = ink;
  ctx.font = `italic 400 150px ${SERIF}`;
  ctx.fillText(title, W / 2, 200, W - 80);
  ctx.fillStyle = accent;
  ctx.fillRect(W / 2 - 60, 262, 120, 4);
  ctx.fillStyle = ink;
  ctx.font = `500 68px ${SERIF}`;
  const lines = wrapLines(ctx, text, 1200);
  lines.slice(0, 7).forEach((line, i) => ctx.fillText(line, W / 2, 390 + i * 94));
  return toTexture(c);
}

export function inscriptionTexture(text) {
  const W = 2560;
  const H = 180;
  const [c, ctx] = makeCanvas(W, H);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 116px ${SERIF}`;
  spacing(ctx, 38);
  ctx.fillStyle = 'rgba(255,248,235,0.55)';
  ctx.fillText(text, W / 2 + 19, H / 2 + 4, W - 60);
  ctx.fillStyle = '#6b5238';
  ctx.fillText(text, W / 2 + 19, H / 2, W - 60);
  return toTexture(c);
}

export function monogramTexture(initials) {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.strokeStyle = '#c9a468';
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 240, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, 214, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#c9a468';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 500 150px ${SERIF}`;
  ctx.fillText(initials, S / 2, S / 2 + 6, 380);
  return toTexture(c);
}

// ── placeholder photos ──────────────────────────────────────────────────────

const PALETTES = [
  ['#f6d5c3', '#e8a598', '#9c5058'],
  ['#e4e8d4', '#b3c29c', '#56724f'],
  ['#d9e1ec', '#9cb1cf', '#4a5d86'],
  ['#f3dfc5', '#e0ae80', '#8f5634'],
  ['#ecdcec', '#c0a3cc', '#654f7e'],
  ['#f8ebcd', '#ecc57f', '#94692a'],
];

// An abstract "two people at sunset" painting that also tells you which file to add.
export function placeholderPhoto({ seed, aspect, label, hint }) {
  const long = 1024;
  const w = aspect >= 1 ? long : Math.round(long * aspect);
  const h = aspect >= 1 ? Math.round(long / aspect) : long;
  const [c, ctx] = makeCanvas(w, h);
  const r = rng(seed * 31 + 7);
  const p = PALETTES[seed % PALETTES.length];
  const m = Math.min(w, h);

  const g = ctx.createLinearGradient(0, 0, w * 0.3, h);
  g.addColorStop(0, p[0]);
  g.addColorStop(1, p[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const sx = w * (0.3 + r() * 0.4);
  const sy = h * (0.3 + r() * 0.12);
  const sr = m * (0.16 + r() * 0.08);
  const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr * 2.4);
  sg.addColorStop(0, 'rgba(255,250,240,0.95)');
  sg.addColorStop(0.4, 'rgba(255,245,230,0.55)');
  sg.addColorStop(1, 'rgba(255,245,230,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(0, 0, w, h);

  // rolling hills
  for (let layer = 0; layer < 2; layer++) {
    ctx.fillStyle = layer ? p[2] : `${p[2]}88`;
    ctx.globalAlpha = layer ? 0.55 : 0.4;
    ctx.beginPath();
    const base = h * (0.66 + layer * 0.1);
    const ph = r() * 6;
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, base + Math.sin(x / w * 5 + ph) * h * 0.03);
    ctx.lineTo(w, h);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // two figures, side by side
  const cx = w / 2;
  const s = m * 0.12;
  const ground = h * 0.95;
  ctx.fillStyle = p[2];
  for (const dx of [-0.62, 0.62]) {
    const fx = cx + dx * s;
    ctx.beginPath();
    ctx.ellipse(fx, ground, s * 0.78, s * 1.5, 0, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fx, ground - s * 1.95, s * 0.46, 0, Math.PI * 2);
    ctx.fill();
  }
  // a tiny heart above them
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const hx = cx;
  const hy = ground - s * 3.05;
  const hs = s * 0.16;
  ctx.beginPath();
  ctx.moveTo(hx, hy + hs * 1.1);
  ctx.bezierCurveTo(hx - hs * 2, hy - hs * 0.4, hx - hs * 0.8, hy - hs * 1.6, hx, hy - hs * 0.5);
  ctx.bezierCurveTo(hx + hs * 0.8, hy - hs * 1.6, hx + hs * 2, hy - hs * 0.4, hx, hy + hs * 1.1);
  ctx.fill();

  noise(ctx, w, h, 16, seed + 1);

  // label
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.font = `italic 500 ${Math.round(m * 0.075)}px ${SERIF}`;
  ctx.fillText(label, m * 0.07, m * 0.14);
  ctx.font = `500 ${Math.round(m * 0.028)}px ${SANS}`;
  spacing(ctx, Math.round(m * 0.006));
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillText(String(hint).toUpperCase(), m * 0.07, m * 0.2, w - m * 0.14);

  return { canvas: c, texture: toTexture(c), aspect: w / h };
}
