import './style.css';
import 'lenis/dist/lenis.css';
import * as THREE from 'three';
import Lenis from 'lenis';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import config from './config.js';
import { loadFonts, loadPhotos, updateImageAnimations } from './assets.js';
import { buildExterior } from './exterior.js';
import { buildInterior, roomLayout, wallPalette, ROOM } from './interior.js';
import { buildGarden, gardenLayout } from './garden.js';
import { buildBeach, SEA_Y } from './beach.js';
import { createNature } from './nature.js';
import { createAmbience } from './ambience.js';
import { ROOM_MUSIC } from './pieces.js';
import { texturesReady } from './vendor/ez-tree/textures.js';
import { buildTour } from './tour.js';
import { createPortal } from './portal.js';
import { createUI } from './ui.js';

const isTouch = matchMedia('(pointer: coarse)').matches;
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
// straight lines between [x, y] points, flat beyond the ends
const piecewise = (x, pts) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
  }
  return pts[pts.length - 1][1];
};

// Outside at blue hour → warm gallery light inside
const LOOK = {
  out: { fog: new THREE.Color('#40405c'), near: 45, far: 230, hemiSky: new THREE.Color('#7686b8'), hemiGround: new THREE.Color('#2a2420'), hemi: 1.1, env: 0.22, moon: 0.9 },
  in: { fog: new THREE.Color('#e9dccb'), near: 24, far: 150, hemiSky: new THREE.Color('#fff2e2'), hemiGround: new THREE.Color('#bda283'), hemi: 0.95, env: 0.42, moon: 0.0 },
  // …and out into the garden: day, then sunset, then a moonlit night
  garden: { fog: new THREE.Color('#f0d3c0'), near: 35, far: 175, hemiSky: new THREE.Color('#ffe8d4'), hemiGround: new THREE.Color('#6f7d56'), hemi: 1.1, env: 0.45, moon: 1.8, light: new THREE.Color('#ffd4a3') },
  sunset: { fog: new THREE.Color('#b77a72'), near: 30, far: 160, hemiSky: new THREE.Color('#ffb08a'), hemiGround: new THREE.Color('#4a4038'), hemi: 0.8, env: 0.28, moon: 1.2, light: new THREE.Color('#ff8a50') },
  night: { fog: new THREE.Color('#0c1224'), near: 22, far: 130, hemiSky: new THREE.Color('#34436f'), hemiGround: new THREE.Color('#0b0d13'), hemi: 0.32, env: 0.05, moon: 0.42, light: new THREE.Color('#9db0ff') },
};
const MOON = { color: new THREE.Color('#a9b8e8'), pos: new THREE.Vector3(-30, 40, 60) };
const tmpColor = new THREE.Color();
const gardenLook = { fog: new THREE.Color(), hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), light: new THREE.Color() };

// The garden's clock: it's day when you walk out, the sun sets after a little
// while, night falls, and then morning comes round again.
const DAY = 26;
const DUSK = 16;
const NIGHT = 60;
const DAWN = 14;
function nightAt(s) {
  const x = s % (DAY + DUSK + NIGHT + DAWN);
  const ease = (t) => t * t * (3 - 2 * t);
  if (x < DAY) return 0;
  if (x < DAY + DUSK) return ease((x - DAY) / DUSK);
  if (x < DAY + DUSK + NIGHT) return 1;
  return 1 - ease((x - DAY - DUSK - NIGHT) / DAWN);
}
// garden look for a given amount of night (0 day → 0.5 sunset → 1 night)
function mixGardenLook(n) {
  const [a, b, t] = n < 0.5 ? [LOOK.garden, LOOK.sunset, n / 0.5] : [LOOK.sunset, LOOK.night, (n - 0.5) / 0.5];
  for (const k of ['fog', 'hemiSky', 'hemiGround', 'light']) gardenLook[k].lerpColors(a[k], b[k], t);
  for (const k of ['near', 'far', 'hemi', 'env', 'moon']) gardenLook[k] = lerp(a[k], b[k], t);
  return gardenLook;
}

async function main() {
  history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  // the library is one more room, after the last of yours (its doors open onto the garden)
  if (config.library && !config.rooms.some((r) => r.library)) {
    config.rooms.push({ curtain: '#3a2a22', ...config.library, library: true, left: [], right: [], back: [] });
  }

  const ui = createUI(config);
  await loadFonts();
  const assets = await loadPhotos(config, (p) => ui.setProgress(p * 0.75));
  // bark & leaf photos for the trees (front and garden) and the garden's shrubs
  await Promise.race([texturesReady(), new Promise((r) => setTimeout(r, 15000))]);
  ui.setProgress(0.85);

  // ── renderer & scene ──
  const canvas = document.getElementById('webgl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  let pixelRatio = Math.min(devicePixelRatio, isTouch ? 1.5 : 1.75);
  const fullRatio = pixelRatio;
  let drawRatio = pixelRatio; // (what's actually drawn: full resolution while you read a book)
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.fog = new THREE.Fog(LOOK.out.fog.clone(), LOOK.out.near, LOOK.out.far);

  // A tighter depth range gives the thin gallery details several times more
  // precision and prevents distant overlays from swapping depth as the camera
  // drifts. The closest held object is still about 0.5 m away; the sky is 500 m.
  const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.2, 650);
  camera.rotation.order = 'YXZ';

  const hemi = new THREE.HemisphereLight(LOOK.out.hemiSky.clone(), LOOK.out.hemiGround.clone(), LOOK.out.hemi);
  const moonLight = new THREE.DirectionalLight('#a9b8e8', LOOK.out.moon);
  moonLight.position.set(-30, 40, 60);
  scene.add(hemi, moonLight, moonLight.target);

  // ── world ──
  const layout = roomLayout(config.rooms);
  const gLayout = config.garden ? gardenLayout(layout) : null;
  const houseLength = gLayout ? -(gLayout.zBack - 0.3) : -layout[layout.length - 1].zEnd + 18;
  const nature = createNature({ value: 0 });
  // (with a beach, the lawns stop at the top of the dunes)
  const exterior = buildExterior(config, { length: houseLength, nature, groundTo: gLayout && config.beach ? gLayout.center.z - 28 : -300 });
  // (the library's books make their paper sounds through the ambience, created below)
  const interior = buildInterior(config, layout, assets, { sfx: (name) => ambience.sfx(name) });
  const library = interior.library;
  const garden = gLayout ? buildGarden(config, layout, interior, nature, { sky: exterior.sky, lightDir: exterior.lightDir }) : null;
  // through the gate at the end of the garden: the beach
  const beach = garden && config.beach ? buildBeach(config, garden, { nature, sky: exterior.sky, sunDir: exterior.sunDir, sunMat: exterior.sunMat }) : null;
  scene.add(exterior.group, exterior.dome, interior.group);
  if (garden) scene.add(garden.group);
  if (beach) scene.add(beach.group);
  // from inside the house the garden is only seen through the glass doors: just what's
  // in view through them is drawn
  const portal = garden
    ? createPortal([garden.group, ...(beach ? [beach.group] : [])], {
        x0: -ROOM.DOOR_W / 2 - 0.1,
        x1: ROOM.DOOR_W / 2 + 0.1,
        y0: -0.3,
        y1: ROOM.DOOR_RECT + ROOM.DOOR_W / 2 + 0.1,
        z: garden.zBack,
      })
    : null;
  const isPortrait = () => innerWidth / innerHeight < 0.8;
  let portrait = isPortrait();
  const makeTour = () => buildTour(config, layout, { portrait, garden, beach });
  let tour = makeTour();
  // every stop on the tour: the rooms, plus the garden and the beach
  const stops = [
    ...config.rooms,
    ...(config.garden ? [{ title: config.garden.title, subtitle: config.garden.subtitle, eyebrow: 'Outside', wall: '#efe6da' }] : []),
    ...(beach ? [{ title: config.beach.title, subtitle: config.beach.subtitle, eyebrow: 'By the sea', wall: '#efe6da' }] : []),
  ];
  const palettes = stops.map((r) => wallPalette(r.wall));
  const lightPos = new THREE.Vector3();
  let gardenClock = 0; // seconds spent in the garden (drives day → night)
  const ambience = createAmbience();
  ui.onSound((on) => ambience.setMuted(!on));
  if (garden) ambience.place({ fountain: garden.center, garden: garden.center });
  if (beach) {
    ambience.place({ sea: { z: beach.shoreZ, y: SEA_Y } });
    // the low sun casts the boy's long shadow across the sand (he's the only thing
    // that casts one, so it's cheap); the light aims at the heart he draws
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(1024, 1024);
    Object.assign(moonLight.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 300 });
    moonLight.shadow.bias = -0.0004;
    moonLight.shadow.normalBias = 0.03;
    moonLight.target.position.copy(beach.heart);
  }
  // each room's music (a single `music` file in config.js plays everywhere instead)
  ambience.setRooms(config.music ? [] : config.rooms.map((r, i) => r.music || ROOM_MUSIC[i % ROOM_MUSIC.length]));

  // Three real lights serve every lamp on the walk (every light a shader has to
  // work out costs every pixel on screen, so there are only ever three). Light k
  // serves rooms k, k+3, k+6…, sitting in whichever is nearest and fading out
  // before it jumps; the porch lamps and the garden's night lamps take turns with
  // rooms whose light is fully faded out wherever they're needed, so no swap is seen.
  const ROOM_COLOR = new THREE.Color('#ffe4c4');
  const lampSlots = [[], [], []];
  interior.lights.forEach((l, i) =>
    lampSlots[i % 3].push({ lamp: l, pos: l.position, color: ROOM_COLOR, near: (z) => 1 - smoothstep(15, 21.5, Math.abs(l.position.z - z)) }),
  );
  const lampAt = (l) => l.getWorldPosition(new THREE.Vector3());
  // out front, until you're through the door (room 2's and 3's lights are still dark there)
  exterior.lamps.forEach((l, i) => lampSlots[1 + (i % 2)].push({ lamp: l, pos: lampAt(l), color: l.color, near: (z) => smoothstep(-0.5, 2.5, z) }));
  // in the garden (rooms 4's and 5's lights are dark by then)
  garden?.lamps.forEach((l, i) =>
    lampSlots[i % 2].push({ lamp: l, pos: lampAt(l), color: l.color, near: (z) => 1 - smoothstep(garden.zBack - 4, garden.zBack - 0.5, z) }),
  );
  const roomLights = lampSlots.map(() => {
    const l = new THREE.PointLight('#ffe4c4', 0, 0, 2);
    scene.add(l);
    return l;
  });
  const roomLightState = roomLights.map(() => ({ active: null, pending: null, switching: false }));
  const lampLevel = (c, z) => (c ? c.lamp.intensity * c.near(z) : 0);
  function placeRoomLight(light, c) {
    if (!c) return;
    light.position.copy(c.pos);
    light.color.copy(c.color);
  }
  function updateRoomLights(camZ, dt) {
    roomLights.forEach((light, k) => {
      let best = null;
      let bestI = 0;
      for (const c of lampSlots[k]) {
        const i = lampLevel(c, camZ);
        if (i > bestI) {
          bestI = i;
          best = c;
        }
      }
      const state = roomLightState[k];
      if (!state.active && best && !state.switching) {
        state.active = best;
        placeRoomLight(light, best);
      } else if (best !== state.active) {
        state.pending = best;
        state.switching = true;
      } else if (state.switching) {
        state.pending = null;
        state.switching = false;
      }

      // A shared light used to teleport between rooms at full intensity. Fade it
      // down first, move it while dark, then ease it back up so no wall flashes.
      const targetI = state.switching ? 0 : lampLevel(state.active, camZ);
      const rate = targetI < light.intensity ? 10 : 4.5;
      light.intensity += (targetI - light.intensity) * (1 - Math.exp(-dt * rate));
      if (state.switching && light.intensity < 0.035) {
        state.active = state.pending;
        state.pending = null;
        state.switching = false;
        placeRoomLight(light, state.active);
        light.intensity = 0;
      }
    });
  }

  // ── post-processing ──
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: isTouch ? 0 : 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(pixelRatio);
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  // shallow depth of field, only switched on for the butterfly close-up
  const bokeh = new BokehPass(scene, camera, { focus: 1.6, aperture: 0, maxblur: 0.012 });
  bokeh.enabled = false;
  composer.addPass(bokeh);
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.6, 1.0);
  const bloomSetSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => bloomSetSize(Math.round(w / 2), Math.round(h / 2)); // half-res glow is plenty
  composer.addPass(bloom);
  // Touch and slower GPUs run without multisampled render targets. SMAA keeps
  // the thin stair lips and picture-frame edges from crawling in that mode.
  const smaa = new SMAAPass();
  smaa.enabled = rt.samples === 0;
  composer.addPass(smaa);
  composer.addPass(new OutputPass());

  // Adaptive quality: if the GPU can't keep up, drop MSAA, then resolution.
  const quality = {
    level: 0,
    samples: [],
    track(dt) {
      if (document.visibilityState !== 'visible' || this.level >= 2) return;
      this.samples.push(dt);
      if (this.samples.length < 90) return;
      const sorted = [...this.samples].sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      this.samples = [];
      if (median > 1 / 42) this.lower();
    },
    lower() {
      this.level++;
      if (this.level === 1 && rt.samples > 0) {
        for (const t of [composer.renderTarget1, composer.renderTarget2]) {
          t.samples = 0;
          t.dispose();
        }
        smaa.enabled = true;
        pixelRatio = Math.min(pixelRatio, 1.25);
      } else {
        pixelRatio = Math.max(0.75, pixelRatio * 0.8);
      }
      drawRatio = pixelRatio;
      renderer.setPixelRatio(pixelRatio);
      composer.setPixelRatio(pixelRatio);
      resize();
    },
  };
  // A book in your hands is always drawn sharp, at full resolution, even if the
  // walk has had to lower it; the film grain steps aside so the words read cleanly.
  let sharp = false;
  function readingSharp(on) {
    if (on === sharp) return;
    sharp = on;
    document.body.classList.toggle('is-reading', on);
    const ratio = on ? Math.max(pixelRatio, fullRatio) : pixelRatio;
    if (ratio === drawRatio) return;
    drawRatio = ratio;
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    resize();
  }

  let baseFov = 50;
  function resize() {
    const w = innerWidth;
    const h = innerHeight;
    const aspect = w / h;
    camera.aspect = aspect;
    // keep roughly the same horizontal view on tall phone screens
    baseFov = aspect >= 1 ? 50 : Math.min(78, (2 * Math.atan(Math.tan((31 * Math.PI) / 180) / aspect) * 180) / Math.PI);
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    // phone rotated? switch between the wide and the tall camera route
    if (lenis && isPortrait() !== portrait) {
      portrait = !portrait;
      const p = camP;
      tour = makeTour();
      sizeTrack();
      lenis.resize();
      lenis.scrollTo(p * lenis.limit, { immediate: true, force: true });
    }
  }

  // ── scroll ──
  const track = document.getElementById('scroll-track');
  const sizeTrack = () => (track.style.height = `${Math.round(tour.total * (isTouch ? 70 : 85) + 100)}vh`);
  let lenis = null;
  let camP = 0;
  resize();
  addEventListener('resize', resize);
  // A small built-in (integrated) GPU starts without multisampling, rather than
  // stumbling through the first few seconds before the quality check lowers it.
  {
    const gl = renderer.getContext();
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const gpu = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    if (!isTouch && /Intel|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Basic Render/i.test(gpu)) quality.lower();
  }
  sizeTrack();
  lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.9, touchMultiplier: 1.3 });
  lenis.stop();

  const goTo = (i) => {
    clearFreeLook();
    const u = i === 0 ? 0 : tour.roomU[i - 1];
    lenis.scrollTo(tour.progressAt(u) * lenis.limit, { duration: 2.6 });
  };
  ui.buildNav(stops, goTo);
  let lightboxAsset = null;
  ui.onLightbox((open) => {
    ambience.duck(open);
    if (open) lenis.stop();
    else {
      lenis.start();
      // the wall copy of a video carries on once the big one is closed
      if (lightboxAsset) interior.holdVideo(lightboxAsset, false);
      lightboxAsset = null;
    }
  });

  // ── pointer: parallax + picking photos ──
  const pointer = new THREE.Vector2(9, 9);
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  const raycaster = new THREE.Raycaster();
  raycaster.far = 22;
  const pickTargets = [...interior.pickables, ...interior.occluders];
  let hovered = null;
  let needsPick = false;

  const pick = () => {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickTargets, false)[0];
    return hit?.object.userData.pick || null;
  };
  const client = { x: 0, y: 0 };
  let inLibrary = false;
  let readingWas = false;
  let libraryHinted = false;
  addEventListener('pointermove', (e) => {
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    client.x = e.clientX;
    client.y = e.clientY;
    if (e.pointerType === 'mouse') {
      parallax.tx = pointer.x;
      parallax.ty = pointer.y;
      needsPick = true;
    }
  });
  // Drag (or swipe sideways on a phone) to choose a direction. Once the visitor
  // looks somewhere, that world-space heading stays put while the rail moves.
  const look = { yaw: 0, pitch: 0, ty: 0, tp: 0, manual: false };
  const walk = { forward: false, backward: false, pathSign: 1, reassess: false };
  let prevRouteYaw = null;
  let prevRoutePitch = null;
  let authoredShotActive = false;
  let gardenHinted = false;
  function clearFreeLook() {
    look.yaw = 0;
    look.pitch = 0;
    look.ty = 0;
    look.tp = 0;
    look.manual = false;
    walk.pathSign = 1;
    walk.reassess = false;
    prevRouteYaw = null;
    prevRoutePitch = null;
  }
  const drag = { active: false, x: 0, y: 0, moved: 0, touch: false };
  let gardenF = 0;
  let beachF = 0;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    Object.assign(drag, { active: true, x: e.clientX, y: e.clientY, moved: 0, touch: e.pointerType !== 'mouse' });
    canvas.style.cursor = 'grabbing';
  });
  addEventListener('pointermove', (e) => {
    if (!drag.active) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.moved += Math.abs(dx) + Math.abs(dy);
    if (library?.reader.busy) return; // hands full: you're reading
    look.ty += dx * (drag.touch ? 0.005 : 0.003);
    if (!drag.touch) look.tp = Math.max(-0.45, Math.min(0.45, look.tp + dy * 0.003));
    if (drag.moved > 3) {
      look.manual = true;
      walk.reassess = true;
    }
  });
  for (const ev of ['pointerup', 'pointercancel']) {
    addEventListener(ev, () => {
      drag.active = false;
      canvas.style.cursor = hovered ? 'pointer' : 'grab';
    });
  }

  // The path still keeps visitors out of walls and flower beds, but the keyboard
  // now supplies true forward/back intent. Turn around first and W retraces it.
  const walkForward = new THREE.Vector3();
  const walkTangent = new THREE.Vector3();
  const walkKey = (code) => (code === 'KeyW' || code === 'ArrowUp' ? 'forward' : code === 'KeyS' || code === 'ArrowDown' ? 'backward' : '');
  const editingText = (e) => {
    const el = e.target;
    return e.ctrlKey || e.metaKey || e.altKey || el?.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el?.tagName || '');
  };
  addEventListener('keydown', (e) => {
    const key = walkKey(e.code);
    if (!key || editingText(e) || lenis.isStopped) return;
    if (!walk[key] && walk.reassess) {
      camera.getWorldDirection(walkForward);
      tour.tangentAt(camP, walkTangent);
      const facing = walkForward.x * walkTangent.x + walkForward.z * walkTangent.z;
      if (Math.abs(facing) > 0.15) walk.pathSign = facing < 0 ? -1 : 1;
      walk.reassess = false;
    }
    walk[key] = true;
    e.preventDefault();
  });
  addEventListener('keyup', (e) => {
    const key = walkKey(e.code);
    if (!key) return;
    if (walk[key]) e.preventDefault();
    walk[key] = false;
  });
  addEventListener('blur', () => {
    walk.forward = false;
    walk.backward = false;
  });

  // the butterfly resting on the rose (close-up shot) flies off when clicked
  const pickButterfly = () => {
    if (!garden || !garden.group.visible || !garden.heroResting()) return false;
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObject(garden.heroTarget, false).length > 0;
  };
  let hoverButterfly = false;

  canvas.addEventListener('click', (e) => {
    if (drag.moved > 6) return; // that was a drag, not a click
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    // the library: turn the pages of the book you're holding, or take one down
    if (library) {
      raycaster.setFromCamera(pointer, camera);
      if (library.reader.busy) {
        library.reader.click(raycaster);
        return;
      }
      if (inLibrary && library.open(raycaster, camera)) {
        lenis.stop();
        library.tip(null);
        canvas.style.cursor = 'default';
        return;
      }
    }
    if (pickButterfly()) {
      garden.releaseButterfly(time);
      hoverButterfly = false;
      canvas.style.cursor = 'grab';
      return;
    }
    const data = pick();
    if (!data) return;
    const { item, asset } = data;
    const playable = asset.isVideo && !asset.placeholder;
    if (playable) {
      lightboxAsset = asset;
      interior.holdVideo(asset, true);
      asset.video.pause();
    }
    ui.openLightbox({
      src: asset.url || asset.canvas.toDataURL('image/jpeg', 0.9),
      video: playable,
      startAt: playable ? asset.video.currentTime : 0,
      title: item.caption,
      date: item.date,
      story: item.story,
    });
  });

  // ── warm up & reveal: compile every shader and upload every texture up front,
  // then draw a frame from each viewpoint of the walk, all behind the loading
  // screen, so walking into a new room (or the garden, or the beach) never stalls ──
  const hidden = [];
  scene.traverse((o) => {
    if (!o.visible && !o.isLight) {
      hidden.push(o);
      o.visible = true;
    }
  });
  // (the scene is really drawn into the composer's buffer, not the screen, and shaders
  // are built for where they draw: compile them for that, or they'd compile again later)
  renderer.setRenderTarget(composer.readBuffer);
  renderer.compile(scene, camera);
  const uploaded = new Set();
  const upload = (t) => {
    if (t?.isTexture && !uploaded.has(t) && !t.isVideoTexture && !t.isRenderTargetTexture) {
      uploaded.add(t);
      renderer.initTexture(t);
    }
  };
  scene.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      for (const v of Object.values(m)) upload(v);
      if (m.uniforms) for (const v of Object.values(m.uniforms)) upload(v?.value);
    }
  });
  const warm = new THREE.WebGLRenderTarget(192, 108, { type: THREE.HalfFloatType });
  renderer.setRenderTarget(warm);
  renderer.shadowMap.needsUpdate = true;
  for (let k = 0; k <= tour.endU; k++) {
    const s = tour.sample(tour.progressAt(k));
    camera.position.copy(s.pos);
    camera.rotation.set(s.pitch, s.yaw, 0);
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    ui.setProgress(0.85 + 0.14 * (k / Math.max(1, tour.endU)));
  }
  renderer.setRenderTarget(null);
  warm.dispose();
  for (const o of hidden) o.visible = false;
  // compile the close-up blur too, so the first macro shot doesn't hitch
  if (garden) {
    camera.position.set(garden.heroView.x, garden.heroView.y, garden.heroView.z);
    camera.lookAt(garden.heroSpot);
    bokeh.enabled = true;
    composer.render();
    bokeh.enabled = false;
  }
  ui.setProgress(1);

  let time = 0;
  let lastNow = performance.now();
  let enterTime = -1;
  ui.ready(() => {
    enterTime = time;
    ambience.setMuted(!ui.soundOn);
    ambience.start();
    lenis.start();
  });

  const startAudioOnGesture = () => {
    ambience.setMuted(!ui.soundOn);
    ambience.start();
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach((ev) =>
      window.removeEventListener(ev, startAudioOnGesture)
    );
  };
  ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, startAudioOnGesture, { passive: true })
  );

  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  if (import.meta.env.DEV) {
    // dev helper: __gallery.jump(0.5) teleports to 50% of the tour
    window.__gallery = {
      get tour() {
        return tour;
      },
      lenis,
      renderer,
      scene,
      composer,
      bloom,
      rt,
      quality,
      camera,
      look,
      interior,
      ambience,
      beach,
      garden,
      setGardenClock(s) {
        gardenClock = s;
      },
      jump(p) {
        clearFreeLook();
        lenis.scrollTo(p * lenis.limit, { immediate: true, force: true });
        camP = p;
      },
      jumpU(u) {
        this.jump(tour.progressAt(u));
      },
      // render n frames synchronously and return the average GPU+CPU time per frame
      bench(n = 20) {
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        tick(performance.now());
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        const t0 = performance.now();
        for (let i = 0; i < n; i++) tick(t0 + i * 16.7);
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        return +((performance.now() - t0) / n).toFixed(2);
      },
    };
  }

  function loop(now) {
    requestAnimationFrame(loop);
    tick(now);
  }

  function tick(now) {
    const dt = Math.min(Math.max(0, now - lastNow) / 1000, 0.05);
    lastNow = now;
    time += dt;
    lenis.raf(now);

    const walkAxis = (walk.forward ? 1 : 0) - (walk.backward ? 1 : 0);
    if (walkAxis && !lenis.isStopped && lenis.limit > 0) {
      const next = Math.max(0, Math.min(lenis.limit, lenis.targetScroll + walkAxis * walk.pathSign * innerHeight * 0.85 * dt));
      lenis.scrollTo(next, { immediate: true, force: true });
    }

    const target = lenis.limit > 0 ? clamp01(lenis.scroll / lenis.limit) : 0;
    camP += (target - camP) * (1 - Math.exp(-dt * 5));
    const s = tour.sample(camP);
    const u = s.u;

    // the beach: out through the garden gate. For the close-up of the writing the
    // camera leaves the scroll route and follows the tip of the stick instead.
    const bu = tour.beachU;
    beachF = beach ? smoothstep(bu.gate - 0.3, bu.reveal + 0.2, u) : 0;
    const closeK = beach ? smoothstep(bu.closeA - 0.6, bu.closeA - 0.05, u) * (1 - smoothstep(bu.closeB + 0.05, bu.closeB + 0.55, u)) : 0;
    const cu = tour.closeU;
    const macro = cu < 0 ? 0 : smoothstep(cu - 0.5, cu - 0.1, u) * (1 - smoothstep(cu + 0.08, cu + 0.35, u));
    if (closeK > 0.001) {
      const d = beach.shot.target.clone().sub(beach.shot.pos);
      let fy = Math.atan2(-d.x, -d.z);
      fy += Math.PI * 2 * Math.round((s.yaw - fy) / (Math.PI * 2));
      s.pos.lerp(beach.shot.pos, closeK);
      s.yaw += (fy - s.yaw) * closeK;
      s.pitch += (Math.atan2(d.y, Math.hypot(d.x, d.z)) - s.pitch) * closeK;
    }
    const authoredShot = macro > 0.001 || closeK > 0.001;
    if (authoredShot && !authoredShotActive) clearFreeLook();
    authoredShotActive = authoredShot;

    // The tour may turn underneath us, especially through the library and around
    // the fountain. Cancel that scripted turn after a manual look so the chosen
    // world-space direction remains steady.
    if (prevRouteYaw !== null && look.manual) {
      const dy = Math.atan2(Math.sin(s.yaw - prevRouteYaw), Math.cos(s.yaw - prevRouteYaw));
      const dp = s.pitch - prevRoutePitch;
      look.ty -= dy;
      look.yaw -= dy;
      look.tp -= dp;
      look.pitch -= dp;
    }
    prevRouteYaw = s.yaw;
    prevRoutePitch = s.pitch;

    // cinematic reveal: smooth drone drift toward the house after entering
    const reveal = enterTime < 0 ? 0 : easeOut(clamp01((time - enterTime) / 3.8));
    parallax.x += (parallax.tx - parallax.x) * (1 - Math.exp(-dt * 3));
    parallax.y += (parallax.ty - parallax.y) * (1 - Math.exp(-dt * 3));
    camera.position.copy(s.pos);
    camera.position.z += (1 - reveal) * 9;
    camera.position.y += (1 - reveal) * 2.2 + Math.sin(time * 0.6) * 0.012;
    let yaw = s.yaw;

    // outside ↔ inside ↔ garden
    const door = smoothstep(tour.approachU - 0.55, tour.doorU - 0.15, u);
    const inside = smoothstep(tour.doorU - 0.15, tour.doorU + 0.65, u);
    gardenF = garden ? smoothstep(tour.gardenDoorU - 0.4, tour.gardenDoorU + 1.4, u) : 0;
    // the garden's day runs while you're out there; go back inside and it's day again next time
    if (gardenF > 0.3) gardenClock += dt;
    else if (gardenF < 0.02) gardenClock = 0;
    // (down on the beach it's always golden hour, the sun just above the sea)
    const night = lerp(garden ? nightAt(gardenClock) : 0, 0.25, beachF);
    nature.update(time, innerHeight * drawRatio);

    // Behind the closed curtain before it, the library can't be seen at all (nor the
    // garden through its glass doors), so neither is drawn until that curtain opens.
    const libSeen = !library || u > tour.roomU[config.rooms.length - 2] + 0.3;
    if (library) library.group.visible = libSeen;
    if (garden) {
      // the garden is only drawn once you're near the back of the house
      const nearBack = s.pos.z < garden.zBack + 34;
      garden.group.visible = nearBack && libSeen;
      exterior.frontTrees.visible = !nearBack;
      garden.setDoor(smoothstep(tour.gardenDoorU - 0.7, tour.gardenDoorU + 0.25, u));
      garden.update(time, innerHeight * drawRatio, night);
      // back up toward the house and the butterfly is waiting on its rose again
      if (tour.closeU >= 0 && u < tour.closeU - 1.2 && !garden.heroResting()) garden.resetButterfly();
    }
    if (beach) {
      beach.group.visible = garden.group.visible;
      garden.setGate(smoothstep(bu.gate - 1.1, bu.gate - 0.1, u));
      // Scroll tells his story: he draws the heart as you come down to the beach,
      // writes as you watch up close, and stands up as the camera rises. Scroll
      // back and it all runs backwards; stop and he waits.
      const m = beach.marks;
      const target = piecewise(u, [[bu.reveal - 0.3, 0], [bu.approach - 0.1, m.heartEnd], [bu.closeA - 0.1, m.kneelEnd], [bu.closeB + 0.35, m.textEnd], [bu.drone, 1]]);
      beach.update({ dt, t: time, target, camera, night });
      renderer.shadowMap.autoUpdate = u > bu.gate - 1.5;
    }
    // Before the first intentional look, movement gently follows the authored
    // framing. Afterwards the visitor's chosen heading stays persistent.
    if (!drag.active) {
      const wrapped = Math.atan2(Math.sin(look.ty), Math.cos(look.ty));
      look.yaw += wrapped - look.ty; // keep the angle small without a visible jump
      look.ty = wrapped;
      if (!look.manual && Math.abs(target - camP) > 0.0006) {
        const k = Math.exp(-dt * 2.2);
        look.ty *= k;
        look.tp *= k;
      }
    }
    look.yaw += (look.ty - look.yaw) * (1 - Math.exp(-dt * 7));
    look.pitch += (look.tp - look.pitch) * (1 - Math.exp(-dt * 7));
    const px = (drag.active ? 0 : 1) / s.zoom; // keep the mouse sway gentle when zoomed in
    const fov = baseFov / s.zoom;
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    // macro lens feel: blur everything but the butterfly while zoomed in
    bokeh.enabled = (macro > 0.001 && !!garden) || closeK > 0.001;
    if (closeK > macro) {
      // …and on the tip of the stick in the sand
      bokeh.uniforms.focus.value = s.pos.distanceTo(beach.pen);
      bokeh.uniforms.aperture.value = 0.006 * closeK;
    } else if (bokeh.enabled) {
      bokeh.uniforms.focus.value = s.pos.distanceTo(garden.heroSpot);
      bokeh.uniforms.aperture.value = 0.012 * macro;
    }
    camera.rotation.set(
      s.pitch + look.pitch + parallax.y * 0.03 * px + (1 - reveal) * 0.04,
      yaw + look.yaw - parallax.x * 0.05 * px,
      0,
    );
    // "click the butterfly" hint, pinned to the butterfly on screen
    if (garden) {
      const show = garden.heroResting() ? smoothstep(0.6, 0.95, macro) : 0;
      if (show > 0.001) {
        camera.updateMatrixWorld();
        const p = garden.heroSpot.clone().project(camera);
        ui.butterflyHint(show, ((p.x + 1) / 2) * innerWidth, ((1 - p.y) / 2) * innerHeight);
      } else ui.butterflyHint(0);
    }

    // curtains draw open as you walk up to each doorway
    interior.curtains.forEach((c, i) => c.setOpen(smoothstep(tour.roomU[i] + 0.3, tour.passU[i] + 0.05, u)));

    exterior.setDoor(door);
    exterior.setGarden(gardenF, night);
    // Keep the practical porch lights alive until the facade is actually behind
    // us; fading them to near-black in the doorway looked like a lighting fault.
    exterior.update(time, camera, 1 - smoothstep(0.55, 1, inside) * 0.7, drawRatio);
    interior.update(time, hovered, innerHeight * drawRatio, camera.position);
    if (library) {
      inLibrary = library.contains(camera.position);
      camera.updateMatrixWorld();
      library.update(dt, time, camera, inLibrary ? 1 : 0);
      // put the book back and you can walk on
      if (readingWas && !library.reader.busy) lenis.start();
      readingWas = library.reader.busy;
      readingSharp(library.reader.held);
      if (inLibrary && !libraryHinted && Math.abs(target - camP) < 0.001 && u > tour.roomU[config.rooms.length - 1] - 0.2) {
        libraryHinted = true;
        ui.flashHint(isTouch ? 'Tap any book to take it down and read it' : 'Click any book to take it down and read it', 4200);
      }
    }
    updateImageAnimations(time * 1000); // animated GIFs / WEBPs on the walls
    updateRoomLights(camera.position.z, dt);
    if (enterTime >= 0 && time - enterTime > 1.5 && !library?.reader.busy) quality.track(dt);

    const A = LOOK.out;
    const B = LOOK.in;
    const G = mixGardenLook(night);
    const mix = (k) => lerp(lerp(A[k], B[k], inside), G[k], gardenF);
    const mixColor = (target, k) => target.lerpColors(tmpColor.lerpColors(A[k], B[k], inside), G[k], gardenF);
    mixColor(scene.fog.color, 'fog');
    scene.fog.near = mix('near');
    scene.fog.far = mix('far');
    mixColor(hemi.color, 'hemiSky');
    mixColor(hemi.groundColor, 'hemiGround');
    hemi.intensity = mix('hemi');
    moonLight.intensity = mix('moon');
    // the main light: the moon over the front, the sun (or moon) over the garden
    moonLight.color.lerpColors(MOON.color, G.light, gardenF);
    lightPos.copy(exterior.lightDir).multiplyScalar(100);
    moonLight.position.lerpVectors(MOON.pos, lightPos, gardenF).add(moonLight.target.position);
    scene.environmentIntensity = mix('env');
    bloom.strength = lerp(lerp(0.42, 0.22, inside), lerp(0.32, 0.48, night), gardenF);
    bloom.radius = lerp(lerp(0.48, 0.28, inside), 0.42, gardenF);
    // inside, only the lamps glow; in the garden at night, fireflies & fairy lights do
    bloom.threshold = lerp(lerp(1.3, 1.8, inside), lerp(2.1, 1.35, night), gardenF);
    if (beachF > 0) {
      // by the sea the air is hazy and golden, and the sun glitters on the water
      scene.fog.color.lerp(exterior.sky.horizon.value, beachF * 0.7);
      scene.fog.near = lerp(scene.fog.near, 70, beachF);
      scene.fog.far = lerp(scene.fog.far, 650, beachF);
      bloom.threshold = lerp(bloom.threshold, 2.2, beachF);
      bloom.strength = lerp(bloom.strength, 0.3, beachF);
      bloom.radius = lerp(bloom.radius, 0.35, beachF);
    }

    // sound: night sounds out front; inside, only each room's own music; birdsong by day and
    // crickets by night once you step out into the garden. The fountain is a sound source in
    // 3D, so its loudness comes from how far away you are.
    const front = 1 - inside;
    const outdoors = garden ? smoothstep(tour.gardenDoorU - 0.25, tour.gardenDoorU + 1.35, u) : 0;
    const gardenBed = outdoors * outdoors;
    let room = 0;
    tour.passU.forEach((pu, i) => {
      if (u >= pu - 0.15) room = Math.min(i + 1, config.rooms.length - 1);
    });
    ambience.setRoom(room);
    // the sea: heard (faintly) from the garden, louder as you come through the gate
    const sea = beach ? gardenBed * (0.08 + 0.92 * smoothstep(bu.gate - 1.5, bu.reveal, u)) : 0;
    ambience.set({
      wind: 0.4 * front + outdoors * (0.6 + 0.12 * beachF),
      birds: 0.65 * gardenBed * (1 - night) * (1 - 0.7 * beachF),
      crickets: 0.55 * front + 0.45 * gardenBed * night,
      owl: 0.4 * front + 0.35 * gardenBed * night,
      water: 0.68 * gardenBed,
      music: inside * (1 - outdoors),
      sea,
      gulls: beachF * (1 - night),
    });
    camera.updateMatrixWorld();
    ambience.listen(camera.matrixWorld);
    if (portal && garden.group.visible) portal.update(camera.position);

    // hover a photo (or, in the library, a book: it slides out a little and shows its title)
    if (library && inLibrary && !drag.active) {
      if (library.reader.busy) {
        library.tip(null);
        canvas.style.cursor = 'default';
      } else if (needsPick) {
        needsPick = false;
        raycaster.setFromCamera(pointer, camera);
        const b = library.hover(raycaster);
        library.tip(b, client.x, client.y);
        canvas.style.cursor = b ? 'pointer' : 'grab';
      }
    } else if (library && !inLibrary) library.tip(null);
    if (needsPick && inside > 0.5 && !drag.active && !inLibrary) {
      needsPick = false;
      hoverButterfly = pickButterfly();
      hovered = hoverButterfly ? null : pick();
      canvas.style.cursor = hovered || hoverButterfly ? 'pointer' : 'grab';
    } else if (inside <= 0.5 && hovered) {
      hovered = null;
      canvas.style.cursor = 'grab';
    }

    // overlays
    let chapter = { i: 0, o: 0 };
    let active = 0;
    tour.roomU.forEach((ru, i) => {
      const o = smoothstep(ru - 0.75, ru - 0.2, u) * (1 - smoothstep(ru + 0.35, ru + 0.9, u));
      if (o > chapter.o) chapter = { i, o };
      if (u >= ru - 0.6) active = i + 1;
    });
    if (library?.reader.busy) chapter = { i: chapter.i, o: 0 }; // (the room's title steps aside while you read)
    ui.update({
      introO: reveal * (1 - smoothstep(0.12, 0.6, u)),
      chapter,
      outroO: smoothstep(tour.endU - 0.7, tour.endU - 0.05, u),
      active,
      progress: camP,
      inside,
      dark: active > 0 && palettes[active - 1].dark && gardenF < 0.5,
      garden: gardenF > 0.5,
    });
    if (gardenF > 0.9 && !gardenHinted) {
      gardenHinted = true;
      ui.flashHint(isTouch ? 'Swipe sideways to choose your view' : 'Drag to choose direction · W/S or ↑/↓ to move', 4000);
    }

    composer.render();
  }
  requestAnimationFrame(loop);
}

main();
