import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Tree } from './vendor/ez-tree/index.js';
import { getLeafTexture } from './vendor/ez-tree/textures.js';
import { makeCanvas, rng, toTexture } from './textures.js';

// Realistic-ish plants for the garden:
//  • flowers are real little 3D models built from shaped, shaded petals
//    (roses, tulips, daisies) and instanced by the thousand
//  • leaves & shrubs use photographic leaf textures (from ez-tree, MIT)
//  • grass is made of individual blades, and everything sways in the breeze
//  • trees are grown procedurally with ez-tree (real bark & leaf textures)

// ── textures ────────────────────────────────────────────────────────────────

// 4 cells: rose petal, tulip petal, daisy ray, leaf (+ a white patch for stems)
function petalAtlas() {
  const C = 256;
  const [c, ctx] = makeCanvas(C * 4, C);
  const r = rng(12);
  const cell = (i, draw) => {
    ctx.save();
    ctx.translate(i * C, 0);
    ctx.beginPath();
    draw();
    ctx.closePath();
    ctx.save();
    ctx.clip();
    // shading: deeper colour at the base, bright toward the edge
    const g = ctx.createLinearGradient(0, C, 0, 0);
    g.addColorStop(0, i === 3 ? '#2f5d23' : '#8a8a8a');
    g.addColorStop(0.45, i === 3 ? '#4f8a35' : '#e6e6e6');
    g.addColorStop(1, i === 3 ? '#6ea447' : '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C, C);
    // fine veins
    ctx.strokeStyle = i === 3 ? 'rgba(200,230,160,0.5)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = i === 3 ? 3 : 1.5;
    const veins = i === 3 ? 1 : 9;
    for (let k = 0; k < veins; k++) {
      const x = C / 2 + (k - (veins - 1) / 2) * 14;
      ctx.beginPath();
      ctx.moveTo(C / 2, C);
      ctx.quadraticCurveTo(x, C * 0.5, x + (x - C / 2) * 0.6, 0);
      ctx.stroke();
    }
    // soft darker rim for rose/tulip petals gives them body
    if (i < 2) {
      const e = ctx.createRadialGradient(C / 2, C * 0.35, C * 0.2, C / 2, C * 0.35, C * 0.6);
      e.addColorStop(0, 'rgba(255,255,255,0)');
      e.addColorStop(1, 'rgba(0,0,0,0.12)');
      ctx.fillStyle = e;
      ctx.fillRect(0, 0, C, C);
    }
    ctx.restore();
    ctx.restore();
  };
  // rose petal: broad, rounded, slightly wavy top
  cell(0, () => {
    ctx.moveTo(C / 2, C);
    ctx.bezierCurveTo(C * 0.02, C * 0.75, C * -0.02, C * 0.2, C * 0.2, C * 0.06);
    for (let k = 0; k <= 6; k++) ctx.lineTo(C * (0.2 + 0.1 * k), C * (0.04 + (k % 2) * 0.03 + r() * 0.02));
    ctx.bezierCurveTo(C * 1.02, C * 0.2, C * 0.98, C * 0.75, C / 2, C);
  });
  // tulip petal: long oval with a soft point
  cell(1, () => {
    ctx.moveTo(C / 2, C);
    ctx.bezierCurveTo(C * 0.05, C * 0.8, C * 0.05, C * 0.2, C / 2, C * 0.01);
    ctx.bezierCurveTo(C * 0.95, C * 0.2, C * 0.95, C * 0.8, C / 2, C);
  });
  // daisy ray: narrow strap with a notched tip
  cell(2, () => {
    ctx.moveTo(C * 0.44, C);
    ctx.lineTo(C * 0.3, C * 0.12);
    ctx.lineTo(C * 0.4, C * 0.02);
    ctx.lineTo(C * 0.5, C * 0.08);
    ctx.lineTo(C * 0.6, C * 0.02);
    ctx.lineTo(C * 0.7, C * 0.12);
    ctx.lineTo(C * 0.56, C);
  });
  // leaf: lanceolate with a midrib
  cell(3, () => {
    ctx.moveTo(C / 2, C);
    ctx.bezierCurveTo(C * 0.08, C * 0.7, C * 0.2, C * 0.2, C / 2, 0);
    ctx.bezierCurveTo(C * 0.8, C * 0.2, C * 0.92, C * 0.7, C / 2, C);
  });
  // plain white patch (bottom-left corner of the leaf cell) for stems & flower centres
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(C * 3 + 2, C - 34, 32, 32);
  const t = toTexture(c);
  t.anisotropy = 4;
  return t;
}
const WHITE_UV = [(3 * 256 + 18) / 1024, 16 / 256];

// a clump of lavender stems with purple bud spikes
function lavenderTexture() {
  const W = 256;
  const H = 512;
  const [c, ctx] = makeCanvas(W, H);
  const r = rng(77);
  for (let k = 0; k < 16; k++) {
    // grey-green leaves at the base
    ctx.strokeStyle = `rgba(${120 + r() * 30},${140 + r() * 30},${110 + r() * 20},1)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    const bx = W / 2 + (r() - 0.5) * 60;
    ctx.moveTo(bx, H);
    ctx.quadraticCurveTo(bx + (r() - 0.5) * 60, H * 0.85, bx + (r() - 0.5) * 140, H * (0.72 + r() * 0.1));
    ctx.stroke();
  }
  for (let k = 0; k < 30; k++) {
    const bx = W / 2 + (r() - 0.5) * 40;
    const tx = 16 + r() * (W - 32);
    const ty = 20 + r() * 150;
    const cx = (bx + tx) / 2 + (r() - 0.5) * 30;
    ctx.strokeStyle = '#7a8d62';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, H);
    ctx.quadraticCurveTo(cx, H * 0.55, tx, ty);
    ctx.stroke();
    // buds along the top 30% of the stem
    for (let b = 0; b < 16; b++) {
      const t = 0.7 + (b / 16) * 0.3;
      const x = (1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * tx;
      const y = (1 - t) * (1 - t) * H + 2 * (1 - t) * t * (H * 0.55) + t * t * ty;
      const l = 42 + r() * 22;
      ctx.fillStyle = `hsl(${255 + r() * 16}, ${18 + r() * 14}%, ${l}%)`;
      ctx.beginPath();
      ctx.ellipse(x + (r() - 0.5) * 6, y, 3 + r() * 2.5, 5 + r() * 3, (r() - 0.5) * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return toTexture(c);
}

// a branch of cherry blossom, used as the "leaves" of the cherry trees
function blossomTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const r = rng(5);
  const twigs = [];
  const twig = (x, y, a, len, w, depth) => {
    const x2 = x + Math.sin(a) * len;
    const y2 = y - Math.cos(a) * len;
    ctx.strokeStyle = '#4a3226';
    ctx.lineWidth = w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo((x + x2) / 2 + (r() - 0.5) * 20, (y + y2) / 2, x2, y2);
    ctx.stroke();
    twigs.push([x, y, x2, y2]);
    if (depth > 0) {
      for (let k = 0; k < 2; k++) twig(x2, y2, a + (k ? 0.5 : -0.5) + (r() - 0.5) * 0.4, len * 0.66, w * 0.62, depth - 1);
    }
  };
  twig(S / 2, S, 0, S * 0.36, 9, 3);
  const flower = (x, y, s) => {
    const rot = r() * Math.PI;
    for (let p = 0; p < 5; p++) {
      const a = rot + (p / 5) * Math.PI * 2;
      const px = x + Math.cos(a) * s * 0.55;
      const py = y + Math.sin(a) * s * 0.55;
      const g = ctx.createRadialGradient(x, y, 0, px, py, s * 0.7);
      g.addColorStop(0, '#e98aa6');
      g.addColorStop(0.5, '#f9c9d6');
      g.addColorStop(1, '#fff1f4');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px, py, s * 0.55, s * 0.42, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#c2476d';
    ctx.beginPath();
    ctx.arc(x, y, s * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f3d36b';
    for (let k = 0; k < 6; k++) {
      const a = r() * 6.28;
      ctx.fillRect(x + Math.cos(a) * s * 0.28, y + Math.sin(a) * s * 0.28, 2, 2);
    }
  };
  for (const [x1, y1, x2, y2] of twigs) {
    const n = 3 + ((r() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const t = 0.3 + r() * 0.7;
      flower(x1 + (x2 - x1) * t + (r() - 0.5) * 26, y1 + (y2 - y1) * t + (r() - 0.5) * 26, 14 + r() * 10);
    }
  }
  const t = toTexture(c);
  t.premultiplyAlpha = true;
  return t;
}

// dense clipped-hedge texture made from the photographic oak leaf sprite
function hedgeTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const leaf = getLeafTexture('oak').image;
  const r = rng(33);
  ctx.fillStyle = '#1f3519';
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 140; k++) {
    const x = r() * S;
    const y = r() * S;
    const s = 110 + r() * 110;
    const a = r() * Math.PI * 2;
    ctx.globalAlpha = 0.55 + r() * 0.45;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        if (x + ox < -s || x + ox > S + s || y + oy < -s || y + oy > S + s) continue;
        ctx.save();
        ctx.translate(x + ox, y + oy);
        ctx.rotate(a);
        ctx.drawImage(leaf, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
  }
  ctx.globalAlpha = 1;
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / 1.6, 1 / 1.6); // 1.6 m tile on metre-UV geometry
  return t;
}

// flower-bed ground: dark soil almost hidden under low leafy plants
function bedTexture() {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const r = rng(9);
  ctx.fillStyle = '#3d2c21';
  ctx.fillRect(0, 0, S, S);
  for (let k = 0; k < 3000; k++) {
    ctx.fillStyle = `hsl(${20 + r() * 20}, ${25 + r() * 20}%, ${10 + r() * 18}%)`;
    ctx.fillRect(r() * S, r() * S, 1 + r() * 4, 1 + r() * 3);
  }
  const leaves = [getLeafTexture('ash').image, getLeafTexture('oak').image];
  for (let k = 0; k < 260; k++) {
    const x = r() * S;
    const y = r() * S;
    const s = 70 + r() * 90;
    const a = r() * Math.PI * 2;
    const img = leaves[k % 2];
    ctx.globalAlpha = 0.7 + r() * 0.3;
    for (const ox of [-S, 0, S]) {
      for (const oy of [-S, 0, S]) {
        if (x + ox < -s || x + ox > S + s || y + oy < -s || y + oy > S + s) continue;
        ctx.save();
        ctx.translate(x + ox, y + oy);
        ctx.rotate(a);
        ctx.drawImage(img, -s / 2, -s / 2, s, s);
        ctx.restore();
      }
    }
  }
  ctx.globalAlpha = 1;
  const t = toTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(26, 26); // ~1.3 m tile across the ring's 34 m UV span
  return t;
}

// a hazy line of distant woodland painted all the way round the horizon
function treelineTexture() {
  const W = 2048;
  const H = 256;
  const [c, ctx] = makeCanvas(W, H);
  const r = rng(61);
  const crowns = [];
  for (let x = -40; x < W + 40; x += 14 + r() * 22) {
    const pink = r() < 0.08;
    const tall = r() < 0.15;
    crowns.push({ x, y: H * (tall ? 0.18 + r() * 0.15 : 0.3 + r() * 0.3), rad: 22 + r() * 40, pink });
  }
  // crowns built from the real leaf photos, on a dark understorey
  const leaves = [getLeafTexture('oak').image, getLeafTexture('ash').image];
  ctx.fillStyle = '#2f4229';
  ctx.fillRect(0, H * 0.64, W, H * 0.36);
  for (const t of crowns) {
    // a dark silhouette first so the crown reads as solid from afar
    ctx.fillStyle = '#35492d';
    for (const ox of [-W, 0, W]) {
      ctx.beginPath();
      ctx.ellipse(t.x + ox, t.y + t.rad * 0.5, t.rad * 0.85, t.rad * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(t.x + ox - t.rad * 0.6, t.y + t.rad * 0.5, t.rad * 1.2, H);
    }
    for (let k = 0; k < 7; k++) {
      const cx = t.x + (r() - 0.5) * t.rad * 1.2;
      const cy = t.y + r() * t.rad;
      const s = t.rad * (0.9 + r() * 0.7);
      ctx.globalAlpha = 0.75 + r() * 0.25;
      for (const ox of [-W, 0, W]) {
        ctx.save();
        ctx.translate(cx + ox, cy);
        ctx.rotate(r() * Math.PI * 2);
        ctx.drawImage(leaves[k % 2], -s / 2, -s / 2, s, s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    if (t.pink) {
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = 'rgba(245,190,205,0.55)';
      ctx.beginPath();
      ctx.arc(t.x, t.y + t.rad * 0.4, t.rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  const t = toTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(4, 1);
  return t;
}

// ── wind ────────────────────────────────────────────────────────────────────

// Bends vertices by their height above the plant's base, varying across the garden.
export function windy(material, time, strength) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = time;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wp = instanceMatrix[3].xyz;
      #else
        vec3 wp = vec3(0.0);
      #endif
      float hh = max(position.y, 0.0);
      float gust = sin(uTime * 1.3 + wp.x * 0.21 + wp.z * 0.17) * 0.65 + sin(uTime * 2.9 + wp.z * 0.8 + wp.x * 0.5) * 0.35;
      transformed.x += gust * ${strength.toFixed(4)} * hh * hh;
      transformed.z += gust * ${(strength * 0.55).toFixed(4)} * hh * hh;`,
    );
  };
  material.customProgramCacheKey = () => `windy-${strength}`;
  return material;
}

// ── geometry ────────────────────────────────────────────────────────────────

// One petal: a gently cupped and curled strip, placed around the flower's axis.
function petal({ w, l, cup = 0.3, curl = 0, cell, tilt, phi, r0 = 0, y0 = 0, segU = 2, segV = 2 }) {
  const g = new THREE.PlaneGeometry(1, 1, segU, segV);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const s = pos.getX(i);
    const t = pos.getY(i) + 0.5;
    pos.setXYZ(i, s * w, t * l, -cup * (2 * s) ** 2 * w * 0.5 + curl * t * t * l);
    uv.setXY(i, (cell + 0.03 + (s + 0.5) * 0.94) / 4, t * 0.98 + 0.01);
  }
  const m = new THREE.Matrix4()
    .makeRotationY(phi)
    .multiply(new THREE.Matrix4().makeTranslation(0, y0, r0))
    .multiply(new THREE.Matrix4().makeRotationX(tilt));
  g.applyMatrix4(m);
  return g;
}

function colored(g, hex) {
  const n = g.attributes.position.count;
  const c = new THREE.Color(hex);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

function solidUV(g) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, WHITE_UV[0], WHITE_UV[1]);
  return g;
}

function stem(h, r = 0.004) {
  const g = new THREE.CylinderGeometry(r * 0.8, r, h, 4, 1, true).toNonIndexed();
  g.translate(0, h / 2, 0);
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return solidUV(g);
}

const clean = (g) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'uv', 'color'].includes(k)) n.deleteAttribute(k);
  n.computeVertexNormals();
  return n;
};
const merge = (list) => mergeGeometries(list.map(clean));

function roseHead() {
  const list = [];
  const rings = [
    { n: 3, tilt: 0.12, r0: 0.003, w: 0.036, l: 0.036, cup: 0.8, curl: 0 },
    { n: 4, tilt: 0.42, r0: 0.007, w: 0.045, l: 0.042, cup: 0.6, curl: 0.03 },
    { n: 5, tilt: 0.85, r0: 0.011, w: 0.054, l: 0.045, cup: 0.4, curl: 0.12, segV: 1 },
    { n: 6, tilt: 1.2, r0: 0.014, w: 0.056, l: 0.044, cup: 0.28, curl: 0.22, segV: 1 },
  ];
  let phi = 0;
  for (const ring of rings) {
    for (let k = 0; k < ring.n; k++) {
      phi += 2.39996; // golden angle: petals spiral like a real rose
      list.push(petal({ ...ring, cell: 0, phi }));
    }
  }
  return merge(list.map((g) => colored(g, '#ffffff')));
}

function tulipHead(stemH) {
  const list = [];
  for (let k = 0; k < 6; k++) {
    const inner = k % 2 === 0;
    list.push(
      petal({ w: 0.04, l: 0.07, cup: 0.85, curl: -0.02, cell: 1, tilt: inner ? 0.1 : 0.2, phi: (k * Math.PI) / 3, r0: inner ? 0.004 : 0.008, y0: stemH }),
    );
  }
  return merge(list.map((g) => colored(g, '#ffffff')));
}

function tulipGreens(stemH) {
  const leafA = petal({ w: 0.055, l: 0.26, cup: 0.7, curl: 0.12, cell: 3, tilt: 0.35, phi: 0.3 });
  const leafB = petal({ w: 0.05, l: 0.22, cup: 0.7, curl: 0.14, cell: 3, tilt: 0.45, phi: 3.3 });
  return merge([colored(stem(stemH), '#4f7d34'), colored(leafA, '#ffffff'), colored(leafB, '#ffffff')]);
}

function daisyHead(stemH) {
  const list = [];
  for (let k = 0; k < 14; k++) {
    list.push(petal({ w: 0.013, l: 0.042, cup: 0.25, curl: 0.05, cell: 2, tilt: 1.35, phi: k * 0.4488, r0: 0.009, y0: stemH, segU: 1 }));
  }
  return merge(list.map((g) => colored(g, '#ffffff')));
}

function daisyGreens(stemH) {
  const disc = solidUV(new THREE.ConeGeometry(0.013, 0.009, 8));
  disc.translate(0, stemH + 0.004, 0);
  const leafA = petal({ w: 0.03, l: 0.11, cup: 0.5, curl: 0.1, cell: 3, tilt: 0.9, phi: 1.2 });
  const leafB = petal({ w: 0.03, l: 0.1, cup: 0.5, curl: 0.1, cell: 3, tilt: 1.0, phi: 4.1 });
  return merge([colored(stem(stemH, 0.0025), '#557a3a'), colored(disc, '#e9b92c'), colored(leafA, '#ffffff'), colored(leafB, '#ffffff')]);
}

// three crossed cards: the classic way to draw a leafy shrub or a clump of stems
function crossedCards(w, h, n = 3) {
  const list = [];
  for (let k = 0; k < n; k++) {
    const g = new THREE.PlaneGeometry(w, h);
    g.translate(0, h / 2, 0);
    g.rotateY((k * Math.PI) / n);
    list.push(g);
  }
  return merge(list);
}

function grassClump() {
  const r = rng(4);
  const list = [];
  const base = new THREE.Color('#2e5320');
  const tip = new THREE.Color('#9bbd5c');
  for (let b = 0; b < 6; b++) {
    const h = 0.14 + r() * 0.16;
    const w = 0.012 + r() * 0.006;
    const segs = 3;
    const pos = [];
    const col = [];
    const lean = (r() - 0.5) * 0.12;
    const a = r() * Math.PI * 2;
    const ox = (r() - 0.5) * 0.12;
    const oz = (r() - 0.5) * 0.12;
    const pt = (t, side) => {
      const x = side * w * 0.5 * (1 - t);
      const y = t * h;
      const z = lean * t * t * h * 4;
      return [ox + x * Math.cos(a) + z * Math.sin(a), y, oz - x * Math.sin(a) + z * Math.cos(a)];
    };
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const quad = [pt(t0, -1), pt(t0, 1), pt(t1, 1), pt(t0, -1), pt(t1, 1), pt(t1, -1)];
      const ts = [t0, t0, t1, t0, t1, t1];
      quad.forEach((p, i) => {
        pos.push(...p);
        const c = base.clone().lerp(tip, ts[i]);
        col.push(c.r, c.g, c.b);
      });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array((pos.length / 3) * 2).fill(0), 2));
    list.push(g);
  }
  return merge(list);
}

// ── instancing, split into chunks so off-screen parts are culled ──────────────

export function planter(parent, center) {
  const kinds = new Map();
  return {
    add(kind, geo, mat, matrix, color) {
      if (!kinds.has(kind)) kinds.set(kind, { geo, mat, buckets: new Map() });
      const k = kinds.get(kind);
      const dx = matrix.elements[12] - center.x;
      const dz = matrix.elements[14] - center.z;
      const d = Math.hypot(dx, dz);
      const key = d < 6 ? 'c' : `${Math.floor(((Math.atan2(dx, dz) + Math.PI) / (Math.PI * 2)) * 10) % 10}-${d < 20 ? 0 : 1}`;
      if (!k.buckets.has(key)) k.buckets.set(key, []);
      k.buckets.get(key).push([matrix.clone(), color ? color.clone() : null]);
    },
    build() {
      for (const { geo, mat, buckets } of kinds.values()) {
        for (const items of buckets.values()) {
          const mesh = new THREE.InstancedMesh(geo, mat, items.length);
          items.forEach(([m, c], i) => {
            mesh.setMatrixAt(i, m);
            if (c) mesh.setColorAt(i, c);
          });
          mesh.computeBoundingSphere();
          parent.add(mesh);
        }
      }
    },
  };
}

// ── the kit ───────────────────────────────────────────────────────────────────

export function createNature(time) {
  const tex = {
    petals: petalAtlas(),
    lavender: lavenderTexture(),
    blossom: blossomTexture(),
    hedge: hedgeTexture(),
    bed: bedTexture(),
    treeline: treelineTexture(),
  };
  const ash = getLeafTexture('ash');

  const petalMat = (strength) =>
    windy(new THREE.MeshLambertMaterial({ map: tex.petals, vertexColors: true, alphaTest: 0.45, side: THREE.DoubleSide }), time, strength);

  const mats = {
    head: petalMat(0.9),
    greens: petalMat(0.9),
    rose: petalMat(0.15),
    shrub: windy(new THREE.MeshLambertMaterial({ map: ash, alphaTest: 0.5, side: THREE.DoubleSide }), time, 0.12),
    lavender: windy(new THREE.MeshLambertMaterial({ map: tex.lavender, alphaTest: 0.5, side: THREE.DoubleSide }), time, 0.35),
    grass: windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), time, 1.6),
    hedge: new THREE.MeshLambertMaterial({ map: tex.hedge }),
    soil: new THREE.MeshLambertMaterial({ map: tex.bed }),
    treeline: new THREE.MeshBasicMaterial({ map: tex.treeline, alphaTest: 0.5, side: THREE.BackSide, color: '#e6e1d0' }),
  };

  const geo = {
    rose: roseHead(),
    tulipHead: tulipHead(0.36),
    tulipGreens: tulipGreens(0.36),
    daisyHead: daisyHead(0.3),
    daisyGreens: daisyGreens(0.3),
    shrub: crossedCards(0.8, 0.7),
    smallShrub: crossedCards(0.5, 0.38),
    lavender: crossedCards(0.6, 0.72, 2),
    grass: grassClump(),
  };

  // ── trees ──
  const trees = [];
  // Fairy lights: tiny twinkling bulbs strung along a tree's real branches and
  // through its canopy (like trees dressed up for a wedding or a festival).
  // `opacity` is a shared uniform so a whole set can fade in at dusk.
  function fairyMaterial(opacity = { value: 1 }) {
    return new THREE.ShaderMaterial({
      uniforms: { uTime: time, uScale: fairyScale, uOpacity: opacity },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uScale;
        attribute float aSeed;
        varying float vTwinkle; varying float vSeed;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = max(2.0, (0.12 + aSeed * 0.07) * uScale / -mv.z);
          // Keep the lights steady. Thousands of independently pulsing points
          // read as full-scene flicker once the trees are viewed at a distance.
          vTwinkle = 0.76;
          vSeed = aSeed;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying float vTwinkle; varying float vSeed;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float core = smoothstep(0.5, 0.0, d);
          vec3 warm = mix(vec3(1.0, 0.72, 0.32), vec3(1.0, 0.9, 0.7), step(0.85, vSeed));
          gl_FragColor = vec4(warm * 2.2 * vTwinkle, core * core * uOpacity);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }
  const fairyScale = { value: 800 };
  function fairyGeometry(t, count) {
    const r = rng(t.options.seed + 5);
    const bv = t.branches.verts;
    const lv = t.leaves.verts;
    const pts = [];
    const seeds = [];
    const nb = bv.length / 3;
    const nl = lv.length / 12; // quads (4 vertices) per leaf card
    for (let k = 0; k < count; k++) {
      if (r() < 0.6 || !nl) {
        // wrapped round the trunk and branches
        const i = ((r() * nb) | 0) * 3;
        pts.push(bv[i], bv[i + 1], bv[i + 2]);
      } else {
        // scattered through the leaves
        const i = ((r() * nl) | 0) * 12;
        pts.push((lv[i] + lv[i + 6]) / 2, (lv[i + 1] + lv[i + 7]) / 2, (lv[i + 2] + lv[i + 8]) / 2);
      }
      seeds.push(r());
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
    g.computeBoundingSphere();
    return g;
  }

  const treeCache = new Map();
  function tree(preset, opts) {
    // the same tree asked for twice (e.g. by the front garden and the back) is grown once
    const key = JSON.stringify({ preset, ...opts, leafMap: opts.leafMap?.uuid, lightsOpacity: !!opts.lightsOpacity });
    if (!treeCache.has(key)) treeCache.set(key, growTree(preset, opts));
    return treeCache.get(key);
  }

  function growTree(preset, { seed, height, leafMap = null, leafTint, barkTint, leafSize, leafCount, lite = false, lights = 0, lightsOpacity, glow = null }) {
    const t = new Tree();
    t.loadPreset(preset);
    t.options.seed = seed;
    if (lite) {
      // background trees: fewer rings & sides on the branches (they're far away)
      const b = t.options.branch;
      for (const k of Object.keys(b.sections)) b.sections[k] = Math.max(k === '3' ? 1 : 2, Math.round(b.sections[k] * 0.6));
      for (const k of Object.keys(b.segments)) b.segments[k] = Math.max(3, Math.round(b.segments[k] * 0.7));
    }
    if (leafTint !== undefined) t.options.leaves.tint = leafTint;
    if (barkTint !== undefined) t.options.bark.tint = barkTint;
    if (leafSize) t.options.leaves.size *= leafSize;
    if (leafCount) t.options.leaves.count = Math.round(t.options.leaves.count * leafCount);
    t.generate();
    if (leafMap) {
      t.leavesMesh.material.map = leafMap;
      t.leavesMesh.material.needsUpdate = true;
    }
    if (glow) {
      // leaves catch a little warm light from the fairy lights
      // (branches glow most, the way wrapped trunks do; leaves only a little)
      t.leavesMesh.material.emissive = new THREE.Color(glow);
      t.leavesMesh.material.emissiveIntensity = 0.05;
      t.branchesMesh.material.emissive = new THREE.Color(glow);
      t.branchesMesh.material.emissiveIntensity = 0.35;
    }
    const box = new THREE.Box3().setFromObject(t);
    trees.push(t);
    const scale = height / box.max.y;
    const fairy = lights ? new THREE.Points(fairyGeometry(t, lights), fairyMaterial(lightsOpacity)) : null;
    // lightweight copies share geometry & materials
    return () => {
      const g = new THREE.Group();
      g.add(t.branchesMesh.clone(), t.leavesMesh.clone());
      if (fairy) g.add(fairy.clone());
      g.scale.setScalar(scale * (0.9 + Math.random() * 0.2));
      g.rotation.y = Math.random() * Math.PI * 2;
      return g;
    };
  }

  return {
    time,
    tex,
    mats,
    geo,
    tree,
    // fairy lights at any list of world positions (e.g. along the rose arches)
    fairy(positions, opacity) {
      const g = new THREE.BufferGeometry();
      const r = rng(positions.length);
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('aSeed', new THREE.Float32BufferAttribute(Array.from({ length: positions.length / 3 }, () => r()), 1));
      g.computeBoundingSphere();
      return new THREE.Points(g, fairyMaterial(opacity));
    },
    update(t, viewportHeight) {
      time.value = t;
      if (viewportHeight) fairyScale.value = viewportHeight;
      for (const tr of trees) tr.update(t);
    },
  };
}
