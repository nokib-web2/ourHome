import * as THREE from 'three';
import * as TX from './textures.js';
import { meterPlane, archNotchShape, archTrimShape } from './geo.js';
import { DOOR } from './exterior.js';
import { buildLibrary } from './library.js';

// All rooms line up along -Z behind the facade, joined by arched doorways,
// so from the entrance you can look straight down the whole enfilade.
export const ROOM = { W: 16, D: 14, H: 7.5, T: 0.5, DOOR_W: 3.8, DOOR_RECT: 3.8 };
export const FACADE_DEPTH = 1;
export const EYE = 1.7;
const ROOM_LIGHT = 26;

const FRAMES = {
  gold: { color: '#c9a35d', metalness: 1, roughness: 0.4, border: 0.09 },
  black: { color: '#1c1a19', metalness: 0.1, roughness: 0.45, border: 0.06 },
  white: { color: '#f2eee7', metalness: 0, roughness: 0.6, border: 0.07 },
  walnut: { color: '#5b3b26', metalness: 0, roughness: 0.5, border: 0.08 },
};
const SIZES = {
  small: { w: 2.2, h: 1.7, y: 2.3 },
  medium: { w: 3.2, h: 2.4, y: 2.5 },
  large: { w: 4.6, h: 3.3, y: 2.95 },
};
const MAT = 0.14; // passe-partout width

export function roman(n) {
  const map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of map) {
    while (n >= v) {
      s += r;
      n -= v;
    }
  }
  return s;
}

export function wallPalette(hex = '#efe6da') {
  const c = new THREE.Color(hex);
  const lum = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return lum < 0.2
    ? { dark: true, ink: '#f4e9da', accent: '#d9b77c' }
    : { dark: false, ink: '#3a2e29', accent: '#9a7748' };
}

export function roomLayout(rooms) {
  const { D, T } = ROOM;
  return rooms.map((room, i) => {
    const zStart = -FACADE_DEPTH - i * (D + T);
    const zEnd = zStart - D;
    return { zStart, zEnd, zc: (zStart + zEnd) / 2, last: i === rooms.length - 1, library: !!room.library };
  });
}

function slotsFor(n, span, door) {
  if (door) {
    const inner = ROOM.DOOR_W / 2 + 0.3;
    const outer = span / 2 - 0.8;
    const cx = (inner + outer) / 2;
    return [-cx, cx].slice(0, Math.min(2, n)).map((x) => ({ x, maxW: outer - inner }));
  }
  return Array.from({ length: n }, (_, k) => ({ x: -span / 2 + (span * (k + 0.5)) / n, maxW: span / n - 1.4 }));
}

export function buildInterior(config, layout, assets, { sfx = () => {} } = {}) {
  let library = null;
  const { W, D, H, T, DOOR_W, DOOR_RECT } = ROOM;
  const group = new THREE.Group();
  const pickables = [];
  const occluders = [];
  const frames = [];
  const videos = [];
  const lights = [];
  const hasGarden = !!config.garden;
  const length = -layout[layout.length - 1].zEnd;

  const tex = {
    plaster: TX.plasterTexture(),
    wood: TX.woodTexture(),
    wash: TX.washTexture(),
    sky: TX.skylightTexture(),
  };

  const wallMats = config.rooms.map(
    (r) => new THREE.MeshStandardMaterial({ color: r.wall || '#efe6da', map: tex.plaster, roughness: 0.95 }),
  );
  const M = {
    trim: new THREE.MeshStandardMaterial({ color: '#f4eee6', roughness: 0.8 }),
    floor: new THREE.MeshStandardMaterial({ map: tex.wood, roughness: 0.46 }),
    ceiling: new THREE.MeshStandardMaterial({ color: '#f3eee6', map: tex.plaster, roughness: 1 }),
    // the ceiling light panel: a soft glow, not a glare
    skylight: new THREE.MeshBasicMaterial({ map: tex.sky, color: new THREE.Color(1.1, 1.05, 0.96) }),
    brass: new THREE.MeshStandardMaterial({ color: '#c09a5f', metalness: 1, roughness: 0.3 }),
    bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.2, 1.6) }),
    // The mat, bevel and photo are layered over the solid front of the frame.
    // Give each layer a depth bias as well as real spacing: the old 0.5 mm gaps
    // collapsed to the same depth-buffer value from across a room and shimmered.
    mat: new THREE.MeshStandardMaterial({
      color: '#e9e3d8',
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
    bevel: new THREE.MeshBasicMaterial({
      color: '#000000',
      transparent: true,
      opacity: 0.22,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
    pedestal: new THREE.MeshStandardMaterial({ color: '#f6f1ea', roughness: 0.6 }),
    ceramic: new THREE.MeshStandardMaterial({ color: '#e8dfd2', roughness: 0.3, side: THREE.DoubleSide }),
    marble: new THREE.MeshStandardMaterial({ color: '#f2efe9', roughness: 0.15 }),
  };
  const frameMats = Object.fromEntries(
    Object.entries(FRAMES).map(([k, f]) => [
      k,
      new THREE.MeshStandardMaterial({ color: f.color, metalness: f.metalness, roughness: f.roughness }),
    ]),
  );

  const add = (mesh, x = 0, y = 0, z = 0, parent = group) => {
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };

  // ── floor & ceiling run the full length ──
  const floor = add(new THREE.Mesh(meterPlane(W, length), M.floor), 0, 0, -length / 2);
  floor.rotation.x = -Math.PI / 2;
  const ceiling = add(new THREE.Mesh(meterPlane(W, length), M.ceiling), 0, H, -length / 2);
  ceiling.rotation.x = Math.PI / 2;
  occluders.push(floor);

  // inside face of the front wall (so the foyer doesn't show exterior stone)
  const entry = archNotchShape(W, H, DOOR.W, DOOR.RECT);
  const entryFace = add(new THREE.Mesh(new THREE.ShapeGeometry(entry, 40), wallMats[0]), 0, 0, -FACADE_DEPTH - 0.003);
  entryFace.rotation.y = Math.PI;
  const entryTrim = add(
    new THREE.Mesh(
      new THREE.ExtrudeGeometry(archTrimShape(0, 0, DOOR.W / 2, DOOR.W / 2 + 0.26, DOOR.RECT), { depth: 0.07, bevelEnabled: false, curveSegments: 40 }),
      M.trim,
    ),
    0,
    0,
    -FACADE_DEPTH,
  );
  entryTrim.rotation.y = Math.PI;
  add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 0.34), M.trim), 0, H - 0.15, -FACADE_DEPTH - 0.17);

  // ── framed photo ──
  // `onWall: false` gives a freestanding frame (no wall wash, lamp or caption)
  function framed(item, slot, room, pal, { onWall = true, maxH = 0 } = {}) {
    const asset = assets.get(item);
    const S = SIZES[item.size] || SIZES.medium;
    const key = FRAMES[item.frame] ? item.frame : FRAMES[room.frame] ? room.frame : 'gold';
    const style = FRAMES[key];
    const b = style.border;
    const m = item.mat === false ? 0 : MAT;
    const maxW = Math.min(S.w, slot.maxW - 2 * (m + b));
    let h = maxH || S.h;
    let w = h * asset.aspect;
    if (w > maxW) {
      w = maxW;
      h = w / asset.aspect;
    }
    const fw = w + 2 * (m + b);
    const fh = h + 2 * (m + b);

    const g = new THREE.Group();
    g.position.set(slot.x, S.y, 0);
    const inner = new THREE.Group();
    g.add(inner);

    const wash = new THREE.Mesh(
      new THREE.PlaneGeometry(fw * 1.9, fh * 1.75),
      new THREE.MeshBasicMaterial({
        map: tex.wash,
        color: pal.dark ? '#ffcf9a' : '#ffe6c7',
        transparent: true,
        opacity: pal.dark ? 0.2 : 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    if (onWall) add(wash, 0, fh * 0.1, 0.005, g);

    const frame = add(new THREE.Mesh(new THREE.BoxGeometry(fw, fh, 0.08), frameMats[key]), 0, 0, 0.04, inner);
    if (m) add(new THREE.Mesh(new THREE.PlaneGeometry(w + 2 * m, h + 2 * m), M.mat), 0, 0, 0.09, inner);
    add(new THREE.Mesh(new THREE.PlaneGeometry(w + 0.025, h + 0.025), M.bevel), 0, 0, 0.1, inner);
    const photo = add(
      new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map: asset.texture,
          color: new THREE.Color(0.93, 0.93, 0.93),
          polygonOffset: true,
          polygonOffsetFactor: -3,
          polygonOffsetUnits: -3,
        }),
      ),
      0,
      0,
      0.11,
      inner,
    );

    const data = { item, asset, inner, hover: 0, width: fw, height: fh, group: g };
    photo.userData.pick = data;
    frame.userData.pick = data;
    pickables.push(photo, frame);
    frames.push(data);
    if (asset.video) videos.push(data);
    if (!onWall) return g;

    // brass picture light
    const ly = fh / 2 + 0.26;
    const lw = Math.max(0.6, fw * 0.45);
    const arm = add(new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.36, 8), M.brass), 0, ly + 0.02, 0.18, g);
    arm.rotation.x = Math.PI / 2;
    const hood = add(
      new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, lw, 20, 1, false, 0, Math.PI), M.brass),
      0,
      ly,
      0.36,
      g,
    );
    hood.rotation.z = Math.PI / 2;
    add(new THREE.Mesh(new THREE.BoxGeometry(lw * 0.94, 0.012, 0.05), M.bulb), 0, ly - 0.035, 0.36, g);

    if (item.caption || item.date || asset.isVideo) {
      const ct = TX.captionTexture({ title: item.caption || '', date: item.date || '', video: !!asset.isVideo, ...pal });
      const cap = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, (3.2 * 200) / 1024),
        new THREE.MeshBasicMaterial({ map: ct, transparent: true, depthWrite: false }),
      );
      add(cap, 0, -fh / 2 - 0.4, 0.01, g);
    }
    return g;
  }

  // ── wall text ──
  function textPanel(item, slot, pal) {
    const g = new THREE.Group();
    g.position.set(slot.x, 2.7, 0);
    const w = Math.min(5.4, slot.maxW);
    const h = (w * 1000) / 1400;
    const t = TX.panelTexture({ title: item.title || '', text: item.text || '', ...pal });
    const wash = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 1.5, h * 1.6),
      new THREE.MeshBasicMaterial({
        map: tex.wash,
        color: '#ffe6c7',
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    add(wash, 0, h * 0.1, 0.004, g);
    add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })), 0, 0, 0.01, g);
    return g;
  }

  // ── velvet curtains in the doorways ──
  // Each doorway gets two drapes. A small vertex shader gives them soft folds;
  // as `open` goes 0 → 1 they gather towards the sides like a theatre curtain
  // held back with tie-backs, with deeper folds as the fabric bunches up.
  const curtains = [];
  const time = { value: 0 };
  const CW = DOOR_W / 2 + 0.28; // width of each drape (overlaps a little in the middle)
  const CH = DOOR_RECT + DOOR_W / 2 + 0.12; // top is hidden inside the wall above the arch
  const curtainGeo = new THREE.PlaneGeometry(CW, CH, 72, 16);
  curtainGeo.translate(CW / 2, CH / 2, 0); // x runs 0 (outer edge) → CW (middle)
  function makeCurtain(z, color) {
    const open = { value: 0 };
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.62, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, { uOpen: open, uTime: time, uW: { value: CW }, uH: { value: CH } });
      shader.vertexShader = `uniform float uOpen; uniform float uTime; uniform float uW; uniform float uH;\n${shader.vertexShader}`
        .replace(
          '#include <beginnormal_vertex>',
          `float s = position.x;
          float cy = position.y;
          float tie = exp(-pow((cy - 1.35) / 1.25, 2.0));          // pulled tightest at the tie-back
          float keep = 1.0 - uOpen * (0.74 + 0.2 * tie);            // how much width the drape still spans
          float k = 6.2831 * 5.5 / uW;                              // ~5 folds per drape
          float amp = 0.035 + uOpen * 0.1;
          float hem = 1.0 - cy / uH;
          float breeze = sin(uTime * 0.9 + cy * 1.1 + s * 2.0) * 0.012 * hem * (1.0 - uOpen);
          vec3 curtainPos = vec3(s * keep, cy, amp * sin(k * s) + breeze);
          float slope = amp * k * cos(k * s) / max(keep, 0.08);
          vec3 objectNormal = normalize(vec3(-slope, 0.0, 1.0));`,
        )
        .replace('#include <begin_vertex>', 'vec3 transformed = curtainPos;');
    };
    for (const side of [-1, 1]) {
      const drape = add(new THREE.Mesh(curtainGeo, mat), side * (DOOR_W / 2 + 0.28), 0.015, z);
      drape.scale.x = -side; // mirrored so each drape's x runs from its outer edge to the middle
    }
    const c = { setOpen: (v) => (open.value = v) };
    curtains.push(c);
    return c;
  }
  const CURTAIN_COLORS = ['#7a2c38', '#6e2a3f', '#2f4a44', '#7a2c38', '#6e2a3f'];

  // ── little sculptures on plinths ──
  function sculpture(kind) {
    const g = new THREE.Group();
    add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.05, 0.56), M.pedestal), 0, 0.525, 0, g);
    if (kind % 3 === 0) {
      add(new THREE.Mesh(new THREE.TorusKnotGeometry(0.17, 0.05, 160, 20, 2, 3), M.brass), 0, 1.36, 0, g);
    } else if (kind % 3 === 1) {
      const pts = [[0, 0], [0.12, 0], [0.16, 0.08], [0.2, 0.25], [0.17, 0.42], [0.09, 0.52], [0.08, 0.6], [0.12, 0.66]];
      add(new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 48), M.ceramic), 0, 1.05, 0, g);
    } else {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.21, 48, 32), M.marble), 0, 1.26, 0, g);
    }
    return g;
  }

  // ── rooms ──
  layout.forEach((r, i) => {
    const room = config.rooms[i];
    const pal = wallPalette(room.wall);
    const wm = wallMats[i];

    for (const side of [-1, 1]) {
      const wall = add(new THREE.Mesh(meterPlane(D, H), wm), (side * W) / 2, H / 2, r.zc);
      wall.rotation.y = (-side * Math.PI) / 2;
      occluders.push(wall);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.3, D + T), M.trim), side * (W / 2 - 0.17), H - 0.15, r.zc - T / 2);
      add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, D), M.trim), side * (W / 2 - 0.025), 0.11, r.zc);
    }

    // the last room opens onto the garden (its outside face is built by garden.js)
    const toGarden = r.last && hasGarden;
    if (!r.last || toGarden) {
      const shape = archNotchShape(W, H, DOOR_W, DOOR_RECT);
      add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 48 }), M.trim), 0, 0, r.zEnd - T);
      const faceGeo = new THREE.ShapeGeometry(shape, 48);
      occluders.push(add(new THREE.Mesh(faceGeo, wm), 0, 0, r.zEnd + 0.003));
      if (!toGarden) {
        const back = add(new THREE.Mesh(faceGeo, wallMats[i + 1]), 0, 0, r.zEnd - T - 0.003);
        back.rotation.y = Math.PI;
        occluders.push(back);
        makeCurtain(r.zEnd - T / 2, config.rooms[i].curtain || CURTAIN_COLORS[i % CURTAIN_COLORS.length]);
      }

      const trimGeo = new THREE.ExtrudeGeometry(archTrimShape(0, 0, DOOR_W / 2, DOOR_W / 2 + 0.24, DOOR_RECT), {
        depth: 0.07,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 48,
      });
      add(new THREE.Mesh(trimGeo, M.trim), 0, 0, r.zEnd);
      if (!toGarden) add(new THREE.Mesh(trimGeo, M.trim), 0, 0, r.zEnd - T).rotation.y = Math.PI;

      for (const [z, dir] of toGarden ? [[r.zEnd, 1]] : [[r.zEnd, 1], [r.zEnd - T, -1]]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 0.34), M.trim), 0, H - 0.15, z + dir * 0.17);
        const len = W / 2 - DOOR_W / 2 - 0.26;
        for (const s of [-1, 1]) {
          add(new THREE.Mesh(new THREE.BoxGeometry(len, 0.22, 0.05), M.trim), s * (W / 2 - len / 2), 0.11, z + dir * 0.025);
        }
      }
    } else {
      occluders.push(add(new THREE.Mesh(meterPlane(W, H), wm), 0, H / 2, r.zEnd));
      add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.3, 0.34), M.trim), 0, H - 0.15, r.zEnd + 0.17);
      add(new THREE.Mesh(new THREE.BoxGeometry(W, 0.22, 0.05), M.trim), 0, 0.11, r.zEnd + 0.025);
    }

    // sign painted on the wall: the next room's name above each doorway,
    // and your names above the final photo
    const next = config.rooms[i + 1];
    const signTex = toGarden
      ? TX.signTexture({ eyebrow: 'Step outside', title: config.garden.title, ...pal })
      : r.last
        ? TX.signTexture({ eyebrow: config.since || '', title: config.couple, ...pal })
        : TX.signTexture({ eyebrow: `Room ${roman(i + 2)}`, title: next.title, ...pal });
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, (6.4 * 340) / 2048),
      new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false, color: new THREE.Color(0.95, 0.95, 0.95) }),
    );
    add(sign, 0, r.last && !toGarden ? 5.75 : 6.57, r.zEnd + 0.012);

    if (room.library) {
      // the library: shelves and books instead of pictures, lit warm and low by
      // its chandelier and the fire
      // (the little frames on its shelves hold your own photos)
      const photos = [...assets.values()].filter((a) => !a.isVideo).map((a) => ({ texture: a.texture, aspect: a.aspect }));
      library = buildLibrary(config, room, { W, D, H, zStart: r.zStart, zEnd: r.zEnd }, { sfx, photos });
      group.add(library.group);
      lights.push({ position: new THREE.Vector3(0, H - 2.2, r.zc), intensity: ROOM_LIGHT * 0.65 });
      return;
    }

    // laylight in the ceiling + the room's light
    const sky = add(new THREE.Mesh(new THREE.PlaneGeometry(5.5, 8.5), M.skylight), 0, H - 0.005, r.zc);
    sky.rotation.x = Math.PI / 2;
    for (const [w, d, x, z] of [[5.9, 0.2, 0, 4.35], [5.9, 0.2, 0, -4.35], [0.2, 8.9, 2.85, 0], [0.2, 8.9, -2.85, 0]]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, d), M.trim), x, H - 0.14, r.zc + z);
    }
    // where this room's ceiling light sits; main.js moves a small pool of real
    // lights to the rooms nearest the camera (far cheaper than one light per room)
    lights.push({ position: new THREE.Vector3(0, H - 0.9, r.zc), intensity: ROOM_LIGHT * (pal.dark ? 1.2 : 1) });

    for (const s of [-1, 1]) add(sculpture(i * 2 + (s > 0 ? 1 : 0)), s * 7.25, 0, r.zEnd + 1.0);

    // hang everything
    const walls = [
      { key: 'left', items: room.left || [], x: -W / 2, z: r.zc, rot: Math.PI / 2, span: D, door: false },
      { key: 'right', items: room.right || [], x: W / 2, z: r.zc, rot: -Math.PI / 2, span: D, door: false },
      { key: 'back', items: room.back || [], x: 0, z: r.zEnd + 0.004, rot: 0, span: W, door: !r.last || toGarden },
    ];
    for (const w of walls) {
      if (!w.items.length) continue;
      const wg = new THREE.Group();
      wg.position.set(w.x, 0, w.z);
      wg.rotation.y = w.rot;
      group.add(wg);
      const slots = slotsFor(w.items.length, w.span, w.door);
      if (w.items.length > slots.length) {
        console.warn(`[gallery] "${room.title}" has more items on one wall than fit; extra items are skipped.`);
      }
      w.items.slice(0, slots.length).forEach((item, k) => {
        wg.add(item.type === 'text' ? textPanel(item, slots[k], pal) : framed(item, slots[k], room, pal));
      });
    }
  });

  // ── floating dust in the light ──
  const N = 360;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  const rr = TX.rng(99);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (rr() - 0.5) * 15;
    pos[i * 3 + 1] = 0.2 + rr() * 6.6;
    pos[i * 3 + 2] = -rr() * length;
    seed[i] = rr();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 500 } },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uScale;
      attribute float aSeed;
      varying float vA;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.18 + aSeed * 40.0) * 0.35;
        p.x += cos(uTime * 0.12 + aSeed * 23.0) * 0.4;
        p.z += sin(uTime * 0.1 + aSeed * 11.0) * 0.4;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = (0.016 + aSeed * 0.025) * uScale / -mv.z;
        gl_PointSize = clamp(size, 1.5, 3.0);
        float distanceFade = smoothstep(0.4, 2.0, -mv.z) * (1.0 - smoothstep(16.0, 22.0, -mv.z));
        vA = distanceFade * (0.3 + 0.5 * fract(aSeed * 7.13));
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA;
        gl_FragColor = vec4(1.0, 0.92, 0.78, a * 0.24);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  group.add(dust);

  // Videos on the walls play (muted, looping) only while you're near them,
  // so a gallery full of clips never decodes more than a room's worth at once.
  const VIDEO_RANGE = 13;
  const wp = new THREE.Vector3();
  function updateVideos(camPos) {
    for (const v of videos) {
      const el = v.asset.video;
      v.group.getWorldPosition(wp);
      const want = !v.held && camPos && wp.distanceTo(camPos) < VIDEO_RANGE;
      if (want && el.paused) el.play().catch(() => {});
      else if (!want && !el.paused) el.pause();
    }
  }

  function update(t, hovered, viewportHeight, camPos) {
    time.value = t;
    dustMat.uniforms.uTime.value = t;
    dustMat.uniforms.uScale.value = viewportHeight;
    for (const f of frames) {
      f.hover += ((f === hovered ? 1 : 0) - f.hover) * 0.12;
      f.inner.scale.setScalar(1 + f.hover * 0.025);
      f.inner.position.z = f.hover * 0.05;
    }
    if (videos.length) updateVideos(camPos);
  }

  // pause a wall video while it's playing big in the lightbox
  const holdVideo = (asset, held) => {
    for (const v of videos) if (v.asset === asset) v.held = held;
  };

  // lets the garden hang a freestanding framed photo that is clickable like the rest
  const makeFrame = (item, maxW, maxH, frame = 'gold') =>
    framed(item, { x: 0, maxW }, { frame }, wallPalette('#efe6da'), { onWall: false, maxH });

  return { group, pickables, occluders, lights, curtains, makeFrame, update, holdVideo, library };
}
