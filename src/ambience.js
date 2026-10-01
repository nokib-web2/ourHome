// Natural sounds for the garden (and the front of the house at night).
// The sounds themselves are rendered in soundSynth.js (in a worker, while the
// site loads); this file plays them in 3D with the Web Audio API:
//
//  • the fountain is a real sound source: water plashes into the basin all round
//    it and the jet patters into the bowl, so it grows louder as you walk up and
//    moves from ear to ear as you circle it or look around
//  • birds sit in the trees around the garden and sing in bouts, each species
//    in its own way; distant ones sound softer and duller
//  • a soft breeze, crickets at night, now and then a tawny owl
//  • down at the beach: waves breaking and washing up the sand along the
//    waterline, the wide roar of the sea, and gulls calling over the water
//  • inside, each room has its own music: a famous romantic piece played on a
//    piano in a warm hall (pieces.js), crossfading as you walk from room to room
//
// Levels (0–1) come from the scene every frame via set(), the listener follows
// the camera via listen(); everything fades smoothly.

import { PIANO, PIECES } from './pieces.js';

const VOLUME = 0.48; // overall loudness

export function createAmbience() {
  let ctx = null;
  let master = null;
  let reverb = null;
  let hall = null;
  let timer = null;
  let muted = false;
  const level = { wind: 0, birds: 0, crickets: 0, owl: 0, water: 0, music: 0, sea: 0, gulls: 0 };
  let seaAt = null; // { z (the waterline), y }
  const bus = {};
  const clips = {}; // name → AudioBuffer[]
  const pending = {}; // rendered but waiting for the AudioContext
  const ear = { x: 0, y: 1.6, z: 0 };
  let fountain = null; // { x, y, z } at the ground
  let garden = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[(Math.random() * list.length) | 0];

  // ── get the sounds rendered off the main thread, as soon as possible ──
  function receive(name, data, rate) {
    pending[name] = { data, rate };
    if (ctx) adopt(name);
  }
  let fellBack = false;
  async function renderHere() {
    if (fellBack) return;
    fellBack = true;
    const synth = await import('./soundSynth.js');
    for (const [name, job] of synth.JOBS) {
      if (clips[name] || pending[name]) continue;
      await new Promise((r) => setTimeout(r, 40));
      receive(name, job(), synth.SR);
    }
  }
  try {
    const worker = new Worker(new URL('./soundSynth.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => receive(e.data.name, e.data.clips, e.data.rate);
    worker.onerror = (e) => {
      e.preventDefault();
      worker.terminate();
      renderHere();
    };
    worker.postMessage('render');
  } catch {
    renderHere();
  }

  // ── building blocks ──
  const gainNode = (v, out) => {
    const g = ctx.createGain();
    g.gain.value = v;
    if (out) g.connect(out);
    return g;
  };
  const setPos = (p, x, y, z) => {
    if (p.positionX) {
      const t = ctx.currentTime;
      p.positionX.setValueAtTime(x, t);
      p.positionY.setValueAtTime(y, t);
      p.positionZ.setValueAtTime(z, t);
    } else p.setPosition(x, y, z);
  };
  // a point in the world that sound comes from
  function source(out, ref, x = 0, y = 0, z = 0) {
    const p = ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = 1;
    p.maxDistance = 1000;
    setPos(p, x, y, z);
    p.connect(out);
    return p;
  }
  function loop(buffer, out, gain = 1) {
    const s = ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = true;
    s.connect(gainNode(gain, out));
    s.start(ctx.currentTime + 0.05, Math.random() * buffer.duration);
    return s;
  }
  // A space for sound to ring in. Outdoors: a few early echoes off the house and
  // trees, then a short, dark tail (leaves soak up the highs). The gallery: a
  // longer, warm hall for the piano.
  function impulse(seconds, decay, echoes) {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      let lp = 0;
      let a = 1;
      for (let i = 0; i < len; i++) {
        const t = i / rate;
        if ((i & 63) === 0) a = 1 - Math.exp((-2 * Math.PI * (700 + 9000 * Math.exp(-t * 2.2))) / rate);
        lp += a * (Math.random() * 2 - 1 - lp);
        d[i] = lp * Math.exp(-t * decay) * Math.min(1, t / 0.015);
      }
      for (let k = 0; k < echoes; k++) {
        const i = Math.floor(rnd(0.01, 0.09) * rate);
        d[i] += (Math.random() < 0.5 ? -1 : 1) * rnd(0.3, 0.8) * (1 - i / (0.1 * rate));
      }
    }
    return buf;
  }

  // ── room music: a sampled piano and a little sequencer ──
  const music = { rooms: [], room: -1, voice: null, duck: 1 };
  function pianoNote(m, when, beats, vel, out) {
    const list = clips.piano;
    const k = Math.max(0, Math.min(list.length - 1, Math.round((m - PIANO.base) / PIANO.step)));
    const s = ctx.createBufferSource();
    s.buffer = list[k];
    s.playbackRate.value = Math.pow(2, (m - PIANO.base - k * PIANO.step) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, when);
    g.gain.setTargetAtTime(0, when + beats, 0.18); // the damper comes down when the note ends
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    s.connect(g);
    if (pan) {
      pan.pan.value = Math.max(-0.5, Math.min(0.5, (m - 62) / 40)); // low notes left, high right, like sitting at it
      g.connect(pan);
      pan.connect(out);
    } else g.connect(out);
    s.start(when);
    s.stop(Math.min(when + s.buffer.duration / s.playbackRate.value, when + beats + 1.5));
  }
  // one piece playing, with its own fader so pieces can crossfade
  function startVoice(what, when) {
    const gain = gainNode(0, bus.music);
    gain.gain.setTargetAtTime(1, when, 0.8);
    const voice = { gain, what, t0: when, next: 0 };
    if (!PIECES[what]) {
      // the couple's own recording
      voice.audio = new Audio(what);
      voice.audio.loop = true;
      ctx.createMediaElementSource(voice.audio).connect(gain);
      voice.audio.play().catch(() => {});
    }
    return voice;
  }
  function stopVoice(voice, now) {
    voice.stopped = true;
    voice.gain.gain.setTargetAtTime(0, now, 0.7);
    setTimeout(() => {
      voice.audio?.pause();
      voice.gain.disconnect();
    }, 5000);
  }
  function scheduleMusic(now) {
    const want = music.rooms[music.room] || 'none';
    if (level.music < 0.01 && music.voice) {
      stopVoice(music.voice, now);
      music.voice = null;
    }
    if (level.music >= 0.01 && want !== (music.voice?.what ?? 'none')) {
      if (music.voice) stopVoice(music.voice, now);
      music.voice = want === 'none' ? null : startVoice(want, now + (music.voice ? 1.2 : 0.3));
    }
    const v = music.voice;
    const piece = v && PIECES[v.what];
    if (!piece) return;
    if (!clips.piano) {
      if (v.next === 0) v.t0 = now + 0.3; // wait for the piano, then begin
      return;
    }
    const spb = 60 / piece.bpm;
    for (;;) {
      const [beat, m, beats, vel] = piece.events[v.next];
      const at = v.t0 + beat * spb;
      if (at >= now + 0.5) break;
      // a pianist, not a machine: every note a touch early or late, a touch softer or louder
      // (and anything missed while the page was busy is skipped, not crammed in)
      if (at > now - 0.2) pianoNote(m, Math.max(now, at + rnd(-0.012, 0.012)), beats * spb, vel * rnd(0.88, 1.08), v.gain);
      if (++v.next >= piece.events.length) {
        v.next = 0;
        v.t0 += piece.length * spb;
      }
    }
  }

  // ── the fountain ──
  const water = { emitters: [], jet: null, tone: null };
  const BASIN_SPOTS = [0, 2.09, 4.19]; // round the basin, 120° apart
  function placeWater() {
    if (!fountain) return;
    water.emitters.forEach((p, i) => {
      const a = BASIN_SPOTS[i];
      setPos(p, fountain.x + Math.cos(a) * 1.9, fountain.y + 0.6, fountain.z + Math.sin(a) * 1.9);
    });
    if (water.jet) setPos(water.jet, fountain.x, fountain.y + 2.5, fountain.z);
  }

  // ── birds: each one has a perch in the trees round the garden ──
  const BIRDS = [
    { kind: 'robin', gain: 0.75, every: [2.5, 6], bout: [4, 9], rest: [8, 25] },
    { kind: 'robin', gain: 0.55, every: [3, 7], bout: [3, 7], rest: [10, 30] },
    { kind: 'blackbird', gain: 0.8, every: [4, 9], bout: [3, 6], rest: [12, 35] },
    { kind: 'greatTit', gain: 0.6, every: [3, 7], bout: [2, 5], rest: [15, 40] },
    { kind: 'chaffinch', gain: 0.7, every: [5, 10], bout: [3, 7], rest: [10, 30] },
    { kind: 'sparrow', gain: 0.5, every: [1.5, 5], bout: [2, 6], rest: [6, 20] },
    { kind: 'blueTit', gain: 0.55, every: [4, 9], bout: [2, 4], rest: [15, 40] },
    { kind: 'dove', gain: 0.7, far: true, every: [5, 10], bout: [2, 4], rest: [25, 60] },
  ].map((b) => ({ ...b, next: rnd(0.5, 6), left: 0, pitch: rnd(0.96, 1.04), perch: null }));
  function perchFor(bird) {
    const c = garden || { x: ear.x, y: ear.y - 1.6, z: ear.z };
    const a = rnd(0, Math.PI * 2);
    const r = bird.far ? rnd(32, 45) : rnd(9, 22);
    return { x: c.x + Math.cos(a) * r, y: c.y + (bird.far ? rnd(7, 11) : rnd(3, 8)), z: c.z + Math.sin(a) * r };
  }
  function sing(bird, when) {
    const list = clips[bird.kind];
    if (!list) return 2;
    if (!bird.perch) bird.perch = perchFor(bird);
    if (!bird.node) {
      bird.node = source(bus.birds, bird.far ? 10 : 5);
      bird.dull = ctx.createBiquadFilter();
      bird.dull.type = 'lowpass';
      bird.dull.connect(bird.node);
    }
    const { x, y, z } = bird.perch;
    setPos(bird.node, x, y, z);
    // air and leaves take the edge off distant birds
    const dist = Math.hypot(x - ear.x, y - ear.y, z - ear.z);
    bird.dull.frequency.setValueAtTime(Math.max(3500, 16000 - dist * 260), when);
    const s = ctx.createBufferSource();
    s.buffer = pick(list);
    s.playbackRate.value = bird.pitch * rnd(0.985, 1.015);
    s.connect(gainNode(bird.gain * rnd(0.7, 1), bird.dull));
    s.start(when);
    return s.buffer.duration / s.playbackRate.value;
  }
  function scheduleBirds(now) {
    for (const b of BIRDS) {
      if (now < b.next) continue;
      // fewer birds sing as the light goes
      if (level.birds < 0.05 || (b.left <= 0 && Math.random() > 0.15 + level.birds * 0.55)) {
        b.next = now + rnd(1, 4);
        continue;
      }
      if (b.left <= 0) b.left = Math.round(rnd(...b.bout));
      const dur = sing(b, now + 0.05);
      b.left--;
      b.next = now + dur + rnd(...b.every);
      if (b.left <= 0) {
        b.next += rnd(...b.rest);
        if (Math.random() < 0.5) b.perch = perchFor(b); // hops to another tree
      }
    }
  }

  // ── the owl: somewhere off in the dark, never too close ──
  let owlNode = null;
  let nextOwl = 0;
  function owlCall(when) {
    if (!clips.owl) return;
    if (!owlNode) owlNode = source(bus.owl, 12);
    const a = rnd(0, Math.PI * 2);
    const r = rnd(28, 45);
    setPos(owlNode, ear.x + Math.cos(a) * r, ear.y + rnd(8, 14), ear.z + Math.sin(a) * r);
    const s = ctx.createBufferSource();
    // mostly the hoot, sometimes the sharp "ke-wick"
    s.buffer = Math.random() < 0.75 ? pick(clips.owl.slice(0, 2)) : clips.owl[2];
    s.playbackRate.value = rnd(0.97, 1.03);
    s.connect(owlNode);
    s.start(when);
  }

  // ── the sea: waves breaking along the waterline, and gulls over the water ──
  const surfNodes = [];
  const SURF_X = [-30, 0, 30];
  function placeSea() {
    if (!seaAt) return;
    surfNodes.forEach((p, i) => setPos(p, SURF_X[i], seaAt.y + 0.4, seaAt.z));
  }
  let gullNode = null;
  let nextGull = 0;
  function gullCall(when) {
    if (!clips.gull || !seaAt) return;
    if (!gullNode) gullNode = source(bus.gulls, 10);
    setPos(gullNode, ear.x + rnd(-40, 40), seaAt.y + rnd(10, 22), seaAt.z - rnd(5, 45));
    const s = ctx.createBufferSource();
    s.buffer = pick(clips.gull);
    s.playbackRate.value = rnd(0.94, 1.06);
    s.connect(gainNode(rnd(0.5, 1), gullNode));
    s.start(when);
  }

  // what to do with each set of sounds once it's ready
  function adopt(name) {
    const { data, rate } = pending[name];
    delete pending[name];
    if (clips[name]) return;
    clips[name] = data.map((chs) => {
      const b = ctx.createBuffer(chs.length, chs[0].length, rate);
      chs.forEach((c, i) => b.copyToChannel(c, i));
      return b;
    });
    const list = clips[name];
    // just a soft breeze: a low whoosh with the faintest stir of leaves
    if (name === 'wind') loop(list[0], bus.wind, 0.5);
    else if (name === 'rustle') loop(list[0], bus.wind, 0.18);
    else if (name === 'crickets') list.forEach((b) => loop(b, bus.crickets, 0.8));
    else if (name === 'water') {
      water.emitters = list.map((b) => {
        const p = source(water.tone, 3.5);
        loop(b, p, 0.7);
        return p;
      });
      placeWater();
    } else if (name === 'surf') {
      list.forEach((b) => {
        const p = source(bus.sea, 9);
        loop(b, p, 0.9);
        surfNodes.push(p);
      });
      placeSea();
    } else if (name === 'seaBed') {
      loop(list[0], bus.seaBed, 1);
    } else if (name === 'jet') {
      water.jet = source(water.tone, 2.5);
      loop(list[0], water.jet, 0.3);
      placeWater();
    }
  }

  // ── runs ten times a second ──
  let windVar = 1;
  function tick() {
    const now = ctx.currentTime;
    // the breeze comes and goes a little on top of its own gusts
    if (Math.random() < 0.03) windVar = rnd(0.78, 1.02);
    bus.wind.gain.setTargetAtTime(level.wind * 0.3 * windVar, now, 2.2);
    bus.birds.gain.setTargetAtTime(level.birds * 0.85, now, 1.6);
    bus.crickets.gain.setTargetAtTime(level.crickets * 0.35, now, 1.8);
    bus.owl.gain.setTargetAtTime(level.owl * 0.55, now, 1);
    bus.water.gain.setTargetAtTime(level.water, now, 1.2);
    bus.music.gain.setTargetAtTime(level.music * music.duck * 0.8, now, 0.6);
    bus.sea.gain.setTargetAtTime(level.sea, now, 1.5);
    bus.seaBed.gain.setTargetAtTime(level.sea * 0.35, now, 1);
    bus.gulls.gain.setTargetAtTime(level.gulls * 0.7, now, 0.8);
    if (level.gulls > 0.1 && now >= nextGull) {
      if (nextGull > 0) gullCall(now + 0.05);
      nextGull = now + rnd(5, 16);
    }
    scheduleMusic(now);
    if (fountain) {
      // from further off, the splashing loses its sparkle behind the flowers
      const d = Math.hypot(ear.x - fountain.x, ear.z - fountain.z);
      water.tone.frequency.setTargetAtTime(Math.max(1800, Math.min(9000, 10500 - d * 350)), now, 0.7);
    }
    scheduleBirds(now);
    if (level.owl > 0.1 && now >= nextOwl) {
      if (nextOwl > 0) owlCall(now + 0.05);
      nextOwl = now + rnd(18, 40);
    }
  }

  return {
    // must be called from a click/tap (browsers only allow sound after one)
    start() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (ctx) {
        ctx.resume();
        return;
      }
      ctx = new AC({ latencyHint: 'playback' });
      master = gainNode(muted ? 0 : VOLUME);
      // a gentle limiter, just so nothing can ever clip
      const limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -6;
      limit.knee.value = 6;
      limit.ratio.value = 8;
      limit.attack.value = 0.005;
      limit.release.value = 0.3;
      master.connect(limit);
      limit.connect(ctx.destination);
      reverb = ctx.createConvolver();
      reverb.buffer = impulse(1.3, 6, 6);
      reverb.connect(gainNode(0.2, master));
      hall = ctx.createConvolver();
      hall.buffer = impulse(2.8, 2.4, 6);
      hall.connect(gainNode(0.5, master));
      for (const k of ['wind', 'water', 'birds', 'crickets', 'owl', 'music', 'sea', 'seaBed', 'gulls']) bus[k] = gainNode(0, master);
      bus.sfx = gainNode(1, master);
      bus.sfx.connect(gainNode(0.25, hall));
      bus.music.connect(hall);
      bus.gulls.connect(gainNode(0.25, reverb));
      water.tone = ctx.createBiquadFilter();
      water.tone.type = 'lowpass';
      water.tone.frequency.value = 9000;
      water.tone.connect(bus.water);
      // birds and the owl ring out a little in the open air
      bus.birds.connect(gainNode(0.22, reverb));
      bus.owl.connect(gainNode(0.4, reverb));
      bus.crickets.connect(gainNode(0.08, reverb));
      bus.water.connect(gainNode(0.04, reverb));
      for (const name of Object.keys(pending)) adopt(name);
      timer = setInterval(tick, 100);
      // stay quiet while the tab is in the background
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) ctx.suspend();
        else ctx.resume();
      });
    },
    // where things are: the fountain and the middle of the garden (world units = metres)
    // one-off sounds (a page turning, a book taken off the shelf…)
    sfx(name, gain = name === 'pageTurn' ? 1.5 : 0.9) {
      const list = ctx && clips[name];
      if (!list) return;
      const s = ctx.createBufferSource();
      s.buffer = pick(list);
      s.playbackRate.value = rnd(0.94, 1.06);
      s.connect(gainNode(gain * rnd(0.85, 1), bus.sfx));
      s.start();
    },
    place({ fountain: f, garden: g, sea: s }) {
      if (f) fountain = { x: f.x, y: f.y, z: f.z };
      if (g) garden = { x: g.x, y: g.y, z: g.z };
      if (s) seaAt = { y: s.y, z: s.z };
      if (ctx) {
        placeWater();
        placeSea();
      }
    },
    // the listener's ears follow the camera (pass camera.matrixWorld)
    listen(m) {
      const e = m.elements;
      ear.x = e[12];
      ear.y = e[13];
      ear.z = e[14];
      if (!ctx) return;
      const L = ctx.listener;
      if (L.positionX) {
        const t = ctx.currentTime;
        const to = (param, v) => param.setTargetAtTime(v, t, 0.04);
        to(L.positionX, e[12]);
        to(L.positionY, e[13]);
        to(L.positionZ, e[14]);
        to(L.forwardX, -e[8]);
        to(L.forwardY, -e[9]);
        to(L.forwardZ, -e[10]);
        to(L.upX, e[4]);
        to(L.upY, e[5]);
        to(L.upZ, e[6]);
      } else {
        L.setPosition(e[12], e[13], e[14]);
        L.setOrientation(-e[8], -e[9], -e[10], e[4], e[5], e[6]);
      }
    },
    set(levels) {
      Object.assign(level, levels);
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.setTargetAtTime(m ? 0 : VOLUME, ctx.currentTime, 0.25);
    },
    // what plays in each room: a piece from pieces.js, a file, or 'none'
    setRooms(list) {
      music.rooms = list;
    },
    // the room you're in (the music follows once you're inside: set({ music }))
    setRoom(i) {
      music.room = i;
    },
    // quieter music while a photo or video is open
    duck(on) {
      music.duck = on ? 0.25 : 1;
    },
    get running() {
      return !!ctx && !!timer;
    },
    // for testing
    get context() {
      return ctx;
    },
    get clips() {
      return clips;
    },
    get output() {
      return master;
    },
  };
}
