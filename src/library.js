import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';

// The library: a panelled room, its four walls lined with classical bookcases
// holding your books (config.js → library.books).
// Each shelf holds copies of one of them, set out the way a real library is
// dressed: a run of spines, a copy standing face-out on a little stand, a few
// lying in a stack, brass bookends, a vase or a candlestick, a small framed
// photo, and a warm light glowing at the back of every shelf.
//
//  • the scroll takes you up to the shelves, close enough to read the spines
//  • hover a book (or anywhere along its shelf) and it lights up and slides
//    out; click and it comes off the shelf into your hands, shows its gilt
//    cover, and opens
//  • the words write themselves onto each page as you turn to it; the page
//    really turns, with the sound of paper
//  • put the book back with Esc, the button, or a click off the book

const rand = TX.rng(4242);
const rnd = (a = 0, b = 1) => a + rand() * (b - a);
const pickOne = (list) => list[Math.floor(rand() * list.length)];
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

const PAGE_W = 720;
const PAGE_H = 1008;
const FONT = '"Cormorant Garamond", Georgia, serif';
const SANS = 'Jost, "Helvetica Neue", Arial, sans-serif';
const lightColor = (hex) => new THREE.Color(hex).getHSL({}).l > 0.5;

// ── the spine atlas: one spine per book, leather for the boards, page edges ───
// RGB is the look; alpha marks the leather, which takes each book's own colour
function bookAtlas(kinds) {
  const Wd = 1024;
  const Ht = 512;
  const [, c] = TX.makeCanvas(Wd, Ht);
  const [, m] = TX.makeCanvas(Wd, Ht);
  const r = TX.rng(17);
  const grain = (x, y, w, h) => {
    for (let i = 0; i < (w * h) / 5; i++) {
      c.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.1})` : `rgba(0,0,0,${r() * 0.13})`;
      c.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1 + r() * 2);
    }
  };
  const leather = (x, y, w, h) => {
    c.fillStyle = '#d8d4ce';
    c.fillRect(x, y, w, h);
    grain(x, y, w, h);
    m.fillStyle = '#fff';
    m.fillRect(x, y, w, h);
  };
  const paint = (style, x, y, w, h) => {
    c.fillStyle = style;
    c.fillRect(x, y, w, h);
    m.fillStyle = '#000';
    m.fillRect(x, y, w, h);
  };
  const shade = (style, x, y, w, h) => {
    c.fillStyle = style;
    c.fillRect(x, y, w, h);
  };
  const text = (str, x, y, size, color, maxLen) => {
    for (const ctx of [c, m]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 2); // spines read top to bottom
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `italic 500 ${size}px ${FONT}`;
      ctx.fillStyle = ctx === c ? color : '#000';
      ctx.fillText(str, 0, 1, maxLen);
      ctx.restore();
    }
  };
  for (let v = 0; v < 8; v++) {
    const k = kinds[v % kinds.length];
    const x = v * 64;
    const gold = lightColor(k.color) ? '#4f3319' : '#e0b766';
    leather(x, 0, 64, Ht);
    // raised bands across the spine: a shadow under each, a highlight on top, gilt rules
    for (const f of [0.08, 0.2, 0.8, 0.92]) {
      const y = Ht * f;
      shade('rgba(0,0,0,0.42)', x, y + 3, 64, 4);
      shade('rgba(255,255,255,0.22)', x, y - 3, 64, 4);
      paint(gold, x + 2, y - 8, 60, 2);
      paint(gold, x + 2, y + 10, 60, 2);
    }
    // the title on a dark label between the bands, big enough to read
    const labelDark = lightColor(k.color) ? '#3b2a1d' : 'rgba(10,8,6,0.9)';
    paint(labelDark, x + 5, Ht * 0.245, 54, Ht * 0.51);
    paint(gold, x + 8, Ht * 0.255, 48, 2);
    paint(gold, x + 8, Ht * 0.745, 48, 2);
    const title = k.title;
    text(title, x + 32, Ht * 0.5, title.length > 24 ? 27 : title.length > 16 ? 32 : 38, lightColor(k.color) ? '#e9d6a8' : gold, Ht * 0.47);
    // a little tooling in the top and bottom panels
    for (const f of [0.14, 0.86]) {
      paint(gold, x + 29, Ht * f - 4, 6, 8);
      paint(gold, x + 22, Ht * f - 1, 20, 2);
    }
    // the curve of the spine: darker toward its edges
    const g = c.createLinearGradient(x, 0, x + 64, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.35)');
    g.addColorStop(0.18, 'rgba(0,0,0,0)');
    g.addColorStop(0.82, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = g;
    c.fillRect(x, 0, 64, Ht);
    shade('rgba(0,0,0,0.3)', x, 0, 64, 5);
    shade('rgba(0,0,0,0.3)', x, Ht - 5, 64, 5);
  }
  // leather for the boards (worn a little at the edges), and cream page edges
  leather(512, 0, 256, Ht);
  const e = c.createLinearGradient(512, 0, 768, 0);
  e.addColorStop(0, 'rgba(0,0,0,0.25)');
  e.addColorStop(0.1, 'rgba(0,0,0,0)');
  c.fillStyle = e;
  c.fillRect(512, 0, 256, Ht);
  paint('#eee3cb', 768, 0, 256, Ht);
  for (let i = 0; i < 140; i++) shade(`rgba(110,90,60,${0.06 + r() * 0.12})`, 768 + r() * 256, 0, 1, Ht);
  // combine into one texture, the leather mask in alpha (flipped for WebGL)
  const col = c.getImageData(0, 0, Wd, Ht).data;
  const msk = m.getImageData(0, 0, Wd, Ht).data;
  const data = new Uint8Array(Wd * Ht * 4);
  for (let y = 0; y < Ht; y++) {
    for (let x = 0; x < Wd; x++) {
      const s = (y * Wd + x) * 4;
      const d = ((Ht - 1 - y) * Wd + x) * 4;
      data[d] = col[s];
      data[d + 1] = col[s + 1];
      data[d + 2] = col[s + 2];
      data[d + 3] = msk[s];
    }
  }
  const t = new THREE.DataTexture(data, Wd, Ht, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 8;
  t.needsUpdate = true;
  return t;
}

// A real hardback, in unit size (scaled per book): two thin boards, a block of
// pages set in a little from their edges, and a rounded spine. The gaps and
// curves are what make a row of books read as separate books.
function bookGeometry() {
  const LEATHER = [0.51, 0.74];
  const PAPER = [0.76, 0.99];
  const parts = [];
  const box = (x0, x1, y0, y1, z0, z1, region) => {
    const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, region[0] + uv.getX(i) * (region[1] - region[0]));
    parts.push(g.toNonIndexed());
  };
  const B = 0.08; // board thickness, as a share of the book's thickness
  const JOINT = 0.47; // where the boards meet the spine
  box(-0.5, -0.5 + B, -0.5, 0.5, -0.5, JOINT, LEATHER);
  box(0.5 - B, 0.5, -0.5, 0.5, -0.5, JOINT, LEATHER);
  box(-0.5 + B, 0.5 - B, -0.485, 0.485, -0.487, JOINT, PAPER);
  // the rounded spine, and little caps closing its ends
  const N = 10;
  const pos = [];
  const uvs = [];
  const at = (s) => [-0.5 + s, JOINT + 0.03 * Math.sin(Math.PI * s)];
  for (let i = 0; i < N; i++) {
    const [xa, za] = at(i / N);
    const [xb, zb] = at((i + 1) / N);
    const ua = (i / N) * 0.0615 + 0.0005;
    const ub = ((i + 1) / N) * 0.0615 + 0.0005;
    pos.push(xa, -0.5, za, xb, -0.5, zb, xb, 0.5, zb, xa, -0.5, za, xb, 0.5, zb, xa, 0.5, za);
    uvs.push(ua, 0, ub, 0, ub, 1, ua, 0, ub, 1, ua, 1);
    for (const y of [-0.5, 0.5]) {
      const tri = y > 0 ? [xa, y, za, 0, y, JOINT - 0.02, xb, y, zb] : [xa, y, za, xb, y, zb, 0, y, JOINT - 0.02];
      pos.push(...tri);
      uvs.push(0.6, 0.5, 0.6, 0.5, 0.6, 0.5);
    }
  }
  const sp = new THREE.BufferGeometry();
  sp.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  sp.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  sp.computeVertexNormals();
  parts.push(sp);
  return mergeGeometries(parts);
}

function bookMaterial(atlas) {
  const mat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.62 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aVar;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nif (vMapUv.x < 0.0625) vMapUv.x += aVar * 0.0625;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat leather = sampledDiffuseColor.a; diffuseColor.a = 1.0;')
      .replace(
        '#include <color_fragment>',
        `#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vColor.rgb, leather);
        #endif`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(0.38, roughnessFactor, leather);');
  };
  mat.customProgramCacheKey = () => 'library-books';
  return mat;
}

// ── paper: the page background, with a soft shadow toward the spine ──────────
function paperBase(side) {
  const [c, x] = TX.makeCanvas(PAGE_W, PAGE_H);
  x.fillStyle = '#f3ead8';
  x.fillRect(0, 0, PAGE_W, PAGE_H);
  const r = TX.rng(side === 'left' ? 3 : 5);
  for (let i = 0; i < 5000; i++) {
    x.fillStyle = r() < 0.5 ? `rgba(120,95,60,${r() * 0.05})` : `rgba(255,255,255,${r() * 0.08})`;
    x.fillRect(r() * PAGE_W, r() * PAGE_H, 1 + r() * 2, 1 + r() * 2);
  }
  // the gutter darkens where the page curves into the spine; the edges age a little
  const gx = side === 'left' ? PAGE_W : 0;
  const g = x.createLinearGradient(gx, 0, side === 'left' ? PAGE_W - 150 : 150, 0);
  g.addColorStop(0, 'rgba(70,50,30,0.3)');
  g.addColorStop(1, 'rgba(70,50,30,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, PAGE_W, PAGE_H);
  const v = x.createRadialGradient(PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.35, PAGE_W / 2, PAGE_H / 2, PAGE_H * 0.8);
  v.addColorStop(0, 'rgba(150,110,60,0)');
  v.addColorStop(1, 'rgba(150,110,60,0.13)');
  x.fillStyle = v;
  x.fillRect(0, 0, PAGE_W, PAGE_H);
  return c;
}

// a little flourish for title pages
function ornament(x, cx, cy, s, color) {
  x.save();
  x.translate(cx, cy);
  x.strokeStyle = color;
  x.fillStyle = color;
  x.lineWidth = 1.6;
  x.beginPath();
  x.moveTo(-s, 0);
  x.bezierCurveTo(-s * 0.6, -s * 0.28, -s * 0.25, s * 0.28, 0, 0);
  x.bezierCurveTo(s * 0.25, -s * 0.28, s * 0.6, s * 0.28, s, 0);
  x.stroke();
  x.beginPath();
  x.moveTo(0, -7);
  x.lineTo(7, 0);
  x.lineTo(0, 7);
  x.lineTo(-7, 0);
  x.closePath();
  x.fill();
  x.restore();
}

// ── laying a book out into pages ──────────────────────────────────────────────
const BODY = `600 35px ${FONT}`; // (Cormorant's semibold: its hairlines stay solid at reading size)
const LINE = 50;
const MARGIN_IN = 104; // (the margin by the spine is wider, as in a real book)
const MARGIN_OUT = 62;
const TOP = 138;
const LINES = 16; // a sonnet, or most love poems, fit on a single page
function paginate(content) {
  const [, x] = TX.makeCanvas(8, 8);
  x.font = BODY;
  const maxW = PAGE_W - MARGIN_IN - MARGIN_OUT;
  const lines = [];
  for (const para of content.text.split('\n')) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    let line = '';
    const verse = para.length < 100; // (a long line of verse runs on indented; prose just wraps)
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word;
      if (x.measureText(test).width > maxW && line) {
        lines.push(line);
        line = verse ? `  ${word}` : word;
      } else line = test;
    }
    lines.push(line);
  }
  const pages = [{ kind: 'endpaper' }, { kind: 'title' }];
  for (let i = 0; i < lines.length; ) {
    // don't start a page on a blank line
    while (i < lines.length && lines[i] === '') i++;
    if (i >= lines.length) break;
    const chunk = lines.slice(i, i + LINES);
    // keep stanzas (and paragraphs) together where we can: break at the last blank line
    let take = chunk.length;
    if (i + LINES < lines.length) {
      const lastBlank = chunk.lastIndexOf('');
      if (lastBlank > LINES * 0.4) take = lastBlank;
    }
    pages.push({ kind: 'text', lines: lines.slice(i, i + take) });
    i += take;
  }
  pages.push({ kind: 'end' });
  if (pages.length % 2) pages.push({ kind: 'blank' });
  pages.forEach((p, i) => (p.number = i - 1));
  return pages;
}

// what gets written on a page, as a list of text runs with their own timing
function pageRuns(content, page, side) {
  const runs = [];
  const x0 = side === 'left' ? MARGIN_OUT : MARGIN_IN;
  if (page.kind === 'title') {
    runs.push({ text: content.title, font: `italic 500 ${content.title.length > 22 ? 50 : 62}px ${FONT}`, x: PAGE_W / 2, y: PAGE_H * 0.4, align: 'center', color: '#22180f', wrap: PAGE_W - 160, lineH: 66 });
    runs.push({ text: (content.author || '').toUpperCase(), font: `500 19px ${SANS}`, x: PAGE_W / 2, y: PAGE_H * 0.4 + 118, align: 'center', color: '#7a5a34', spacing: 6 });
  } else if (page.kind === 'text') {
    page.lines.forEach((l, i) => runs.push({ text: l, font: BODY, x: x0, y: TOP + i * LINE, align: 'left', color: '#1d1511' }));
  } else if (page.kind === 'end') {
    runs.push({ text: 'the end', font: `italic 500 34px ${FONT}`, x: PAGE_W / 2, y: PAGE_H * 0.44, align: 'center', color: '#7a5a34' });
  }
  return runs;
}

// Draw a page's ink, sharp and at high resolution, once. Alongside it, an
// "order" map records which character covers each pixel (as a 16-bit number in
// red and green), so the page shader can reveal the writing letter by letter,
// the newest fading in like wet ink, without the page ever being redrawn.
const INK_SCALE = 1.6; // ink texture pixels per page unit
const ORDER_SCALE = 0.8;
function drawPage(ink, order, content, page, runs, side) {
  ink.setTransform(1, 0, 0, 1, 0, 0);
  ink.clearRect(0, 0, ink.canvas.width, ink.canvas.height);
  ink.setTransform(INK_SCALE, 0, 0, INK_SCALE, 0, 0);
  order.setTransform(1, 0, 0, 1, 0, 0);
  order.fillStyle = '#000';
  order.fillRect(0, 0, order.canvas.width, order.canvas.height);
  // the running head and the page number (always there)
  if (page.kind === 'text' || page.kind === 'end') {
    ink.font = `500 17px ${SANS}`;
    ink.fillStyle = 'rgba(96,72,50,0.95)';
    ink.textAlign = 'center';
    ink.letterSpacing = '5px';
    ink.fillText((side === 'left' ? content.author || '' : content.title).toUpperCase().slice(0, 38), PAGE_W / 2, 72);
    ink.letterSpacing = '0px';
    ink.font = `italic 500 26px ${FONT}`;
    ink.fillText(String(page.number), PAGE_W / 2, PAGE_H - 52);
  }
  if (page.kind === 'title') ornament(ink, PAGE_W / 2, PAGE_H * 0.4 + 70, 70, 'rgba(150,108,58,0.95)');
  if (page.kind === 'end') ornament(ink, PAGE_W / 2, PAGE_H * 0.44 + 44, 46, 'rgba(150,108,58,0.85)');
  if (page.kind === 'endpaper') {
    ink.font = `italic 500 32px ${FONT}`;
    ink.fillStyle = 'rgba(92,66,44,0.92)';
    ink.textAlign = 'center';
    ink.fillText('for you', PAGE_W / 2, PAGE_H * 0.42);
    ornament(ink, PAGE_W / 2, PAGE_H * 0.42 + 42, 42, 'rgba(150,108,58,0.85)');
  }
  // the writing: every character drawn now, its place in the writing order mapped
  let index = 0; // matches charTimes(): each run's characters, then one for its line end
  for (const run of runs) {
    ink.font = run.font;
    ink.fillStyle = run.color;
    ink.textAlign = 'left';
    ink.letterSpacing = `${run.spacing || 0}px`;
    const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(run.font)[1]);
    const lines = run.wrap ? wrapLines(ink, run.text, run.wrap) : [run.text];
    lines.forEach((ln, li) => {
      const y = run.y + li * (run.lineH || 0);
      const x0 = run.align === 'center' ? run.x - ink.measureText(ln).width / 2 : run.x;
      ink.fillText(ln, x0, y);
      let b = x0;
      for (let i = 0; i < ln.length; i++) {
        const a = b;
        b = x0 + ink.measureText(ln.slice(0, i + 1)).width;
        const code = index + i + 1;
        order.fillStyle = `rgb(${code >> 8},${code & 255},0)`;
        const px0 = Math.floor((a - 1) * ORDER_SCALE);
        const px1 = Math.ceil((b + 2) * ORDER_SCALE);
        const py0 = Math.floor((y - size * 0.95) * ORDER_SCALE);
        const py1 = Math.ceil((y + size * 0.35) * ORDER_SCALE);
        order.fillRect(px0, py0, px1 - px0, py1 - py0);
      }
      index += ln.length + 1;
    });
  }
  ink.letterSpacing = '0px';
}
function wrapLines(ctx, text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) {
      out.push(line);
      line = w;
    } else line = t;
  }
  out.push(line);
  return out;
}
// how long each character takes to write: a steady hand, pausing at the ends of lines
// (for wrapped runs, the space where a line breaks stands in for the line end)
function charTimes(runs) {
  const times = [];
  let t = 0.25;
  for (const run of runs) {
    for (const ch of run.text + '\n') {
      t += ch === '\n' ? 0.22 : '.!?'.includes(ch) ? 0.2 : ',;:'.includes(ch) ? 0.09 : ch === ' ' ? 0.035 : 0.028;
      times.push(t);
    }
  }
  return times;
}

// the front cover: the title in gold foil inside a tooled border
function coverTexture(content, color) {
  const [c, x] = TX.makeCanvas(512, 716);
  x.fillStyle = color;
  x.fillRect(0, 0, 512, 716);
  const r = TX.rng(content.title.length * 7);
  for (let i = 0; i < 9000; i++) {
    x.fillStyle = r() < 0.5 ? `rgba(255,255,255,${r() * 0.07})` : `rgba(0,0,0,${r() * 0.12})`;
    x.fillRect(r() * 512, r() * 716, 1 + r() * 2, 1 + r() * 2);
  }
  const light = new THREE.Color(color).getHSL({}).l > 0.5;
  const gold = light ? '#6a4a26' : '#d9b264';
  x.strokeStyle = gold;
  x.lineWidth = 3;
  x.strokeRect(34, 34, 444, 648);
  x.lineWidth = 1.2;
  x.strokeRect(46, 46, 420, 624);
  x.fillStyle = gold;
  x.textAlign = 'center';
  x.font = `italic 500 ${content.title.length > 20 ? 38 : 50}px ${FONT}`;
  wrapLines(x, content.title, 360).forEach((l, i, a) => x.fillText(l, 256, 300 - (a.length - 1) * 26 + i * 54));
  x.font = `400 15px ${SANS}`;
  x.letterSpacing = '5px';
  x.fillText((content.author || '').toUpperCase().slice(0, 30), 256, 420);
  x.letterSpacing = '0px';
  ornament(x, 256, 360, 60, gold);
  const t = TX.toTexture(c);
  t.anisotropy = 8;
  return t;
}
// marbled endpapers inside the covers
function marbleTexture() {
  const [c, x] = TX.makeCanvas(256, 356);
  x.fillStyle = '#e9dfcb';
  x.fillRect(0, 0, 256, 356);
  const r = TX.rng(8);
  for (let k = 0; k < 60; k++) {
    x.strokeStyle = ['rgba(130,60,50,0.16)', 'rgba(40,70,90,0.14)', 'rgba(170,130,70,0.18)'][k % 3];
    x.lineWidth = 2 + r() * 6;
    x.beginPath();
    let px = r() * 256;
    let py = r() * 356;
    x.moveTo(px, py);
    for (let s = 0; s < 8; s++) {
      px += (r() - 0.5) * 60;
      py += r() * 40;
      x.quadraticCurveTo(px + (r() - 0.5) * 40, py - 20, px, py);
    }
    x.stroke();
  }
  return TX.toTexture(c);
}

export function buildLibrary(config, room, { W, D, H, zStart, zEnd }, { sfx = () => {}, photos = [] } = {}) {
  const group = new THREE.Group();
  const couple = config.couple || '';
  const kinds = (config.library?.books || []).map((b) => ({ ...b, author: b.author || couple, color: b.color || '#5b1f22' }));
  if (!kinds.length) kinds.push({ title: 'Our Story', author: couple, color: '#5b1f22', text: 'Write our story here, in config.js.' });
  // copies of the same book are the same book: one size each
  kinds.forEach((k, i) => {
    k.t = 0.05 + ((i * 3) % 5) * 0.005;
    k.h = 0.29 + ((i * 7) % 4) * 0.015;
    k.d = 0.21;
    k.var = i % 8;
  });
  const zOf = (d) => zStart - d; // d: metres into the room from its entrance

  // ── materials ──
  const woodTex = TX.woodTexture();
  woodTex.repeat.set(0.5, 0.5);
  const M = {
    wood: new THREE.MeshStandardMaterial({ color: '#6a4228', map: woodTex, roughness: 0.42 }),
    woodDark: new THREE.MeshStandardMaterial({ color: '#3b2517', map: woodTex, roughness: 0.5 }),
    panel: new THREE.MeshStandardMaterial({ color: '#2e1c12', map: woodTex, roughness: 0.55 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c79c55', metalness: 1, roughness: 0.3 }),
    gilt: new THREE.MeshStandardMaterial({ color: '#b98f4e', metalness: 0.8, roughness: 0.35 }),
    leather: new THREE.MeshStandardMaterial({ color: '#5c2a1e', roughness: 0.45 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#efe9df', roughness: 0.18 }),
    ceramicBlue: new THREE.MeshStandardMaterial({ color: '#2f4a6b', roughness: 0.2 }),
    terracotta: new THREE.MeshStandardMaterial({ color: '#a8603c', roughness: 0.8 }),
    leaf: new THREE.MeshStandardMaterial({ color: '#3f6b35', roughness: 0.6 }),
    banker: new THREE.MeshStandardMaterial({ color: '#1f5c3a', roughness: 0.2, metalness: 0.3, emissive: '#0d2e1c', side: THREE.DoubleSide }),
    silk: new THREE.MeshStandardMaterial({ color: '#f2e2c4', roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0.32, side: THREE.DoubleSide }),
    candle: new THREE.MeshStandardMaterial({ color: '#f3ecdc', roughness: 0.6 }),
    paper: new THREE.MeshStandardMaterial({ color: '#efe5cf', roughness: 0.9 }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.42, 0.9) }),
    led: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.08, 0.78, 0.46) }),
    glass: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.55, 1.24, 0.82), transparent: true, opacity: 0.72 }),
    hit: new THREE.MeshBasicMaterial({ visible: false }),
  };
  const add = (mesh, x, y, z, parent = group) => {
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const glowTex = TX.glowTexture();
  const glow = (parent, x, y, z, sx, sy, color, opacity) => {
    const s = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })), x, y, z, parent);
    s.scale.set(sx, sy, 1);
    return s;
  };

  // ── books ──
  const atlas = bookAtlas(kinds);
  const unitBook = bookGeometry();
  const bookMat = bookMaterial(atlas);
  const books = []; // every book you can take down: { mesh, id, matrix, slide, content, size, faceOut }
  const meshes = [];
  const rows = [];
  // copies standing face-out, cover to the room: one instanced mesh per book, built at the end
  const faceOut = kinds.map(() => []);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();
  let shelfNo = 0;

  // small things people keep on their shelves
  const decor = {
    vase(g, x, y, z) {
      const pts = [[0, 0], [0.05, 0], [0.065, 0.03], [0.075, 0.1], [0.06, 0.17], [0.035, 0.21], [0.04, 0.24], [0.048, 0.25]];
      add(new THREE.Mesh(new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 28), rand() < 0.5 ? M.ceramic : M.ceramicBlue), x, y, z, g);
      return 0.16;
    },
    candle(g, x, y, z) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.045, 0.03, 16), M.brass), x, y + 0.015, z, g);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.12, 12), M.brass), x, y + 0.09, z, g);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.1, 12), M.candle), x, y + 0.2, z, g);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), M.bulb), x, y + 0.262, z, g).scale.y = 1.8;
      glow(g, x, y + 0.27, z + 0.02, 0.18, 0.22, '#ffb35c', 0.26);
      return 0.12;
    },
    plant(g, x, y, z) {
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.1, 16), M.terracotta), x, y + 0.05, z, g);
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2 + rand();
        const leaf = add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 6), M.leaf), x + Math.cos(a) * 0.035, y + 0.13 + rand() * 0.05, z + Math.sin(a) * 0.035, g);
        leaf.scale.set(0.6, 1.4, 0.3);
        leaf.rotation.set(Math.cos(a) * 0.6, a, Math.sin(a) * 0.6);
      }
      return 0.15;
    },
    photo(g, x, y, z) {
      const p = photos.length ? pickOne(photos) : null;
      const w = 0.13;
      const h = p ? Math.min(0.18, w / p.aspect) : 0.17;
      const f = new THREE.Group();
      f.position.set(x, y, z - 0.03);
      f.rotation.x = -0.14; // propped up, leaning back
      g.add(f);
      add(new THREE.Mesh(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.015), M.gilt), 0, h / 2 + 0.015, 0, f);
      add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: p?.texture || null, color: p ? '#ffffff' : '#c8b89c', roughness: 0.4 })), 0, h / 2 + 0.015, 0.0085, f);
      return w + 0.05;
    },
    bookend(g, x, y, z, flip = 1) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.17, 0.12), M.brass), x, y + 0.085, z, g);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.008, 0.12), M.brass), x + flip * 0.05, y + 0.004, z, g);
      return 0.03;
    },
  };

  // a classical bookcase `len` wide at (x, z), facing `rot` (0 = facing +z):
  // closed cupboards at the bottom, open shelves above with a warm light in each
  const CASE_H = 4.3;
  const DEPTH = 0.4;
  const SHELVES = [0.92, 1.42, 1.92, 2.42, 2.92, 3.42, 3.9];
  function bookcase(len, x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    group.add(g);
    g.updateMatrix();
    const bays = Math.max(1, Math.round(len / 1.15));
    const bw = len / bays;
    const front = DEPTH / 2;
    // the carcass: plinth, cornice, pilasters between the bays
    add(new THREE.Mesh(new THREE.BoxGeometry(len + 0.06, 0.12, DEPTH + 0.04), M.woodDark), 0, 0.06, 0.01, g);
    add(new THREE.Mesh(new THREE.BoxGeometry(len + 0.04, 0.06, DEPTH + 0.02), M.wood), 0, CASE_H - 0.03, 0, g);
    add(new THREE.Mesh(new THREE.BoxGeometry(len + 0.14, 0.1, DEPTH + 0.1), M.woodDark), 0, CASE_H + 0.05, 0.03, g);
    add(new THREE.Mesh(new THREE.BoxGeometry(len + 0.2, 0.05, DEPTH + 0.14), M.wood), 0, CASE_H + 0.125, 0.04, g);
    add(new THREE.Mesh(new THREE.BoxGeometry(len + 0.08, 0.03, 0.02), M.gilt), 0, CASE_H - 0.07, front + 0.012, g);
    for (let b = 0; b <= bays; b++) {
      const px = -len / 2 + b * bw;
      add(new THREE.Mesh(new THREE.BoxGeometry(0.06, CASE_H, DEPTH), M.wood), px, CASE_H / 2, 0, g);
      // a fluted pilaster face
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, CASE_H - 0.3, 0.02), M.woodDark), px, CASE_H / 2 + 0.05, front + 0.01, g);
      for (const f of [-0.022, 0, 0.022]) add(new THREE.Mesh(new THREE.BoxGeometry(0.008, CASE_H - 0.5, 0.008), M.wood), px + f, CASE_H / 2 + 0.05, front + 0.022, g);
    }
    // the back panel, lit warmly at the top of every compartment (like lamps tucked under the shelves)
    add(new THREE.Mesh(new THREE.PlaneGeometry(len, CASE_H), backPanel(len, bays)), 0, CASE_H / 2, -DEPTH / 2 + 0.012, g);
    // cupboards below, with panelled doors and brass knobs
    for (let b = 0; b < bays; b++) {
      const cx = -len / 2 + (b + 0.5) * bw;
      for (const s of [-1, 1]) {
        const dx = cx + (s * bw) / 4;
        add(new THREE.Mesh(new THREE.BoxGeometry(bw / 2 - 0.03, 0.72, 0.03), M.wood), dx, 0.5, front - 0.01, g);
        add(new THREE.Mesh(new THREE.BoxGeometry(bw / 2 - 0.15, 0.56, 0.02), M.woodDark), dx, 0.5, front + 0.008, g);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), M.brass), cx + s * 0.035, 0.62, front + 0.02, g);
      }
    }
    // the shelves: each one a single book, set out as a library would be
    const items = [];
    for (let s = 0; s < SHELVES.length - 1; s++) {
      const y = SHELVES[s];
      add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, DEPTH - 0.02), M.wood), 0, y - 0.0175, 0.005, g);
      add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.02, 0.02), M.gilt), 0, y - 0.01, front - 0.002, g);
      const kind = kinds[shelfNo++ % kinds.length];
      const row = { g, recs: [] };
      for (let b = 0; b < bays; b++) {
        const x0 = -len / 2 + b * bw + 0.05;
        const x1 = -len / 2 + (b + 1) * bw - 0.05;
        dressBay(g, items, row, x0, x1, y, kind);
        // a thin warm light under the shelf above
        add(new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 0.04, 0.008, 0.012), M.led), (x0 + x1) / 2, SHELVES[s + 1] - 0.04, front - 0.05, g);
      }
      const clear = SHELVES[s + 1] - y;
      const box = add(new THREE.Mesh(new THREE.BoxGeometry(len, clear, 0.04), M.hit), 0, y + clear / 2, front - 0.02, g);
      box.userData.row = row;
      rows.push(row);
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.035, DEPTH - 0.02), M.wood), 0, SHELVES[SHELVES.length - 1] - 0.0175, 0.005, g);
    // the books standing spine-out (and lying in stacks), all in one instanced mesh
    if (items.length) {
      const geo = unitBook.clone();
      const vars = new Float32Array(items.length);
      items.forEach((it, i) => (vars[i] = it.kind.var));
      geo.setAttribute('aVar', new THREE.InstancedBufferAttribute(vars, 1));
      const mesh = new THREE.InstancedMesh(geo, bookMat, items.length);
      const color = new THREE.Color();
      items.forEach((it, i) => {
        e.set(0, it.rotY || 0, it.rotZ || 0);
        q.setFromEuler(e);
        m4.compose(v3.set(it.x, it.y, it.z), q, s3.set(it.kind.t, it.kind.h, it.kind.d));
        mesh.setMatrixAt(i, m4);
        color.set(it.kind.color).offsetHSL(0, 0, rnd(-0.025, 0.02)); // (each copy a touch more or less worn)
        mesh.setColorAt(i, color);
        Object.assign(it.rec, { mesh, id: i, matrix: m4.clone(), color: color.clone(), slide: new THREE.Vector3(0, 0, 1) });
      });
      mesh.computeBoundingSphere();
      g.add(mesh);
      meshes.push(mesh);
    }
    return g;
  }
  function backPanel(len, bays) {
    const ppm = 90;
    const [c, x] = TX.makeCanvas(Math.round(len * ppm), Math.round(CASE_H * ppm));
    x.fillStyle = '#2a1a10';
    x.fillRect(0, 0, c.width, c.height);
    // the grain of the wood
    const r = TX.rng(Math.round(len * 10));
    for (let i = 0; i < 400; i++) {
      x.fillStyle = `rgba(${r() < 0.5 ? '90,60,35' : '15,9,5'},${0.15 + r() * 0.2})`;
      x.fillRect(r() * c.width, 0, 1 + r() * 3, c.height);
    }
    const em = TX.makeCanvas(c.width, c.height);
    em[1].fillStyle = '#000';
    em[1].fillRect(0, 0, c.width, c.height);
    const bw = c.width / bays;
    for (let s = 0; s < SHELVES.length - 1; s++) {
      const top = (CASE_H - SHELVES[s + 1]) * ppm;
      const bottom = (CASE_H - SHELVES[s]) * ppm;
      for (let b = 0; b < bays; b++) {
        const cx = (b + 0.5) * bw;
        const g = em[1].createRadialGradient(cx, top, 0, cx, top, (bottom - top) * 1.3);
        g.addColorStop(0, 'rgba(255,190,110,0.62)');
        g.addColorStop(0.45, 'rgba(255,160,80,0.22)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        em[1].fillStyle = g;
        em[1].fillRect(b * bw, top, bw, bottom - top);
      }
    }
    return new THREE.MeshStandardMaterial({ map: TX.toTexture(c), emissive: '#ffffff', emissiveMap: TX.toTexture(em[0]), emissiveIntensity: 0.24, roughness: 0.68 });
  }
  // lay out one bay of one shelf: never packed solid; a run of spines, and company
  function dressBay(g, items, row, x0, x1, y, kind) {
    const z = DEPTH / 2 - 0.03 - kind.d / 2; // spines 3cm back from the shelf edge
    let x = x0;
    const spines = (n, lean = false) => {
      for (let i = 0; i < n && x + kind.t < x1; i++) {
        const last = lean && i === n - 1;
        const tilt = last ? -0.22 : (rand() - 0.5) * 0.02;
        const px = x + kind.t / 2 + (last ? Math.sin(-tilt) * kind.h * 0.5 : 0);
        const rec = { content: kind, size: new THREE.Vector3(kind.t, kind.h, kind.d) };
        items.push({ x: px, y: y + (Math.cos(tilt) * kind.h) / 2 + (Math.abs(Math.sin(tilt)) * kind.t) / 2, z: z - rnd(0, 0.008), rotZ: tilt, kind, rec });
        row.recs.push(Object.assign(rec, { x: px }));
        books.push(rec);
        x += kind.t + 0.004 + rand() * 0.004 + (last ? Math.sin(-tilt) * kind.h : 0);
      }
    };
    const stack = (n, then) => {
      const cx = x + kind.h / 2 + 0.01;
      let yy = y;
      for (let i = 0; i < n; i++) {
        const rec = { content: kind, size: new THREE.Vector3(kind.t, kind.h, kind.d) };
        items.push({ x: cx + rnd(-0.012, 0.012), y: yy + kind.t / 2, z: z + 0.01, rotZ: Math.PI / 2, rotY: rnd(-0.06, 0.06), kind, rec });
        row.recs.push(Object.assign(rec, { x: cx }));
        books.push(rec);
        yy += kind.t;
      }
      if (then) then(g, cx, yy, z + 0.02);
      x += kind.h + 0.04;
    };
    const standing = () => {
      // a copy standing face-out on a little wooden stand, cover to the room
      const cx = x + kind.d / 2 + 0.01;
      const lean = -0.2;
      add(new THREE.Mesh(new THREE.BoxGeometry(kind.d * 0.8, 0.02, 0.1), M.woodDark), cx, y + 0.01, DEPTH / 2 - 0.12, g);
      const back = add(new THREE.Mesh(new THREE.BoxGeometry(0.02, kind.h * 0.6, 0.012), M.woodDark), cx, y + kind.h * 0.3, DEPTH / 2 - 0.2, g);
      back.rotation.x = lean;
      const rec = { content: kind, size: new THREE.Vector3(kind.t, kind.h, kind.d), faceOut: true };
      faceOut[kinds.indexOf(kind)].push({ g, x: cx, y: y + 0.02 + (kind.h / 2) * Math.cos(lean), z: DEPTH / 2 - 0.13 + (kind.h / 2) * Math.sin(lean), lean, rec });
      row.recs.push(Object.assign(rec, { x: cx }));
      books.push(rec);
      x += kind.d + 0.05;
    };
    const thing = (f) => {
      const w = decor[f](g, x + 0.07, y, DEPTH / 2 - 0.16);
      x += Math.max(w, 0.12) + 0.03;
    };
    const room = () => x1 - x;
    const fit = (w) => Math.max(3, Math.floor((room() - w) / (kind.t + 0.006)));
    switch (Math.floor(rand() * 5)) {
      case 0:
        x += decor.bookend(g, x, y, z, 1);
        spines(Math.min(12, fit(0.3)));
        x += 0.06;
        thing('vase');
        break;
      case 1:
        standing();
        spines(Math.min(7, fit(0.42)));
        x += 0.04;
        stack(3, (gg, cx, yy, zz) => decor.candle(gg, cx, yy, zz));
        break;
      case 2:
        spines(Math.min(10, fit(0.32)), true);
        x += 0.08;
        thing(photos.length || rand() < 0.5 ? 'photo' : 'plant');
        break;
      case 3:
        stack(4, (gg, cx, yy, zz) => decor.plant(gg, cx, yy, zz));
        spines(Math.min(9, fit(0.06)));
        x += decor.bookend(g, x + 0.005, y, z, -1);
        break;
      default:
        thing('vase');
        spines(Math.min(8, fit(0.36)));
        x += 0.04;
        standing();
    }
  }

  // ── bookcases on all four walls ──
  for (const side of [-1, 1]) {
    for (const [d0, d1] of [[0.5, 4.8], [4.8, 9.1], [9.1, 13.4]]) {
      bookcase(d1 - d0, side * (W / 2 - DEPTH / 2 - 0.02), zOf((d0 + d1) / 2), side * -Math.PI / 2);
    }
    bookcase(4.6, side * 5.0, zEnd + DEPTH / 2 + 0.02, 0);
    bookcase(4.6, side * 5.0, zStart - DEPTH / 2 - 0.02, Math.PI);
  }
  // the copies standing face-out: one instanced mesh per book, cover textured
  kinds.forEach((kind, k) => {
    const list = faceOut[k];
    if (!list.length) return;
    const coverM = new THREE.MeshStandardMaterial({ map: coverTexture(kind, kind.color), roughness: 0.5 });
    const leatherM = new THREE.MeshStandardMaterial({ color: kind.color, roughness: 0.55 });
    const pagesM = new THREE.MeshStandardMaterial({ color: '#eee3cb', roughness: 0.9 });
    const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(kind.d, kind.h, kind.t), [pagesM, leatherM, pagesM, pagesM, coverM, leatherM], list.length);
    const local = new THREE.Matrix4();
    list.forEach((f, i) => {
      e.set(f.lean, 0, 0);
      q.setFromEuler(e);
      local.compose(v3.set(f.x, f.y, f.z), q, s3.set(1, 1, 1));
      m4.multiplyMatrices(f.g.matrix, local);
      mesh.setMatrixAt(i, m4);
      const out = new THREE.Vector3(0, 0, 1).applyQuaternion(f.g.quaternion);
      Object.assign(f.rec, { mesh, id: i, matrix: m4.clone(), color: new THREE.Color(kind.color), slide: out, plain: true });
    });
    mesh.computeBoundingSphere();
    group.add(mesh);
    meshes.push(mesh);
  });

  // ── the room: a coffered ceiling, wall lamps, a Persian rug ──
  {
    const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(W, D), M.panel), 0, H - 0.02, zOf(D / 2));
    ceil.rotation.x = Math.PI / 2;
    for (let k = 1; k < 8; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.24, D), M.woodDark), -W / 2 + k * 2, H - 0.14, zOf(D / 2));
    for (let k = 1; k < 7; k++) add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, 0.2), M.woodDark), 0, H - 0.13, zOf(k * 2));
    // a crown moulding and a gilt picture rail round the walls
    for (const side of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, D), M.wood), side * (W / 2 - 0.125), H - 0.15, zOf(D / 2));
      add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, D), M.gilt), side * (W / 2 - 0.015), 4.75, zOf(D / 2));
    }
    // brass wall lamps with silk shades, above the bookcases
    for (const side of [-1, 1]) {
      for (const d of [2.65, 6.95, 11.25]) {
        const x = side * (W / 2 - 0.05);
        const z = zOf(d);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.12), M.brass), x, 5.05, z);
        const arm = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), M.brass), x - side * 0.14, 5.1, z);
        arm.rotation.z = Math.PI / 2;
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.16, 20, 1, true), M.silk), x - side * 0.28, 5.2, z);
        glow(group, x - side * 0.3, 5.1, z, 1.6, 1.6, '#ffcf8f', 0.18);
      }
    }
    // the rug: a big Persian carpet
    const [c, x] = TX.makeCanvas(768, 1024);
    x.fillStyle = '#6b1d22';
    x.fillRect(0, 0, 768, 1024);
    const r = TX.rng(6);
    const border = (inset, w, color) => {
      x.strokeStyle = color;
      x.lineWidth = w;
      x.strokeRect(inset, inset, 768 - inset * 2, 1024 - inset * 2);
    };
    border(14, 10, '#d7b675');
    border(40, 36, '#1d2a45');
    for (let k = 0; k < 60; k++) {
      // little flowers along the border
      const t = k / 60;
      const [px, py] = t < 0.5 ? [40 + t * 2 * 688, t < 0.25 ? 40 : 984] : [t < 0.75 ? 40 : 728, 40 + (t - 0.5) * 4 * 944];
      x.fillStyle = k % 2 ? '#c9a46a' : '#a33a32';
      x.beginPath();
      x.arc(px, py, 7, 0, Math.PI * 2);
      x.fill();
    }
    border(70, 6, '#d7b675');
    // the central medallion
    x.save();
    x.translate(384, 512);
    for (const [rad, col] of [[210, '#1d2a45'], [180, '#c9a46a'], [150, '#8a2a2c'], [110, '#e3cf9c'], [70, '#1d2a45'], [30, '#c9a46a']]) {
      x.fillStyle = col;
      x.beginPath();
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        const rr = rad * (k % 2 ? 0.82 : 1);
        x.lineTo(Math.cos(a) * rr * 0.8, Math.sin(a) * rr);
      }
      x.closePath();
      x.fill();
    }
    x.restore();
    for (const [cx, cy] of [[140, 150], [628, 150], [140, 874], [628, 874]]) {
      x.fillStyle = '#1d2a45';
      x.beginPath();
      x.arc(cx, cy, 55, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = '#c9a46a';
      x.beginPath();
      x.arc(cx, cy, 30, 0, Math.PI * 2);
      x.fill();
    }
    for (let i = 0; i < 60000; i++) {
      x.fillStyle = `rgba(0,0,0,${r() * 0.1})`;
      x.fillRect(r() * 768, r() * 1024, 2, 2);
    }
    const rug = add(new THREE.Mesh(new THREE.PlaneGeometry(6, 8), new THREE.MeshStandardMaterial({ map: TX.toTexture(c), roughness: 1 })), 0, 0.006, zOf(7.2));
    rug.rotation.x = -Math.PI / 2;
  }

  // ── a round reading table under the chandelier, two armchairs, a globe ──
  function chair(x, z, rot) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    group.add(g);
    const box = (w, h, d, px, py, pz, r = 0.06) => add(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), M.leather), px, py, pz, g);
    box(0.86, 0.2, 0.8, 0, 0.42, 0.02);
    box(0.9, 0.3, 0.86, 0, 0.22, 0);
    box(0.9, 0.66, 0.2, 0, 0.82, -0.36, 0.08);
    for (const s of [-1, 1]) box(0.16, 0.36, 0.84, s * 0.44, 0.52, 0, 0.07);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.08, 8), M.woodDark), sx * 0.38, 0.04, sz * 0.35, g);
  }
  {
    const tz = zOf(7.4);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.05, 48), M.wood), 0, 0.76, tz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.7, 20), M.woodDark), 0, 0.38, tz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.06, 28), M.woodDark), 0, 0.03, tz);
    // a green banker's lamp
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.03, 20), M.brass), 0.2, 0.8, tz - 0.12);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), M.brass), 0.2, 0.95, tz - 0.12);
    // (the shade: a long half-tube of green glass, curved side up, tipped toward the reader)
    const shade = add(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.34, 24, 1, true, 0, Math.PI), M.banker), 0.2, 1.1, tz - 0.12);
    shade.rotation.set(-0.25, 0, Math.PI / 2);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.018, 0.018), M.bulb), 0.2, 1.08, tz - 0.12);
    glow(group, 0.2, 0.9, tz - 0.05, 1.3, 0.55, '#ffe0a8', 0.24);
    // an open book, and a candle
    add(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.23), M.paper), -0.2, 0.795, tz + 0.15).rotation.y = 0.35;
    decor.candle(group, -0.45, 0.785, tz - 0.25);
    for (const s of [-1, 1]) chair(s * 1.55, tz, -s * Math.PI / 2);
    // the globe
    const gx = 3.1;
    const gz = zOf(10.4);
    const globe = add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 24), new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.4 })), gx, 1.04, gz);
    globe.rotation.z = 0.41;
    add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.01, 8, 48), M.brass), gx, 1.04, gz).rotation.set(0, Math.PI / 2, 0.41);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.16, 0.8, 16), M.woodDark), gx, 0.4, gz);
  }
  function globeTexture() {
    const [c, x] = TX.makeCanvas(512, 256);
    x.fillStyle = '#b9a27a';
    x.fillRect(0, 0, 512, 256);
    const r = TX.rng(12);
    x.fillStyle = '#6f7d58';
    for (let k = 0; k < 28; k++) {
      x.beginPath();
      x.ellipse(r() * 512, 40 + r() * 176, 20 + r() * 50, 12 + r() * 30, r() * 3, 0, Math.PI * 2);
      x.fill();
    }
    x.strokeStyle = 'rgba(80,60,40,0.35)';
    for (let k = 0; k < 12; k++) {
      x.beginPath();
      x.moveTo((k * 512) / 12, 0);
      x.lineTo((k * 512) / 12, 256);
      x.stroke();
    }
    return TX.toTexture(c);
  }

  // ── a rolling library ladder on the right-hand wall ──
  {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, D - 0.6, 8), M.brass), W / 2 - 0.3, 3.98, zOf(D / 2)).rotation.x = Math.PI / 2;
    const g = new THREE.Group();
    g.position.set(W / 2 - 0.72, 0, zOf(10.3));
    g.rotation.z = 0.2;
    group.add(g);
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 4.1, 0.07), M.wood), 0, 2.05, s * 0.25, g);
    for (let k = 0; k < 12; k++) add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.5), M.wood), 0, 0.3 + k * 0.32, 0, g);
  }

  // ── a brass chandelier with candle bulbs, over the table ──
  {
    const ch = new THREE.Group();
    ch.position.set(0, H - 1.8, zOf(7.4));
    group.add(ch);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 6), M.brass), 0, 0.9, 0, ch);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), M.brass), 0, 0, 0, ch);
    for (const [rad, n, y] of [[0.75, 10, -0.1], [0.45, 6, 0.28]]) {
      add(new THREE.Mesh(new THREE.TorusGeometry(rad, 0.018, 8, 48), M.brass), 0, y, 0, ch).rotation.x = Math.PI / 2;
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2;
        const cx = Math.cos(a) * rad;
        const cz = Math.sin(a) * rad;
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 8), M.candle), cx, y + 0.08, cz, ch);
        add(new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), M.glass), cx, y + 0.18, cz, ch).scale.y = 1.6;
      }
    }
    glow(ch, 0, 0.05, 0, 2.8, 1.8, '#ffcf8f', 0.2);
  }

  // ── everything that never moves is merged into one mesh per material, so
  // thousands of little pieces cost a handful of draw calls ──
  {
    group.updateMatrixWorld(true);
    const inv = group.matrixWorld.clone().invert();
    const byMat = new Map();
    const drop = [];
    group.traverse((o) => {
      if (!o.isMesh || o.isInstancedMesh || o.userData.row || Array.isArray(o.material) || o.material.transparent) return;
      const geo = o.geometry.clone();
      geo.applyMatrix4(inv.clone().multiply(o.matrixWorld));
      for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
      if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
      if (!byMat.has(o.material)) byMat.set(o.material, []);
      byMat.get(o.material).push(geo.index ? geo.toNonIndexed() : geo);
      drop.push(o);
    });
    for (const o of drop) o.parent.remove(o);
    for (const [mat, geos] of byMat) group.add(new THREE.Mesh(mergeGeometries(geos), mat));
  }

  // ── the reader ──
  const reader = createReader({ sfx });
  group.add(reader.group);

  // pointing at a book: the book itself, or anywhere along its shelf (the nearest copy)
  const rowBoxes = [];
  group.traverse((o) => o.userData.row && rowBoxes.push(o));
  const local = new THREE.Vector3();
  function bookAt(raycaster) {
    raycaster.far = 16;
    const hit = raycaster.intersectObjects(meshes, false)[0];
    const rowHit = raycaster.intersectObjects(rowBoxes, false)[0];
    raycaster.far = 22;
    if (hit && (!rowHit || hit.distance <= rowHit.distance + 0.05)) {
      const b = books.find((r) => r.mesh === hit.object && r.id === hit.instanceId);
      if (b) return b;
    }
    if (!rowHit) return null;
    const row = rowHit.object.userData.row;
    row.g.worldToLocal(local.copy(rowHit.point));
    let best = null;
    for (const b of row.recs) if (!best || Math.abs(b.x - local.x) < Math.abs(best.x - local.x)) best = b;
    return best;
  }

  // hover: the book lights up a little and slides out
  let hovered = null;
  let hoverAmt = 0;
  const lit = new THREE.Color();
  const WHITE = new THREE.Color('#ffffff');
  const slide = (b, amount) => {
    const m = b.matrix.clone();
    m.elements[12] += b.slide.x * amount;
    m.elements[13] += b.slide.y * amount;
    m.elements[14] += b.slide.z * amount;
    b.mesh.setMatrixAt(b.id, m);
    b.mesh.instanceMatrix.needsUpdate = true;
    if (!b.plain) {
      b.mesh.setColorAt(b.id, lit.copy(b.color).lerp(WHITE, 0.18 * (amount / 0.07)));
      b.mesh.instanceColor.needsUpdate = true;
    }
  };
  const hide = (b, on) => {
    b.mesh.setMatrixAt(b.id, on ? new THREE.Matrix4().makeScale(0, 0, 0) : b.matrix);
    b.mesh.instanceMatrix.needsUpdate = true;
  };
  // the world transform of a shelf book (for flying it out and back), and which way is "out"
  const bookWorld = (b) => {
    b.mesh.updateWorldMatrix(true, false);
    const p = new THREE.Vector3();
    const qq = new THREE.Quaternion();
    const s = new THREE.Vector3();
    b.matrix.decompose(p, qq, s);
    const world = new THREE.Matrix4().compose(p, qq, new THREE.Vector3(1, 1, 1)).premultiply(b.mesh.matrixWorld);
    // (a face-out copy already shows its cover: the reader shouldn't turn it)
    if (b.faceOut) world.multiply(new THREE.Matrix4().makeRotationY(-Math.PI / 2));
    const out = b.slide.clone().transformDirection(b.mesh.matrixWorld);
    return { world, out };
  };

  // the little label that follows the pointer over a book: its title and author
  const tipEl = document.createElement('div');
  tipEl.className = 'book-tip';
  tipEl.innerHTML = '<b></b><span></span>';
  document.body.appendChild(tipEl);
  let tipFor = null;

  const bounds = { z0: zStart, z1: zEnd };
  return {
    group,
    books,
    reader,
    tip(b, x = 0, y = 0) {
      if (b !== tipFor) {
        tipFor = b;
        if (b) {
          tipEl.querySelector('b').textContent = b.content.title;
          tipEl.querySelector('span').textContent = b.content.author || '';
        }
        tipEl.classList.toggle('is-visible', !!b);
      }
      if (b) tipEl.style.transform = `translate(${Math.round(x + 18)}px, ${Math.round(y + 14)}px)`;
    },
    contains: (p) => p.z < bounds.z0 + 0.5 && p.z > bounds.z1 - 0.5 && Math.abs(p.x) < W / 2,
    hover(raycaster) {
      const b = reader.busy ? null : bookAt(raycaster);
      if (b !== hovered) {
        if (hovered && !hovered.out) slide(hovered, 0);
        hovered = b;
        hoverAmt = 0;
      }
      return b;
    },
    open(raycaster, camera) {
      if (reader.busy) return false;
      const b = bookAt(raycaster);
      if (!b) return false;
      slide(b, 0);
      hovered = null;
      b.out = true;
      const { world, out } = bookWorld(b);
      reader.take(b, world, out, camera, () => hide(b, true), () => {
        hide(b, false);
        b.out = false;
      });
      return true;
    },
    update(dt, t, camera) {
      if (hovered && !hovered.out) {
        hoverAmt += (1 - hoverAmt) * (1 - Math.exp(-dt * 12));
        slide(hovered, 0.06 * hoverAmt);
      }
      reader.update(dt, camera);
    },
  };
}

// ── the book in your hands ───────────────────────────────────────────────────
function createReader({ sfx }) {
  const group = new THREE.Group();
  group.visible = false;
  const root = new THREE.Group(); // the book's pose in the world
  group.add(root);
  const shift = new THREE.Group(); // slides the book so the open spread is centred
  root.add(shift);
  shift.position.z = 0.015; // (and centres its thickness on the book it replaces on the shelf)

  // The four pages that can be in view: the two you're looking at, and the two
  // sides of a turning page. Each has its ink (drawn sharp, once) and its order
  // map; `progress` says how many characters have been written so far.
  const pages = {};
  const paperTex = { left: TX.toTexture(paperBase('left')), right: TX.toTexture(paperBase('right')) };
  for (const t of Object.values(paperTex)) t.anisotropy = 8;
  for (const key of ['left', 'right', 'flipFront', 'flipBack']) {
    const [ic, ink] = TX.makeCanvas(Math.round(PAGE_W * INK_SCALE), Math.round(PAGE_H * INK_SCALE));
    const [oc, order] = TX.makeCanvas(Math.round(PAGE_W * ORDER_SCALE), Math.round(PAGE_H * ORDER_SCALE));
    const inkTex = TX.toTexture(ic);
    inkTex.anisotropy = 16;
    const orderTex = new THREE.CanvasTexture(oc);
    orderTex.colorSpace = THREE.NoColorSpace;
    orderTex.magFilter = orderTex.minFilter = THREE.NearestFilter;
    orderTex.generateMipmaps = false;
    pages[key] = { ic, ink, oc, order, inkTex, orderTex, progress: { value: 0 }, page: null, runs: [], times: [], total: 0 };
  }
  // a page: paper, with its ink revealed character by character (the newest still wet)
  function pageMat(key, side, { flip = false, face = THREE.FrontSide } = {}) {
    const P = pages[key];
    const mat = new THREE.MeshStandardMaterial({ map: paperTex[side], roughness: 0.85, side: face });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, { uInk: { value: P.inkTex }, uOrder: { value: P.orderTex }, uProgress: P.progress, uFade: { value: 3.5 }, uFlip: { value: flip ? 1 : 0 } });
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uInk; uniform sampler2D uOrder; uniform float uProgress; uniform float uFade; uniform float uFlip;')
        .replace(
          '#include <map_fragment>',
          /* glsl */ `
          vec2 puv = uFlip > 0.5 ? vec2(1.0 - vMapUv.x, vMapUv.y) : vMapUv; // (the back of a turning page reads the right way round)
          diffuseColor *= texture2D(map, puv);
          vec4 ink = texture2D(uInk, puv);
          vec2 oc = texture2D(uOrder, puv).rg;
          float ord = floor(oc.r * 255.0 + 0.5) * 256.0 + floor(oc.g * 255.0 + 0.5);
          float shown = ord < 0.5 ? 1.0 : clamp((uProgress - ord + 1.0) / uFade, 0.0, 1.0); // (the newest letters still fading in)
          diffuseColor.rgb = mix(diffuseColor.rgb, ink.rgb, ink.a * shown);`,
        );
    };
    mat.customProgramCacheKey = () => 'book-page';
    return mat;
  }

  const coverMat = new THREE.MeshStandardMaterial({ color: '#5b1f22', roughness: 0.55 });
  const coverFrontMat = new THREE.MeshStandardMaterial({ roughness: 0.5 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#eee3cc', roughness: 0.9 });
  const endMat = new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.8 });
  const mats = {
    right: pageMat('right', 'right'),
    left: pageMat('left', 'left'),
    flipFront: pageMat('flipFront', 'right'),
    flipBack: pageMat('flipBack', 'left', { flip: true, face: THREE.BackSide }),
  };
  // (hidden stand-ins wearing every material of the book, so the loading screen's
  // warm-up builds their shaders and taking the first book down doesn't stall)
  coverFrontMat.map = paperTex.right;
  const warmGeo = new THREE.PlaneGeometry(0.01, 0.01);
  for (const m of [...Object.values(mats), coverMat, coverFrontMat, edgeMat, endMat]) {
    const w = new THREE.Mesh(warmGeo, m);
    w.visible = false;
    w.frustumCulled = false;
    group.add(w);
  }

  let book = null; // { size, content, pages }
  let W = 0.2;
  let Hh = 0.3;
  let T = 0.04;
  const parts = {};
  function build(size, color, content) {
    for (const k of Object.keys(parts)) {
      shift.remove(parts[k]);
      parts[k].geometry?.dispose();
    }
    // the same book as on the shelf (within reason, so it's always comfortable to read)
    W = Math.max(0.17, Math.min(0.24, size.z));
    Hh = Math.max(0.24, Math.min(0.34, size.y));
    T = Math.max(0.03, Math.min(0.06, size.x));
    coverMat.color.set(color);
    if (coverFrontMat.map !== paperTex.right) coverFrontMat.map?.dispose(); // (not the warm-up stand-in)
    coverFrontMat.map = coverTexture(content, color);
    coverFrontMat.needsUpdate = true;
    const board = 0.004;
    // back cover and the block of pages
    parts.back = new THREE.Mesh(new THREE.BoxGeometry(W + 0.004, Hh + 0.008, board), coverMat);
    parts.back.position.set(W / 2, 0, -T + board / 2);
    // (its top sits level with the page you read, which dips into the gutter)
    parts.block = new THREE.Mesh(new THREE.BoxGeometry(W - 0.004, Hh - 0.004, T - board), edgeMat);
    parts.block.position.set(W / 2 - 0.002, 0, -T / 2 + board / 2 + 0.001);
    // the spine, rounded
    parts.spine = new THREE.Mesh(new THREE.CylinderGeometry(T / 2 + board, T / 2 + board, Hh + 0.012, 16, 1, true, Math.PI, Math.PI), coverMat);
    parts.spine.material.side = THREE.DoubleSide;
    parts.spine.position.set(0, 0, -T / 2);
    // the front cover, hinged at the spine: leather outside, marbled paper inside
    parts.hinge = new THREE.Group();
    const cover = new THREE.Mesh(new THREE.BoxGeometry(W + 0.004, Hh + 0.008, board), [coverMat, coverMat, coverMat, coverMat, coverFrontMat, endMat]);
    cover.position.set(W / 2 + 0.002, 0, board / 2 + 0.0035);
    parts.hinge.add(cover);
    // the pages you read: gently curved into the gutter (the left one lies on the open cover)
    parts.right = new THREE.Mesh(pageGeometry(1), mats.right);
    parts.left = new THREE.Mesh(pageGeometry(-1), mats.left);
    parts.left.position.z = 0.0006;
    parts.left.visible = false;
    // a turning page
    parts.flip = new THREE.Group();
    parts.flipGeo = new THREE.PlaneGeometry(W - 0.004, Hh - 0.006, 28, 1);
    parts.flipF = new THREE.Mesh(parts.flipGeo, mats.flipFront);
    parts.flipB = new THREE.Mesh(parts.flipGeo, mats.flipBack);
    parts.flip.add(parts.flipF, parts.flipB);
    parts.flip.visible = false;
    for (const k of ['back', 'block', 'spine', 'hinge', 'right', 'left', 'flip']) shift.add(parts[k]);
    shift.position.z = T / 2 - 0.004;
    delete parts.flipGeo;
  }
  function pageGeometry(side) {
    const w = W - 0.004;
    const g = new THREE.PlaneGeometry(w, Hh - 0.006, 24, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + w / 2; // 0 at the spine → w at the edge
      p.setXYZ(i, side * (x + 0.0005), p.getY(i), 0.0065 * (1 - Math.exp(-x / 0.02)) - 0.0035);
    }
    if (side < 0) {
      // mirror the triangles back to facing the camera
      const idx = g.index.array;
      for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    }
    g.computeVertexNormals();
    return g;
  }
  // bend the turning page: k = 0 lying on the right, 1 lying on the left
  function bendFlip(k) {
    const g = parts.flipF.geometry;
    const p = g.attributes.position;
    const w = W - 0.004;
    const cols = 29;
    const lift = Math.sin(Math.PI * k);
    for (let row = 0; row < 2; row++) {
      let x = 0.002;
      let z = 0.0045;
      let prev = null;
      for (let i = 0; i < cols; i++) {
        const s = i / (cols - 1);
        const a = Math.PI * k - lift * 0.55 * Math.pow(s, 1.4) + (k > 0.5 ? lift * 0.25 * s : 0);
        if (prev !== null) {
          const ds = w / (cols - 1);
          x += Math.cos(a) * ds;
          z += Math.sin(a) * ds;
        }
        prev = a;
        const idx = row * cols + i;
        p.setXYZ(idx, x, p.getY(idx), z + 0.0012 * lift);
      }
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
  }

  // ── writing on the pages ──
  // put a page's writing in place: drawn once, sharp, then revealed as it's "written"
  const DONE = 1e6; // (a progress past every character: the page is fully written)
  function setPage(key, content, page, side, shown = 0) {
    const P = pages[key];
    P.page = page;
    P.content = content;
    P.side = side;
    P.runs = page ? pageRuns(content, page, side) : [];
    P.times = charTimes(P.runs);
    P.total = P.times.length;
    P.elapsed = 0;
    P.progress.value = shown === 'all' ? DONE : 0;
    if (page) drawPage(P.ink, P.order, content, page, P.runs, side);
    else {
      P.ink.setTransform(1, 0, 0, 1, 0, 0);
      P.ink.clearRect(0, 0, P.ic.width, P.ic.height);
      P.order.fillStyle = '#000';
      P.order.fillRect(0, 0, P.oc.width, P.oc.height);
    }
    P.inkTex.needsUpdate = true;
    P.orderTex.needsUpdate = true;
  }
  // write the pages in turn, one character after another, smoothly
  const queue = [];
  function typeStep(dt) {
    const key = queue[0];
    if (!key) return false;
    const P = pages[key];
    P.elapsed += dt;
    let n = 0;
    while (n < P.total && P.times[n] <= P.elapsed) n++;
    if (n >= P.total) {
      P.progress.value = DONE;
      queue.shift();
      return true;
    }
    const prevT = n ? P.times[n - 1] : 0;
    P.progress.value = n + Math.min(1, (P.elapsed - prevT) / Math.max(1e-3, P.times[n] - prevT));
    return true;
  }
  function finishTyping() {
    for (const key of queue) pages[key].progress.value = DONE;
    queue.length = 0;
  }

  // ── motion ──
  const state = { phase: 'idle', t: 0, spread: 0, open: 0, flipK: 0, flipDir: 0 };
  let current = null; // the shelf book
  let fromM = new THREE.Matrix4();
  const holdPos = new THREE.Vector3();
  const holdQ = new THREE.Quaternion();
  const fromPos = new THREE.Vector3();
  const fromQ = new THREE.Quaternion();
  const tmpS = new THREE.Vector3();
  const turnQ = new THREE.Quaternion();
  const outDir = new THREE.Vector3(0, 0, 1); // which way the book comes off its shelf
  let onTaken = null;
  let onReturned = null;
  let camRef = null;

  // where the book is held: in front of your eyes, tilted back a little like in your hands
  function holdPose(camera) {
    const fovY = THREE.MathUtils.degToRad(camera.fov);
    const aspect = camera.aspect;
    const openW = W * 2 + 0.03;
    const dist = Math.max(Hh / (2 * Math.tan(fovY / 2) * 0.74), openW / (2 * Math.tan(fovY / 2) * aspect * 0.84));
    camera.updateMatrixWorld();
    holdPos.set(0, -0.012, -dist).applyMatrix4(camera.matrixWorld);
    holdQ.copy(camera.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0, 0)));
  }

  function spreadCount() {
    return Math.ceil(book.pages.length / 2);
  }
  function showSpread(s, typeIt) {
    const L = book.pages[s * 2];
    const R = book.pages[s * 2 + 1];
    setPage('left', book.content, L, 'left', typeIt ? 0 : 'all');
    setPage('right', book.content, R, 'right', typeIt ? 0 : 'all');
    queue.length = 0;
    if (typeIt) queue.push('left', 'right');
    ui.page(s, spreadCount());
  }

  // the on-screen controls
  const ui = readerUI({
    next: () => api.next(),
    prev: () => api.prev(),
    close: () => api.close(),
  });

  const api = {
    group,
    // (for testing)
    get debug() {
      const s = (k) => ({ shown: +Math.min(pages[k].progress.value, pages[k].total).toFixed(1), total: pages[k].total, elapsed: +(pages[k].elapsed || 0).toFixed(2), kind: pages[k].page?.kind });
      return { phase: state.phase, spread: state.spread, queue: [...queue], left: s('left'), right: s('right') };
    },
    get busy() {
      return state.phase !== 'idle';
    },
    get reading() {
      return state.phase === 'read' || state.phase === 'flip';
    },
    // in your hands (and still: the moments to change resolution without a visible hitch)
    get held() {
      return state.phase === 'opening' || state.phase === 'read' || state.phase === 'flip' || state.phase === 'closing';
    },
    take(shelfBook, worldM, out, camera, taken, returned) {
      outDir.copy(out).normalize();
      current = shelfBook;
      onTaken = taken;
      onReturned = returned;
      camRef = camera;
      const content = shelfBook.content;
      book = { content, pages: paginate(content) };
      build(shelfBook.size, content.color || '#5b1f22', content);
      fromM = worldM.clone();
      fromM.decompose(fromPos, fromQ, tmpS);
      // a shelf book stands spine-out; in the reader the spine is its left edge
      // and the cover faces us, so turn it a quarter round its height
      turnQ.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
      fromQ.multiply(turnQ);
      // …and its middle is half a width in from the spine
      state.phase = 'out';
      state.t = 0;
      state.open = 0;
      state.spread = 0;
      showSpread(0, false);
      setPage('left', book.content, book.pages[0], 'left', 0);
      setPage('right', book.content, book.pages[1], 'right', 0);
      group.visible = true;
      parts.flip.visible = false;
      taken();
      sfx('bookSlide');
    },
    next() {
      if (state.phase !== 'read') return;
      if (queue.length) return finishTyping();
      if (state.spread >= spreadCount() - 1) return api.close();
      const s = state.spread + 1;
      // the page lifts from the right: its front is the old right page, its back the new left
      copyPage('right', 'flipFront');
      setPage('flipBack', book.content, book.pages[s * 2], 'left', 0);
      setPage('right', book.content, book.pages[s * 2 + 1], 'right', 0);
      state.phase = 'flip';
      state.flipDir = 1;
      state.flipK = 0;
      state.spread = s;
      parts.flip.visible = true;
      bendFlip(0);
      sfx('pageTurn');
    },
    prev() {
      if (state.phase !== 'read') return;
      if (queue.length) return finishTyping();
      if (state.spread <= 0) return;
      const s = state.spread - 1;
      copyPage('left', 'flipBack');
      setPage('flipFront', book.content, book.pages[s * 2 + 1], 'right', 'all');
      setPage('left', book.content, book.pages[s * 2], 'left', 'all');
      state.phase = 'flip';
      state.flipDir = -1;
      state.flipK = 1;
      state.spread = s;
      parts.flip.visible = true;
      bendFlip(1);
      sfx('pageTurn');
    },
    close() {
      if (state.phase !== 'read' && state.phase !== 'flip') return;
      finishTyping();
      parts.flip.visible = false;
      state.phase = 'closing';
      state.t = 0;
      ui.hide();
      sfx('bookClose');
    },
    // a click in the scene while reading: right page → on, left page → back, off the book → put it back
    click(raycaster) {
      if (!api.reading) return false;
      const hits = raycaster.intersectObjects([parts.right, parts.left, parts.block, parts.hinge, parts.back], true);
      if (!hits.length) {
        api.close();
        return true;
      }
      const local = shift.worldToLocal(hits[0].point.clone());
      if (local.x >= 0) api.next();
      else api.prev();
      return true;
    },
    update(dt, camera) {
      if (state.phase === 'idle') return;
      camRef = camera;
      state.t += dt;
      holdPose(camera);
      const p = state.phase;
      if (p === 'out') {
        // slide it off the shelf
        const k = easeInOut(Math.min(1, state.t / 0.5));
        root.position.copy(fromPos).addScaledVector(outDir, 0.26 * k);
        root.quaternion.copy(fromQ);
        shift.position.x = -W / 2;
        if (state.t >= 0.5) {
          state.phase = 'fly';
          state.t = 0;
          fromPos.copy(root.position);
        }
      } else if (p === 'fly') {
        // into your hands, turning to show its cover
        const k = easeInOut(Math.min(1, state.t / 1.05));
        const arc = Math.sin(Math.PI * k) * 0.12;
        root.position.lerpVectors(fromPos, holdPos, k);
        root.position.y += arc;
        root.quaternion.slerpQuaternions(fromQ, holdQ, k);
        shift.position.x = -W / 2;
        if (state.t >= 1.05) {
          state.phase = 'opening';
          state.t = 0;
          sfx('bookOpen');
        }
      } else if (p === 'opening' || p === 'closing') {
        root.position.copy(holdPos);
        root.quaternion.copy(holdQ);
        const k = easeInOut(Math.min(1, state.t / 0.95));
        state.open = p === 'opening' ? k : 1 - k;
        if (state.t >= 0.95) {
          if (p === 'opening') {
            state.phase = 'read';
            showSpread(0, true);
            ui.show();
          } else {
            state.phase = 'fly-back';
            state.t = 0;
          }
        }
      } else if (p === 'read' || p === 'flip') {
        root.position.lerp(holdPos, 1 - Math.exp(-dt * 10));
        root.quaternion.slerp(holdQ, 1 - Math.exp(-dt * 10));
        state.open = 1;
        if (p === 'flip') {
          state.flipK += state.flipDir * dt / 0.75;
          const k = Math.max(0, Math.min(1, state.flipK));
          bendFlip(easeInOut(k));
          if ((state.flipDir > 0 && k >= 1) || (state.flipDir < 0 && k <= 0)) {
            parts.flip.visible = false;
            if (state.flipDir > 0) {
              copyPage('flipBack', 'left');
              queue.length = 0;
              queue.push('left', 'right');
            } else {
              copyPage('flipFront', 'right');
            }
            ui.page(state.spread, spreadCount());
            state.phase = 'read';
          }
        } else typeStep(dt);
      } else if (p === 'fly-back') {
        const k = easeInOut(Math.min(1, state.t / 1.0));
        const arc = Math.sin(Math.PI * k) * 0.12;
        root.position.lerpVectors(holdPos, fromPos, k);
        root.position.y += arc;
        root.quaternion.slerpQuaternions(holdQ, fromQ, k);
        shift.position.x = -W / 2;
        if (state.t >= 1.0) {
          state.phase = 'in';
          state.t = 0;
        }
      } else if (p === 'in') {
        const k = easeInOut(Math.min(1, state.t / 0.45));
        root.position.copy(fromPos).addScaledVector(outDir, -0.26 * k);
        if (state.t >= 0.45) {
          group.visible = false;
          state.phase = 'idle';
          onReturned?.();
          sfx('bookSlide');
        }
      }
      // the cover swings open round the spine, and the book slides to centre the spread
      const o = state.open;
      parts.hinge.rotation.y = -Math.PI * easeInOut(o);
      if (p !== 'out' && p !== 'fly' && p !== 'fly-back' && p !== 'in') shift.position.x = -W / 2 + (W / 2) * easeInOut(o);
      parts.left.visible = o > 0.55;
      // open, the leather of the spine is hidden behind the pages curving into the gutter
      parts.spine.visible = o < 0.7;
    },
  };
  function copyPage(from, to) {
    const A = pages[from];
    const B = pages[to];
    B.ink.setTransform(1, 0, 0, 1, 0, 0);
    B.ink.clearRect(0, 0, B.ic.width, B.ic.height);
    B.ink.drawImage(A.ic, 0, 0);
    B.order.drawImage(A.oc, 0, 0);
    B.inkTex.needsUpdate = true;
    B.orderTex.needsUpdate = true;
    B.progress.value = A.progress.value;
    for (const k of ['page', 'content', 'side', 'runs', 'times', 'total']) B[k] = A[k];
    B.elapsed = 0;
  }
  return api;
}

// ── the reading controls (HTML, over the scene) ─────────────────────────────
function readerUI({ next, prev, close }) {
  const el = document.createElement('div');
  el.className = 'reader';
  el.hidden = true;
  el.innerHTML = `
    <button class="reader-close" type="button"><span>Put it back</span><i aria-hidden="true">×</i></button>
    <div class="reader-bar">
      <button class="reader-prev" type="button" aria-label="Previous pages">‹</button>
      <span class="reader-page"></span>
      <button class="reader-next" type="button" aria-label="Next pages">›</button>
    </div>
    <p class="reader-hint">Click a page to turn it · Esc puts the book back</p>`;
  document.body.appendChild(el);
  const pageEl = el.querySelector('.reader-page');
  el.querySelector('.reader-close').addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });
  el.querySelector('.reader-next').addEventListener('click', (e) => {
    e.stopPropagation();
    next();
  });
  el.querySelector('.reader-prev').addEventListener('click', (e) => {
    e.stopPropagation();
    prev();
  });
  addEventListener('keydown', (e) => {
    if (el.hidden) return;
    if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'Escape') close();
  });
  let hinted = 0;
  return {
    show() {
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('is-open'));
      el.classList.toggle('show-hint', hinted++ < 2);
    },
    hide() {
      el.classList.remove('is-open');
      setTimeout(() => (el.hidden = true), 450);
    },
    page(s, n) {
      pageEl.textContent = `${s + 1} / ${n}`;
      el.querySelector('.reader-prev').disabled = s === 0;
    },
  };
}
