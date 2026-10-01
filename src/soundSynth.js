// The garden's sounds, rendered sample by sample (no audio files). This runs in
// a Web Worker, so the scroll stays smooth while it works; ambience.js plays the
// results. Everything is modelled on how the real thing makes its sound:
//
//  • water: thousands of tiny air bubbles, each ringing at its own pitch and
//    chirping upward as it rises (Minnaert resonance), over a turbulent rush
//  • wind: a deep, gusting "whoosh" plus leaves rustling in the gusts
//  • crickets: each one rubs its wings in short pulse trains (chirps) at its own
//    pitch, pace and distance; tree crickets trill in long phrases
//  • birds: songs built like the real species' songs (robin, great tit,
//    chaffinch, blackbird, blue tit, sparrow, wood pigeon) and a tawny owl
//  • a soft piano for the music in the rooms (pieces.js has the notes)
//
// Looping sounds are "wrapped": events near the end spill over into the start,
// and filters run twice round, so the loop has no seam.

import { PIANO } from './pieces.js';

export const SR = 32000;

const TAB = 8192;
const MASK = TAB - 1;
const SINE = new Float32Array(TAB);
for (let i = 0; i < TAB; i++) SINE[i] = Math.sin((i / TAB) * Math.PI * 2);

const rnd = (a, b) => a + Math.random() * (b - a);
const irnd = (a, b) => Math.floor(rnd(a, b + 1));
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const coef = (hz) => 1 - Math.exp((-2 * Math.PI * hz) / SR);
const smooth = (x) => x * x * (3 - 2 * x);

function whiteNoise(len) {
  const w = new Float32Array(len);
  for (let i = 0; i < len; i++) w[i] = Math.random() * 2 - 1;
  return w;
}

// a slow random curve (0–1) that wanders about `rate` times a second and loops
function wander(len, rate) {
  const n = Math.max(2, Math.round((len / SR) * rate));
  const pts = Float32Array.from({ length: n }, Math.random);
  const out = new Float32Array(len);
  const step = len / n;
  for (let i = 0; i < len; i++) {
    const x = i / step;
    const k = x | 0;
    const a = pts[k % n];
    out[i] = a + (pts[(k + 1) % n] - a) * smooth(x - k);
  }
  return out;
}

function normalize(chs, rms) {
  let sum = 0;
  let n = 0;
  for (const c of chs) for (let i = 0; i < c.length; i++, n++) sum += c[i] * c[i];
  const k = rms / Math.sqrt(sum / n || 1);
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= k;
  return chs;
}
function normalizePeak(c, peak) {
  let m = 0;
  for (let i = 0; i < c.length; i++) m = Math.max(m, Math.abs(c[i]));
  const k = peak / (m || 1);
  for (let i = 0; i < c.length; i++) c[i] *= k;
  return c;
}

// ─────────────────────────── water ───────────────────────────

// Falling water: a turbulent rush, a low "body" where the sheet plunges in,
// dense bubbles (the watery gurgle) and a fizz of tiny spray droplets.
function water(seconds, { bubbles, rush, body, lowF, highF, hp, spray }) {
  const len = Math.round(seconds * SR);
  const out = new Float32Array(len);
  const flutter = wander(len, 9); // fast turbulence
  const swell = wander(len, 0.6); // slow surges
  const white = whiteNoise(len);
  // the rush sits where splashing water does, around 1–4 kHz: two gentle
  // high-pass steps, one low-pass; the body is a soft low thud under it
  const aH = coef(hp);
  const aL = coef(highF * 1.2);
  const aB = coef(450);
  let h1 = 0;
  let h2 = 0;
  let l1 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < len; i++) {
      const x = white[i];
      h1 += aH * (x - h1);
      const y = x - h1;
      h2 += aH * (y - h2);
      l1 += aL * (y - h2 - l1);
      b1 += aB * (x - b1);
      b2 += aB * (b1 - b2);
      if (pass) {
        const surge = 0.5 + 0.35 * flutter[i] + 0.3 * swell[i];
        out[i] = (l1 * rush + b2 * body * 3) * surge;
      }
    }
  }
  // bubbles: each one rings at f = 3/radius and its pitch rises as it decays
  const count = Math.round(bubbles * seconds);
  for (let b = 0; b < count; b++) {
    const i0 = (Math.random() * len) | 0;
    if (Math.random() > 0.3 + 0.7 * flutter[i0]) continue; // they come in bursts
    const f0 = lowF * Math.pow(highF / lowF, Math.pow(Math.random(), 0.8));
    const d = (0.13 * f0 + 0.0072 * Math.pow(f0, 1.5)) * rnd(0.3, 0.65);
    const rise = rnd(0.08, 0.2) * d;
    let amp = 0.55 * Math.pow(1000 / f0, 0.6) * (0.2 + 0.8 * Math.random());
    if (Math.random() < 0.04) amp *= 2.2; // now and then a bigger "plip"
    const n = Math.min(Math.round((5 / d) * SR), (SR * 0.08) | 0);
    const k = Math.exp(-d / SR);
    let env = amp;
    let ph = 0;
    for (let s = 0; s < n; s++) {
      ph += (f0 * (1 + (rise * s) / SR)) / SR;
      if (ph >= 1) ph -= 1;
      out[(i0 + s) % len] += env * (s < 8 ? s / 8 : 1) * SINE[(ph * TAB) | 0];
      env *= k;
    }
  }
  // spray: tiny droplets landing, the faintest fizz
  const drops = Math.round(spray * seconds);
  for (let c = 0; c < drops; c++) {
    const i0 = (Math.random() * len) | 0;
    const n = irnd(6, 30);
    const amp = Math.pow(Math.random(), 2) * 0.15;
    let prev = 0;
    for (let s = 0; s < n; s++) {
      const w = Math.random() * 2 - 1;
      out[(i0 + s) % len] += (w - prev) * amp * (1 - s / n); // differenced: bright, no thump
      prev = w;
    }
  }
  return normalize([out], 0.2);
}

// ─────────────────────────── wind ───────────────────────────

// the gusting air itself: deep, soft noise that opens up and swells in gusts
function wind(seconds) {
  const len = Math.round(seconds * SR);
  const gust = wander(len, 0.2);
  const fine = wander(len, 1.1);
  const chs = [];
  for (let c = 0; c < 2; c++) {
    const ch = new Float32Array(len);
    const w = whiteNoise(len);
    const off = c ? (SR * 0.8) | 0 : 0; // the two ears hear the gust slightly apart
    let b = 0;
    let l = 0;
    let l2 = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < len; i++) {
        const j = (i + off) % len;
        const g0 = gust[j];
        const g = 0.1 + 0.9 * g0 * g0 * (0.75 + 0.25 * fine[j]);
        b = 0.996 * b + 0.07 * w[i];
        const a = (6.2832 * (80 + 620 * g)) / SR;
        l += a * (b + 0.3 * w[i] * g - l);
        l2 += 0.2 * (l - l2);
        if (pass) ch[i] = l2 * (0.2 + 0.8 * g);
      }
    }
    chs.push(ch);
  }
  return normalize(chs, 0.16);
}

// leaves in the trees stirring as a gust passes: soft, smooth swishes that
// swell and fade (no crackle, so it never sounds like rain)
function rustle(seconds) {
  const len = Math.round(seconds * SR);
  const act = wander(len, 0.18);
  const chs = [];
  for (let c = 0; c < 2; c++) {
    const raw = new Float32Array(len);
    const grains = Math.round(seconds * 160);
    for (let g = 0; g < grains; g++) {
      const i0 = (Math.random() * len) | 0;
      const a = act[i0];
      if (Math.random() > a * a * a) continue;
      const n = Math.round(rnd(0.04, 0.16) * SR);
      const amp = rnd(0.2, 0.5);
      for (let s = 0; s < n; s++) {
        const x = s / n;
        const env = Math.sin(Math.PI * Math.pow(x, 0.6)); // swells in, dies away
        raw[(i0 + s) % len] += amp * env * env * (Math.random() * 2 - 1);
      }
    }
    for (let i = 0; i < len; i++) raw[i] += (Math.random() * 2 - 1) * 0.12 * act[i] * act[i];
    // a soft band, ~1–4.5 kHz (filters run round twice, so the loop is seamless)
    const ch = new Float32Array(len);
    const aH = coef(1000);
    const aL = coef(4500);
    let h1 = 0;
    let h2 = 0;
    let lp = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < len; i++) {
        h1 += aH * (raw[i] - h1);
        const y = raw[i] - h1;
        h2 += aH * (y - h2);
        lp += aL * (y - h2 - lp);
        if (pass) ch[i] = lp;
      }
    }
    chs.push(ch);
  }
  return normalize(chs, 0.1);
}

// ─────────────────────────── insects ───────────────────────────

function crickets(seconds, fieldCount, treeCount) {
  const len = Math.round(seconds * SR);
  const L = new Float32Array(len);
  const R = new Float32Array(len);
  const put = (i, v, gl, gr) => {
    const j = i % len;
    L[j] += v * gl;
    R[j] += v * gr;
  };
  // field crickets: chirps of 3–5 wing strokes
  for (let c = 0; c < fieldCount; c++) {
    const f = rnd(4000, 5100);
    const dist = rnd(2.5, 24);
    const amp = Math.min(1, 3 / dist) * 0.5;
    const pan = rnd(-1, 1);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    const bright = Math.max(0.15, 1.1 - dist / 22); // distance dulls the buzz
    const h2 = 0.2 * bright;
    const h3 = 0.07 * bright;
    const pulses = irnd(3, 5);
    const pLen = rnd(0.011, 0.018);
    const pGap = rnd(0.012, 0.02);
    const period = rnd(0.38, 0.8);
    const gate = wander(len, rnd(0.04, 0.1)); // each one pauses now and then
    let t = Math.random() * period;
    while (t < seconds) {
      const i0 = Math.round(t * SR);
      const on = gate[i0 % len];
      if (on > 0.28) {
        const chirp = amp * (0.75 + 0.25 * Math.random()) * Math.min(1, (on - 0.28) * 6);
        for (let p = 0; p < pulses; p++) {
          const start = i0 + Math.round(p * (pLen + pGap) * SR);
          const n = Math.round(pLen * SR * rnd(0.9, 1.1));
          const pa = chirp * (p === 0 ? 0.65 : 1) * rnd(0.85, 1);
          let ph = Math.random();
          for (let s = 0; s < n; s++) {
            const x = s / n;
            const env = (x < 0.2 ? Math.sin((x / 0.2) * 1.5708) : Math.exp(-(x - 0.2) * 3)) * (x > 0.88 ? (1 - x) / 0.12 : 1);
            ph += (f * (1 - 0.04 * x)) / SR; // each stroke sags a little in pitch
            if (ph >= 1) ph -= 1;
            const q = (ph * TAB) | 0;
            const v = SINE[q] + h2 * SINE[(q * 2) & MASK] + h3 * SINE[(q * 3) & MASK] + 0.04 * (Math.random() * 2 - 1);
            put(start + s, v * env * pa, gl, gr);
          }
        }
      }
      t += period * (1 + 0.05 * gauss());
    }
  }
  // tree crickets: soft, musical trills that swell and fade in long phrases
  for (let c = 0; c < treeCount; c++) {
    const f = rnd(2600, 3200);
    const rate = rnd(38, 55);
    const dist = rnd(6, 18);
    const amp = (3 / dist) * 0.45;
    const pan = rnd(-1, 1);
    const gl = Math.cos(((pan + 1) * Math.PI) / 4);
    const gr = Math.sin(((pan + 1) * Math.PI) / 4);
    const phrase = wander(len, rnd(0.1, 0.18));
    const drift = wander(len, 0.3);
    let ph = 0;
    let tp = Math.random();
    for (let i = 0; i < len; i++) {
      const g = phrase[i];
      if (g < 0.35) continue;
      const lvl = smooth(Math.min(1, (g - 0.35) / 0.15));
      tp += rate / SR;
      if (tp >= 1) tp -= 1;
      if (tp > 0.55) continue;
      ph += (f * (0.99 + 0.02 * drift[i])) / SR;
      if (ph >= 1) ph -= 1;
      const q = (ph * TAB) | 0;
      const env = Math.sin((tp / 0.55) * Math.PI);
      put(i, (SINE[q] + 0.08 * SINE[(q * 2) & MASK]) * env * amp * lvl, gl, gr);
    }
  }
  return normalize([L, R], 0.07);
}

// ─────────────────────────── birds ───────────────────────────

// One sung note. freq(x) and env(x) take x = 0…1 through the note. A syrinx
// isn't a pure sine: a touch of harmonics and breath make it sound alive.
function tone(out, t0, dur, freq, env, { amp = 1, h2 = 0.06, h3 = 0.015, breath = 0.02, low = false } = {}) {
  const i0 = Math.round(t0 * SR);
  const n = Math.min(Math.round(dur * SR), out.length - i0);
  let ph = Math.random();
  let nl = 0;
  const aN = low ? coef(900) : coef(2500);
  for (let s = 0; s < n; s++) {
    const x = s / n;
    ph += freq(x) / SR;
    ph -= Math.floor(ph);
    const e = env(x) * amp;
    const q = (ph * TAB) | 0;
    const w = Math.random() * 2 - 1;
    nl += aN * (w - nl);
    const air = low ? nl * 2.5 : w - nl; // soft breath (low) or airy hiss (high)
    out[i0 + s] += e * (SINE[q] + h2 * SINE[(q * 2) & MASK] + h3 * SINE[(q * 3) & MASK] + breath * air);
  }
}
// a smooth swell: rises over the first `a` of the note, then dies away
const bell =
  (a = 0.2) =>
  (x) => {
    const y = x < a ? Math.sin((x / a) * 1.5708) : Math.cos(((x - a) / (1 - a)) * 1.5708);
    return y * y;
  };
const sweep = (f0, f1, curve = 1) => (x) => f0 + (f1 - f0) * Math.pow(x, curve);
const glide = (pts) => (x) => {
  let k = 1;
  while (k < pts.length - 1 && pts[k][0] < x) k++;
  const [x0, y0] = pts[k - 1];
  const [x1, y1] = pts[k];
  return y0 + (y1 - y0) * smooth(Math.min(1, Math.max(0, (x - x0) / (x1 - x0 || 1))));
};
const song = (seconds) => new Float32Array(Math.ceil(seconds * SR));

// European robin: a thin, liquid, rambling phrase of very varied notes
function robin() {
  const dur = rnd(1.5, 2.5);
  const out = song(dur + 0.5);
  const p = rnd(0.93, 1.07);
  let t = 0.02;
  while (t < dur) {
    const k = Math.random();
    let d;
    if (k < 0.3) {
      d = rnd(0.03, 0.06);
      const a = rnd(5500, 8000) * p;
      tone(out, t, d, sweep(a, a * rnd(0.45, 0.65), 0.7), bell(0.15), { amp: rnd(0.5, 1) });
    } else if (k < 0.5) {
      d = rnd(0.04, 0.08);
      const a = rnd(2500, 3800) * p;
      tone(out, t, d, sweep(a, a * rnd(1.5, 2.1), 1.4), bell(0.3), { amp: rnd(0.5, 0.9) });
    } else if (k < 0.7) {
      const reps = irnd(3, 8);
      const sd = rnd(0.012, 0.022);
      const a = rnd(4500, 6500) * p;
      const b = a * rnd(0.7, 1.3);
      const amp = rnd(0.5, 0.8);
      for (let r = 0; r < reps; r++) tone(out, t + r * sd * 1.4, sd, sweep(a, b), bell(0.3), { amp });
      d = reps * sd * 1.4;
    } else if (k < 0.88) {
      d = rnd(0.08, 0.2);
      const fc = rnd(3000, 7000) * p;
      const rate = rnd(25, 45) * d;
      const dep = rnd(0.02, 0.06);
      tone(out, t, d, (x) => fc * (1 + dep * Math.sin(6.2832 * rate * x)) * (1 - 0.08 * x), bell(0.2), { amp: rnd(0.4, 0.8) });
    } else {
      d = rnd(0.05, 0.1);
      const fc = rnd(3500, 5500) * p;
      const rate = rnd(30, 60) * d;
      tone(out, t, d, (x) => fc * (1 + 0.18 * Math.sin(6.2832 * rate * x)), bell(0.25), { amp: rnd(0.5, 0.8) });
    }
    t += d + rnd(0.015, 0.07);
  }
  return normalizePeak(out, 0.85);
}

// great tit: the ringing "tea-cher, tea-cher, tea-cher"
function greatTit() {
  const hi = rnd(5800, 7200);
  const lo = hi * rnd(0.6, 0.72);
  const reps = irnd(3, 6);
  const per = rnd(0.24, 0.32);
  const out = song(reps * per + 0.4);
  for (let r = 0; r < reps; r++) {
    const t = 0.02 + r * per * (1 + 0.02 * gauss());
    tone(out, t, 0.075, sweep(hi * 1.02, hi * 0.95), bell(0.2), { amp: 0.8 });
    tone(out, t + 0.1, 0.1, glide([[0, lo * 1.08], [0.3, lo], [1, lo * 0.9]]), bell(0.25));
  }
  return normalizePeak(out, 0.85);
}

// chaffinch: a cascade that speeds up and drops, ending in a flourish
function chaffinch() {
  const p = rnd(0.92, 1.08);
  const out = song(2.8);
  let t = 0.02;
  const n1 = irnd(3, 5);
  for (let i = 0; i < n1; i++) {
    tone(out, t, 0.05, sweep(6800 * p, 4600 * p), bell(0.2), { amp: 0.55 + 0.08 * i });
    t += 0.11 - i * 0.006;
  }
  const n2 = irnd(4, 6);
  for (let i = 0; i < n2; i++) {
    const f = (5600 - i * 230) * p;
    tone(out, t, 0.04, sweep(f * 1.15, f * 0.75), bell(0.25), { amp: 0.85 });
    t += 0.07;
  }
  tone(out, t + 0.03, 0.2, glide([[0, 2800 * p], [0.35, 5400 * p], [0.55, 5000 * p], [1, 2300 * p]]), bell(0.35), { h2: 0.1 });
  return normalizePeak(out, 0.85);
}

// blackbird: low, fluted, unhurried phrases that trail off into a twitter
function blackbird() {
  const out = song(3.4);
  let t = 0.03;
  let f = rnd(1500, 2400);
  const n = irnd(3, 6);
  for (let i = 0; i < n; i++) {
    const d = rnd(0.12, 0.32);
    const from = f;
    const to = Math.min(3200, Math.max(1300, f * rnd(0.8, 1.3)));
    const vr = rnd(5, 8) * d;
    const vd = rnd(0.008, 0.02);
    tone(out, t, d, (x) => (from + (to - from) * smooth(x)) * (1 + vd * Math.sin(6.2832 * vr * x)), bell(0.25), {
      amp: rnd(0.6, 1),
      h2: 0.12,
      h3: 0.04,
      breath: 0.03,
    });
    f = to;
    t += d + rnd(0.02, 0.08);
  }
  if (Math.random() < 0.7) {
    const m = irnd(3, 7);
    for (let j = 0; j < m; j++) {
      tone(out, t, rnd(0.015, 0.03), sweep(rnd(5000, 7500), rnd(3500, 6000)), bell(0.2), { amp: rnd(0.2, 0.35) });
      t += rnd(0.03, 0.05);
    }
  }
  return normalizePeak(out, 0.85);
}

// house sparrow: a few plain, buzzy "chirrup"s
function sparrow() {
  const n = irnd(2, 5);
  const out = song(n * 0.4 + 0.2);
  let t = 0.02;
  for (let i = 0; i < n; i++) {
    const f = rnd(2900, 3600);
    const d = rnd(0.05, 0.075);
    tone(out, t, d, glide([[0, f], [0.3, f * 1.45], [1, f * 1.05]]), bell(0.2), { amp: rnd(0.7, 1), h2: 0.35, h3: 0.15, breath: 0.06 });
    t += d + rnd(0.1, 0.3);
  }
  return normalizePeak(out, 0.85);
}

// blue tit: "tsee-tsee-tsirrrrr"
function blueTit() {
  const out = song(1.6);
  const p = rnd(0.95, 1.05);
  let t = 0.02;
  for (let i = 0; i < 2; i++) {
    tone(out, t, 0.06, sweep(7800 * p, 7300 * p), bell(0.25), { amp: 0.6 });
    t += 0.11;
  }
  t += 0.02;
  const reps = irnd(12, 20);
  for (let r = 0; r < reps; r++) {
    tone(out, t, 0.03, sweep(6200 * p, 4800 * p), bell(0.2), { amp: 0.7 * (1 - (r / reps) * 0.3) });
    t += 0.045;
  }
  return normalizePeak(out, 0.85);
}

// wood pigeon, somewhere across the garden: "coo-COO-coo, coo-coo"
function dove() {
  const f = rnd(430, 520);
  const out = song(2.6);
  const beats = [[0, 0.3, 0.8], [0.42, 0.55, 1], [1.05, 0.3, 0.8], [1.5, 0.28, 0.7], [1.85, 0.28, 0.7]];
  for (const [s, d, a] of beats) {
    tone(out, 0.03 + s, d, glide([[0, f * 0.92], [0.3, f], [1, f * 0.9]]), bell(0.35), {
      amp: a,
      h2: 0.22,
      h3: 0.06,
      breath: 0.12,
      low: true,
    });
  }
  return normalizePeak(out, 0.85);
}

// tawny owl: "hoo…  hu-hu-hoooooo" with its quavering end, or the "ke-wick" call
function owl(kewick) {
  if (kewick) {
    const out = song(0.7);
    const f = rnd(1250, 1500);
    tone(out, 0.02, 0.32, glide([[0, f * 0.8], [0.35, f * 1.15], [1, f * 0.85]]), bell(0.3), { h2: 0.45, h3: 0.2, breath: 0.25 });
    return normalizePeak(out, 0.85);
  }
  const f = rnd(360, 420);
  const tail = rnd(0.9, 1.2);
  const out = song(3.8);
  const voice = { h2: 0.1, h3: 0.02, breath: 0.1, low: true };
  tone(out, 0.03, 0.55, glide([[0, f * 0.93], [0.2, f], [1, f * 0.95]]), bell(0.3), voice);
  let t = 0.58 + rnd(1.0, 1.5);
  tone(out, t, 0.12, () => f * 0.98, bell(0.3), { ...voice, amp: 0.5 });
  t += 0.2;
  tone(out, t, 0.14, () => f, bell(0.3), { ...voice, amp: 0.6 });
  t += 0.24;
  const q = 17 * tail;
  tone(out, t, tail, (x) => f * (1 - 0.06 * x), (x) => bell(0.15)(x) * (0.8 + 0.2 * Math.sin(6.2832 * q * x)), { ...voice, amp: 0.95 });
  return normalizePeak(out, 0.85);
}

// ─────────────────────────── the sea ───────────────────────────

// Waves on a beach, one after another: the deep thump and roar as a wave
// breaks, the rush of foam up the sand, then the long fizzing hiss of the
// water draining back through it (thousands of tiny bursting bubbles).
function surf(seconds) {
  const len = Math.round(seconds * SR);
  const out = new Float32Array(len);
  // periodic filtered noises: rumble, roar (crash), rush (wash) and fizz
  const white = whiteNoise(len);
  const rumble = new Float32Array(len);
  const roar = new Float32Array(len);
  const rush = new Float32Array(len);
  const fizz = new Float32Array(len);
  const aR = coef(160);
  const aC = coef(1100);
  const aW1 = coef(600);
  const aW2 = coef(5000);
  const aF = coef(2600);
  let r1 = 0, r2 = 0, c1 = 0, c2 = 0, w1 = 0, w2 = 0, f1 = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < len; i++) {
      const x = white[i];
      r1 += aR * (x - r1);
      r2 += aR * (r1 - r2);
      c1 += aC * (x - c1);
      c2 += aC * (c1 - c2);
      w1 += aW1 * (x - w1);
      w2 += aW2 * (x - w1 - w2);
      f1 += aF * (x - f1);
      if (pass) {
        rumble[i] = r2 * 6;
        roar[i] = c2 * 1.6;
        rush[i] = w2;
        fizz[i] = x - f1;
      }
    }
  }
  // the waves: a few per loop, each a little different
  const waves = [];
  let t = rnd(0, 2);
  while (t < seconds - 2) {
    waves.push({ t, a: rnd(0.6, 1), wash: rnd(1.1, 1.8), drain: rnd(3.5, 5.5) });
    t += rnd(7.5, 11);
  }
  const bed = wander(len, 0.15);
  for (let i = 0; i < len; i++) {
    const now = i / SR;
    let eR = 0, eC = 0, eW = 0, eF = 0;
    for (const w of waves) {
      let d = now - w.t;
      if (d < 0) d += seconds; // wrap round, so the loop is seamless
      if (d > 11) continue;
      const crash = d < 0.35 ? d / 0.35 : Math.exp(-(d - 0.35) / 1.1);
      eR += w.a * crash;
      eC += w.a * crash * crash;
      const up = d < w.wash ? Math.sin((d / w.wash) * Math.PI * 0.5) : Math.exp(-(d - w.wash) / 1.6);
      eW += w.a * up * (d > 0.3 ? 1 : d / 0.3);
      const back = d < w.wash ? 0 : d < w.wash + 0.6 ? (d - w.wash) / 0.6 : Math.exp(-(d - w.wash - 0.6) / w.drain);
      eF += w.a * back;
    }
    out[i] = rumble[i] * (0.25 * eR + 0.1 * bed[i]) + roar[i] * (0.9 * eC + 0.08) + rush[i] * 0.55 * eW + fizz[i] * 0.12 * eF;
  }
  // bursting bubbles in the draining foam: a fine crackle that follows the fizz
  for (const w of waves) {
    const n = Math.round(w.a * 2600);
    for (let b = 0; b < n; b++) {
      const d = w.wash + Math.pow(Math.random(), 1.6) * w.drain * 1.4;
      const i0 = Math.round((((w.t + d) % seconds) + seconds) % seconds * SR);
      const f0 = rnd(2200, 7500);
      const dec = rnd(700, 2200);
      const k = Math.exp(-dec / SR);
      let env = rnd(0.01, 0.05) * Math.exp(-(d - w.wash) / w.drain);
      let ph = 0;
      const nS = Math.round((4 / dec) * SR);
      for (let s = 0; s < nS; s++) {
        ph += (f0 * (1 + (0.15 * dec * s) / SR)) / SR;
        if (ph >= 1) ph -= 1;
        out[(i0 + s) % len] += env * SINE[(ph * TAB) | 0];
        env *= k;
      }
    }
  }
  return normalize([out], 0.2);
}

// the whole sea along the coast, far and near: a soft, endless roar that swells
function seaBed(seconds) {
  const len = Math.round(seconds * SR);
  const swell = wander(len, 0.12);
  const chs = [];
  for (let c = 0; c < 2; c++) {
    const w = whiteNoise(len);
    const ch = new Float32Array(len);
    const a1 = coef(380);
    const aH = coef(60);
    let l1 = 0, l2 = 0, h = 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < len; i++) {
        l1 += a1 * (w[i] - l1);
        l2 += a1 * (l1 - l2);
        h += aH * (l2 - h);
        if (pass) ch[i] = (l2 - h) * (0.55 + 0.45 * swell[(i + c * 9000) % len]);
      }
    }
    chs.push(ch);
  }
  return normalize(chs, 0.12);
}

// herring gulls: the long "kee-ow" and the laughing "ha-ha-ha"
function gull(kind) {
  const out = song(2.6);
  const rasp = (fr) => (x) => bell(0.12)(x) * (0.78 + 0.22 * Math.sin(6.2832 * fr * x));
  const voice = { h2: 0.55, h3: 0.35, breath: 0.18 };
  if (kind === 0) {
    const n = irnd(2, 4);
    let t = 0.02;
    for (let i = 0; i < n; i++) {
      const f = rnd(1050, 1250);
      const d = rnd(0.26, 0.36);
      tone(out, t, d, glide([[0, f], [0.14, f * 1.8], [0.35, f * 1.7], [1, f * 1.02]]), rasp(d * 60), { ...voice, amp: rnd(0.7, 1) });
      t += d + rnd(0.12, 0.3);
    }
  } else {
    const n = irnd(5, 9);
    let t = 0.02;
    for (let i = 0; i < n; i++) {
      const f = rnd(1250, 1450) * (1 - i * 0.015);
      const d = rnd(0.08, 0.12);
      tone(out, t, d, glide([[0, f * 0.9], [0.3, f], [1, f * 0.85]]), rasp(d * 55), { ...voice, amp: 0.8 });
      t += d + rnd(0.05, 0.09);
    }
  }
  return normalizePeak(out, 0.85);
}

// ─────────────────────────── the library ───────────────────────────

// a burst of filtered noise shaped by an envelope function e(t) (t in seconds)
function noiseShape(seconds, lo, hi, env) {
  const len = Math.round(seconds * SR);
  const out = new Float32Array(len);
  const aL = coef(hi);
  const aH = coef(lo);
  let l = 0;
  let h = 0;
  for (let i = 0; i < len; i++) {
    const x = Math.random() * 2 - 1;
    l += aL * (x - l);
    h += aH * (l - h);
    out[i] = (l - h) * env(i / SR);
  }
  return out;
}
const thump = (out, at, f, dec, amp) => {
  const i0 = Math.round(at * SR);
  let ph = 0;
  for (let s = 0; i0 + s < out.length && s < SR * 0.25; s++) {
    ph += f * (1 - 0.3 * (s / (SR * 0.25))) / SR;
    out[i0 + s] += Math.sin(ph * 6.2832) * amp * Math.exp((-s / SR) * dec);
  }
};

// A page turning, in the time it takes on screen (about 0.7s): the crisp
// crackle as the corner lifts, the soft swish of the sheet swinging over, and a
// papery flap as it settles on the other side.
function pageTurn() {
  const dur = 0.95;
  const land = rnd(0.62, 0.7);
  const flutter = rnd(16, 26);
  // the swish: a band of air noise that swells and fades as the page swings
  const out = noiseShape(dur, 500, 4200, (t) => {
    const e = t < land ? Math.sin((Math.PI * t) / land) ** 1.4 : 0;
    return e * (0.7 + 0.3 * Math.sin(6.2832 * flutter * t)) * 0.55;
  });
  // the paper itself: brighter rustle, strongest as it lifts and as it lands
  const rustle = noiseShape(dur, 2500, 9000, (t) => (Math.exp(-(((t - 0.08) / 0.07) ** 2)) * 0.7 + Math.exp(-(((t - land) / 0.05) ** 2)) * 0.5 + 0.08) * 0.8);
  for (let i = 0; i < out.length; i++) out[i] += rustle[i];
  // crackles as the sheet bends
  for (let k = 0; k < 45; k++) {
    const i0 = Math.round((k < 25 ? rnd(0.01, 0.16) : rnd(0.16, land)) * SR);
    const n = 10 + Math.floor(Math.random() * 25);
    const a = (k < 25 ? rnd(0.1, 0.35) : rnd(0.03, 0.12));
    for (let s = 0; s < n && i0 + s < out.length; s++) out[i0 + s] += (Math.random() * 2 - 1) * a * (1 - s / n);
  }
  // …and the soft flap as it lands
  thump(out, land, 190, 28, 0.32);
  const flap = noiseShape(dur, 200, 2500, (t) => (t > land ? Math.exp(-(t - land) * 30) * 0.6 : 0));
  for (let i = 0; i < out.length; i++) out[i] += flap[i];
  return normalizePeak(out, 0.8);
}
// a book sliding along the shelf: soft friction, a little tap at the end
function bookSlide() {
  const dur = rnd(0.35, 0.5);
  const grain = wander(Math.round(dur * SR), 60);
  const out = noiseShape(dur, 200, 1600, (t) => Math.sin(Math.PI * Math.min(1, t / dur)) * (0.5 + 0.5 * grain[Math.min(grain.length - 1, Math.round(t * SR))]));
  thump(out, dur * 0.9, 120, 30, 0.35);
  return normalizePeak(out, 0.6);
}
// the cover opening: a creak of the spine, then the pages fanning
function bookOpen() {
  const out = noiseShape(0.7, 300, 2500, (t) => (t < 0.18 ? t / 0.18 : Math.exp(-(t - 0.18) * 5)) * 0.6);
  const flip = noiseShape(0.7, 1500, 8000, (t) => Math.max(0, Math.sin(Math.PI * ((t - 0.25) / 0.4))) * 0.4);
  for (let i = 0; i < out.length; i++) out[i] += flip[i];
  thump(out, 0.5, 140, 25, 0.25);
  return normalizePeak(out, 0.6);
}
// the book closing: a soft, papery "thup"
function bookClose() {
  const out = noiseShape(0.4, 150, 1800, (t) => Math.exp(-t * 18) * 0.8);
  thump(out, 0.0, 110, 20, 0.6);
  return normalizePeak(out, 0.7);
}
// ─────────────────────────── piano ───────────────────────────

// One piano note, played softly. Real piano strings are a little stiff, so
// their overtones sit slightly sharp; each note has two or three strings tuned
// a hair apart (the slow shimmer), a quick first decay then a long singing
// tail, and the felt hammer gives a soft knock at the start.
function pianoNote(midi) {
  const f0 = 440 * Math.pow(2, (midi - 69) / 12);
  const dur = Math.min(7.5, Math.max(2.8, 7.5 - (midi - 36) * 0.08));
  const len = Math.round(dur * SR);
  const out = new Float32Array(len);
  const B = 0.00012 * Math.pow(2, (midi - 48) / 18); // string stiffness
  const tail = dur / 3.2;
  const detune = 0.00045;
  for (let n = 1; n <= 24; n++) {
    const fn = n * f0 * Math.sqrt(1 + B * n * n);
    if (fn > 7000) break;
    // the hammer strikes an eighth of the way along the string, softening those overtones
    let amp = Math.pow(n, -1.25) * (0.3 + 0.7 * Math.abs(Math.sin(Math.PI * n * 0.125))) * Math.exp(-(n - 1) * 0.1);
    if (fn > 3000) amp *= 3000 / fn;
    const t2 = tail / (1 + 0.3 * (n - 1));
    const t1 = Math.min(0.35, t2 / 7);
    const k1 = Math.exp(-1 / (t1 * SR));
    const k2 = Math.exp(-1 / (t2 * SR));
    let e1 = 0.55 * amp;
    let e2 = 0.45 * amp;
    let pa = Math.random();
    let pb = Math.random();
    const ia = (fn * (1 + detune)) / SR;
    const ib = (fn * (1 - detune)) / SR;
    for (let s = 0; s < len; s++) {
      const e = e1 + e2;
      if (e < 1e-5) break;
      pa += ia;
      pb += ib;
      if (pa >= 1) pa -= 1;
      if (pb >= 1) pb -= 1;
      out[s] += e * 0.5 * (SINE[(pa * TAB) | 0] + SINE[(pb * TAB) | 0]);
      e1 *= k1;
      e2 *= k2;
    }
  }
  // soft attack, the felt's knock, and a gentle fade at the very end
  const knock = Math.round(0.012 * SR);
  let lp = 0;
  for (let s = 0; s < knock; s++) {
    lp += 0.25 * (Math.random() * 2 - 1 - lp);
    out[s] += lp * 0.06 * (1 - s / knock);
  }
  const att = Math.round(0.002 * SR);
  for (let s = 0; s < att; s++) out[s] *= s / att;
  const fade = Math.round(len * 0.15);
  for (let s = 0; s < fade; s++) out[len - 1 - s] *= s / fade;
  return normalizePeak(out, 0.7);
}

const many = (n, fn) => Array.from({ length: n }, () => [fn()]);
const BASIN = { bubbles: 480, rush: 0.8, body: 0.25, lowF: 500, highF: 6000, hp: 450, spray: 120 };

// what to render, in the order it's needed: night sounds out front first
export const JOBS = [
  ['wind', () => [wind(23)]],
  ['crickets', () => [crickets(13, 9, 2), crickets(9.7, 6, 1)]],
  ['owl', () => [[owl(false)], [owl(false)], [owl(true)]]],
  // one piano note every few semitones; the ones between are these, retuned
  ['piano', () => {
    const notes = [];
    for (let m = PIANO.base; m <= PIANO.top; m += PIANO.step) notes.push([pianoNote(m)]);
    return notes;
  }],
  ['rustle', () => [rustle(17)]],
  // three stretches of the basin (different lengths, so they never line up) + the jet
  ['water', () => [10.7, 9.1, 11.9].map((s) => water(s, BASIN))],
  ['jet', () => [water(7.3, { bubbles: 170, rush: 0.4, body: 0, lowF: 1100, highF: 7000, hp: 900, spray: 140 })]],
  ['pageTurn', () => [[pageTurn()], [pageTurn()], [pageTurn()]]],
  ['bookSlide', () => [[bookSlide()], [bookSlide()]]],
  ['bookOpen', () => [[bookOpen()], [bookOpen()]]],
  ['bookClose', () => [[bookClose()], [bookClose()]]],
  ['surf', () => [27.3, 31.1, 24.7].map((s) => surf(s))],
  ['seaBed', () => [seaBed(19)]],
  ['gull', () => [[gull(0)], [gull(0)], [gull(1)], [gull(0)]]],
  ['robin', () => many(6, robin)],
  ['greatTit', () => many(4, greatTit)],
  ['chaffinch', () => many(4, chaffinch)],
  ['blackbird', () => many(5, blackbird)],
  ['sparrow', () => many(4, sparrow)],
  ['blueTit', () => many(3, blueTit)],
  ['dove', () => many(2, dove)],
];

// running as a worker: render everything and hand it over as it's ready
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = () => {
    for (const [name, job] of JOBS) {
      const clips = job();
      self.postMessage({ name, clips, rate: SR }, clips.flat().map((c) => c.buffer));
    }
  };
}
