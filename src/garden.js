import * as THREE from 'three';
import * as TX from './textures.js';
import { ROOM } from './interior.js';
import { boxM, meterPlane, archPath, archTrimShape, halfDiscShape } from './geo.js';
import { planter } from './nature.js';
import { createButterflies } from './butterflies.js';
import { buildFountain } from './fountain.js';

// Behind the house: step out of the last room onto a terrace and into a round
// flower garden at sunrise, with a fountain in the middle, rose arches,
// cherry trees, drifting petals and, at the far end, a flower arch with your
// favourite photo on an easel.

const GROUND = -0.9;
const RING = 19; // hedge ring radius
const BED_IN = 5.4;
const BED_OUT = 16.8;
const PATH = 1.5; // half width of the cross paths

export function gardenLayout(layout) {
  const zBack = layout[layout.length - 1].zEnd - ROOM.T; // outer face of the last wall
  const center = new THREE.Vector3(0, GROUND, zBack - 27);
  return { zBack, center, arborZ: center.z - 15.5 };
}

export function buildGarden(config, layout, interior, nature, { sky, lightDir }) {
  const group = new THREE.Group();
  const { zBack, center: C, arborZ } = gardenLayout(layout);
  const { W: DW, RECT: DR } = { W: ROOM.DOOR_W, RECT: ROOM.DOOR_RECT };
  const time = nature.time;
  // 0 by day, 1 at night: fades in fireflies, fairy lights and the garden lamps
  const nightGlow = { value: 0 };

  const tex = {
    stone: TX.stoneTexture(),
    paving: TX.pavingTexture(),
    grass: TX.grassTexture(),
    window: TX.windowTexture(),
    glow: TX.glowTexture(),
  };
  const M = {
    stone: new THREE.MeshStandardMaterial({ map: tex.stone, roughness: 0.9 }),
    trim: new THREE.MeshLambertMaterial({ color: '#f5ecdf' }),
    paving: new THREE.MeshLambertMaterial({ color: '#f1e8dc', map: tex.paving }),
    lawn: new THREE.MeshLambertMaterial({ color: '#a8c07e', map: tex.grass }),
    white: new THREE.MeshLambertMaterial({ color: '#f7f3ec' }),
    wood: new THREE.MeshLambertMaterial({ color: '#7a5436' }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a466', roughness: 0.3, metalness: 1 }),
    glass: new THREE.MeshBasicMaterial({ color: '#e6f1f1', transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
    windowGlass: new THREE.MeshBasicMaterial({ map: tex.window, color: new THREE.Color(1.25, 1.15, 1.05) }),
  };

  const add = (mesh, x = 0, y = 0, z = 0, parent = group) => {
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const flat = (mesh) => {
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  };

  // ── back facade of the house ──
  const WIN = [-5.8, 5.8, -11, 11];
  const fs = new THREE.Shape();
  fs.moveTo(-15, GROUND);
  fs.lineTo(15, GROUND);
  fs.lineTo(15, 11.5);
  fs.lineTo(-15, 11.5);
  fs.lineTo(-15, GROUND);
  fs.holes.push(archPath(new THREE.Path(), 0, 0, DW, DR));
  for (const x of WIN) fs.holes.push(archPath(new THREE.Path(), x, 1.3, 2.2, 3.0));
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: 0.3, bevelEnabled: false, curveSegments: 40 }), M.stone), 0, 0, zBack - 0.3);
  const EXT = { depth: 0.16, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 40 };
  const trimAt = (shape) => add(new THREE.Mesh(new THREE.ExtrudeGeometry(shape, EXT), M.trim), 0, 0, zBack - 0.46);
  trimAt(archTrimShape(0, 0, DW / 2, DW / 2 + 0.4, DR));
  add(new THREE.Mesh(boxM(0.6, 0.95, 0.3), M.trim), 0, DR + DW / 2 + 0.25, zBack - 0.42);
  for (const x of WIN) {
    add(new THREE.Mesh(new THREE.PlaneGeometry(2.2, 4.1), M.windowGlass), x, 1.3 + 2.05, zBack - 0.12).rotation.y = Math.PI;
    trimAt(archTrimShape(x, 1.3, 1.1, 1.36, 3.0));
    add(new THREE.Mesh(boxM(3.0, 0.2, 0.4), M.trim), x, 1.2, zBack - 0.45);
  }
  add(new THREE.Mesh(boxM(31, 0.6, 1.2), M.trim), 0, 11.8, zBack - 0.3);
  add(new THREE.Mesh(boxM(30.2, 0.9, 0.8), M.stone), 0, 12.55, zBack - 0.4);
  add(new THREE.Mesh(boxM(30.6, 0.26, 0.6), M.trim), 0, 7.05, zBack - 0.3);
  add(new THREE.Mesh(boxM(30.6, 0.88, 0.7), M.trim), 0, GROUND + 0.43, zBack - 0.35);

  // ── glass French doors (open outward as you approach) ──
  const doorZ = zBack + ROOM.T / 2;
  const leaves = [-1, 1].map((sign) => {
    const pivot = new THREE.Group();
    pivot.position.set((sign * DW) / 2, 0, doorZ);
    const lw = DW / 2 - 0.01;
    const lh = DR - 0.06;
    const cx = (-sign * lw) / 2;
    const bar = (w, h, x, y) => add(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.09), M.white), x, y, 0, pivot);
    bar(0.12, lh, -sign * 0.06, lh / 2);
    bar(0.12, lh, -sign * (lw - 0.06), lh / 2);
    bar(lw, 0.14, cx, 0.07);
    bar(lw, 0.12, cx, lh - 0.06);
    bar(lw, 0.25, cx, 1.0);
    for (const y of [2.0, 2.9]) bar(lw, 0.05, cx, y);
    bar(0.05, lh - 1.1, cx, 1.1 + (lh - 1.1) / 2);
    add(new THREE.Mesh(new THREE.PlaneGeometry(lw - 0.2, lh - 0.2), M.glass), cx, lh / 2, 0, pivot);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.05), M.brass), -sign * (lw - 0.2), 1.3, 0.07, pivot);
    group.add(pivot);
    return pivot;
  });
  add(new THREE.Mesh(new THREE.ShapeGeometry(halfDiscShape(DW / 2), 40), M.glass), 0, DR, doorZ);
  add(new THREE.Mesh(new THREE.BoxGeometry(DW, 0.12, 0.1), M.white), 0, DR, doorZ);
  for (let k = 1; k < 6; k++) {
    const a = (k * Math.PI) / 6;
    const spoke = add(new THREE.Mesh(new THREE.BoxGeometry(DW / 2, 0.04, 0.05), M.white), Math.cos(a) * (DW / 4), DR + Math.sin(a) * (DW / 4), doorZ);
    spoke.rotation.z = a;
  }

  // ── terrace & steps ──
  add(new THREE.Mesh(boxM(13.2, 0.3, 5.3), M.paving), 0, -0.75, zBack - 2.95);
  add(new THREE.Mesh(boxM(12.6, 0.3, 4.8), M.paving), 0, -0.45, zBack - 2.7);
  add(new THREE.Mesh(boxM(12, 0.3, 5.1), M.paving), 0, -0.15, zBack + ROOM.T - 2.55); // runs under the doorway too

  // ── lawn, soil & paths ──
  flat(add(new THREE.Mesh(new THREE.CircleGeometry(RING + 0.6, 64), M.lawn), C.x, GROUND + 0.004, C.z));
  flat(add(new THREE.Mesh(new THREE.RingGeometry(BED_IN - 0.25, BED_OUT + 0.3, 128, 1), nature.mats.soil), C.x, GROUND + 0.007, C.z));
  flat(add(new THREE.Mesh(meterPlane(PATH * 2, zBack - 5.6 - (C.z - RING - 0.4)), M.paving), 0, GROUND + 0.011, (zBack - 5.6 + C.z - RING - 0.4) / 2));
  // the lawn carries on out to the woods (or, by the sea, to the top of the dunes)
  const seaside = !!config.beach;
  const DUNES = RING + 9; // distance from the fountain to where the lawn meets the sand
  const farGrass = tex.grass.clone();
  let lawnGeo;
  if (seaside) {
    const a = Math.asin(DUNES / 98);
    const pts = [];
    for (let k = 0; k <= 64; k++) {
      const t = Math.PI - a + (k / 64) * (Math.PI + 2 * a);
      pts.push(new THREE.Vector2(Math.cos(t) * 98, Math.sin(t) * 98));
    }
    lawnGeo = new THREE.ShapeGeometry(new THREE.Shape(pts), 1);
    farGrass.repeat.set(45 / 196, 45 / 196);
  } else {
    lawnGeo = new THREE.CircleGeometry(98, 64);
    farGrass.repeat.set(45, 45);
  }
  const farLawn = new THREE.Mesh(lawnGeo, new THREE.MeshLambertMaterial({ color: '#98b273', map: farGrass }));
  flat(add(farLawn, C.x, GROUND + 0.002, C.z));
  // distant woodland all round (open on the house side, which hides that gap,
  // and on the sea side, where the dunes and the beach are)
  const woodArc = (start, len) => add(new THREE.Mesh(new THREE.CylinderGeometry(95, 95, 20, 48, 1, true, start, len), nature.mats.treeline), C.x, GROUND + 9, C.z);
  if (seaside) {
    const edge = Math.PI - Math.acos(DUNES / 95) + 0.02;
    woodArc(0.3, edge - 0.3);
    woodArc(Math.PI * 2 - edge, edge - 0.3);
  } else woodArc(0.3, Math.PI * 2 - 0.6);
  flat(add(new THREE.Mesh(meterPlane(RING * 2 + 0.8, PATH * 2), M.paving), C.x, GROUND + 0.011, C.z));
  flat(add(new THREE.Mesh(new THREE.CircleGeometry(4.8, 48), M.paving), C.x, GROUND + 0.013, C.z));
  flat(add(new THREE.Mesh(new THREE.CircleGeometry(3.6, 48), M.paving), 0, GROUND + 0.013, arborZ + 0.4));

  // ── plants ──
  // Everything below is instanced and split into chunks (see nature.js), so
  // thousands of flowers stay cheap to draw.
  const rnd = TX.rng(2024);
  const P = planter(group, C);
  const { geo: G, mats: NM } = nature;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eu = new THREE.Euler();
  const pv = new THREE.Vector3();
  const sv = new THREE.Vector3();
  const col = new THREE.Color();
  const at = (x, y, z, s, tilt = 0.12) => {
    eu.set((rnd() - 0.5) * tilt, rnd() * Math.PI * 2, (rnd() - 0.5) * tilt);
    return m4.compose(pv.set(x, y, z), q.setFromEuler(eu), sv.setScalar(s));
  };
  const vary = (hex, amt = 0.08) => col.set(hex).offsetHSL((rnd() - 0.5) * 0.02, (rnd() - 0.5) * amt, (rnd() - 0.5) * amt);
  const onPath = (lx, lz) => Math.abs(lx) < PATH + 0.2 || Math.abs(lz) < PATH + 0.2;
  // colour drifts: real formal gardens plant each colour in a block, not confetti
  const drift = (lx, lz, palette, n) => {
    const a = (Math.atan2(lx, lz) + Math.PI) / (Math.PI * 2);
    return palette[Math.floor(a * n + (rnd() < 0.08 ? 1 : 0)) % palette.length];
  };
  const scatter = (rIn, rOut, step, fn) => {
    for (let x = -rOut; x <= rOut; x += step) {
      for (let z = -rOut; z <= rOut; z += step) {
        const lx = x + (rnd() - 0.5) * step * 0.9;
        const lz = z + (rnd() - 0.5) * step * 0.9;
        const r = Math.hypot(lx, lz);
        if (r < rIn || r > rOut || onPath(lx, lz)) continue;
        fn(C.x + lx, C.z + lz, lx, lz, r);
      }
    }
  };
  const ROSES = ['#9e1b32', '#f2a7b8', '#fff3ea', '#f6b48c', '#c2185b', '#f7d6de'];
  const TULIPS = ['#c8102e', '#f5c518', '#f48fb1', '#fffaf0', '#7b3fa0', '#ff7a3d', '#e7385b', '#fbd3e0'];
  const DAISIES = ['#ffffff', '#fbe3ee', '#f3a6c8', '#ffffff', '#d9589a'];
  const rose = (x, y, z, s, c) => P.add('rose', G.rose, NM.rose, at(x, y, z, s, 1.4), vary(c));
  const shrub = (x, y, z, s, small = false, tilt = 0.15) =>
    P.add(small ? 'smallShrub' : 'shrub', small ? G.smallShrub : G.shrub, NM.shrub, at(x, y, z, s, tilt), vary('#ffffff', 0.12));

  // roses: leafy bushes covered in blooms, closest to the fountain
  scatter(BED_IN + 0.1, 8.1, 0.72, (x, z, lx, lz) => {
    shrub(x, GROUND, z, 1.0 + rnd() * 0.45);
    const c = drift(lx, lz, ROSES, 16);
    for (let k = 0; k < 4 + ((rnd() * 3) | 0); k++) {
      rose(x + (rnd() - 0.5) * 0.6, GROUND + 0.4 + rnd() * 0.36, z + (rnd() - 0.5) * 0.6, 1.05 + rnd() * 0.35, c);
    }
  });
  // tulips in blocks of colour
  scatter(8.4, 11.3, 0.25, (x, z, lx, lz) => {
    const m = at(x, GROUND, z, 1.1 + rnd() * 0.35, 0.18);
    P.add('tulipGreens', G.tulipGreens, NM.greens, m, null);
    P.add('tulipHead', G.tulipHead, NM.head, m, vary(drift(lx, lz, TULIPS, 20), 0.1));
  });
  // daisies & cosmos
  scatter(11.5, 13.5, 0.3, (x, z, lx, lz) => {
    const m = at(x, GROUND, z, 1.0 + rnd() * 0.4, 0.25);
    P.add('daisyGreens', G.daisyGreens, NM.greens, m, null);
    P.add('daisyHead', G.daisyHead, NM.head, m, vary(drift(lx, lz, DAISIES, 12), 0.06));
    if (rnd() < 0.3) shrub(x, GROUND, z, 0.7 + rnd() * 0.3, true);
  });
  // the rose bush right by the path where a butterfly rests for the close-up
  const heroBush = new THREE.Vector3(C.x + 2.15, GROUND, C.z + 15.7);
  shrub(heroBush.x, GROUND, heroBush.z, 0.9);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    rose(heroBush.x + Math.cos(a) * 0.3, GROUND + 0.4 + rnd() * 0.18, heroBush.z + Math.sin(a) * 0.3, 1.25 + rnd() * 0.3, '#f2a7b8');
  }
  P.add('rose', G.rose, NM.rose, m4.compose(pv.set(heroBush.x, GROUND + 0.7, heroBush.z), q.identity(), sv.setScalar(1.9)), col.set('#f4b3c2'));
  const heroSpot = new THREE.Vector3(heroBush.x, GROUND + 0.79, heroBush.z);
  const heroView = new THREE.Vector3(C.x + 0.85, GROUND + 1.55, C.z + 16.3); // where the camera leans in
  heroSpot.yaw = Math.atan2(-(heroView.z - heroSpot.z), heroView.x - heroSpot.x); // body across the view, back to the lens

  // a lavender border against the hedge
  scatter(13.7, BED_OUT - 0.1, 0.5, (x, z) => {
    if (Math.hypot(x - heroBush.x, z - heroBush.z) < 0.7) return;
    P.add('lavender', G.lavender, NM.lavender, at(x, GROUND, z, 0.85 + rnd() * 0.4, 0.2), vary('#ffffff', 0.1));
  });
  // grass: the lawn strip inside the hedge, and the lawns outside it
  const grass = (x, z) => P.add('grass', G.grass, NM.grass, at(x, GROUND, z, 0.8 + rnd() * 0.6, 0.25), null);
  scatter(BED_OUT + 0.15, RING - 0.5, 0.3, grass);
  scatter(RING + 0.9, 27, 0.8, (x, z) => {
    if (z > zBack - 5.8 && Math.abs(x) < 7) return; // not on the terrace steps
    grass(x, z);
  });

  // rose arches over the paths (the one at the entrance frames your first view)
  const along = (g, n, span, postH, fn) => {
    g.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (let k = 0; k < n; k++) {
      let px;
      let py;
      if (rnd() < 0.42) {
        px = (rnd() < 0.5 ? -1 : 1) * span;
        py = 0.2 + rnd() * postH;
      } else {
        const a = rnd() * Math.PI;
        px = Math.cos(a) * span;
        py = postH + Math.sin(a) * span;
      }
      v.set(px + (rnd() - 0.5) * 0.25, py + (rnd() - 0.5) * 0.2, (rnd() - 0.5) * 0.3).applyMatrix4(g.matrixWorld);
      fn(v);
    }
  };
  const roseArch = (x, z, rotY, span = 1.4, postH = 2.3) => {
    const g = new THREE.Group();
    g.position.set(x, GROUND, z);
    g.rotation.y = rotY;
    group.add(g);
    for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.1, postH, 0.1), M.white), s * span, postH / 2, 0, g);
    add(new THREE.Mesh(new THREE.TorusGeometry(span, 0.05, 8, 40, Math.PI), M.white), 0, postH, 0, g);
    const c = ROSES[(rnd() * ROSES.length) | 0];
    along(g, 90, span, postH, (v) => {
      shrub(v.x, v.y - 0.2, v.z, 0.7 + rnd() * 0.5, true, 3);
      if (rnd() < 0.7) rose(v.x, v.y + 0.05, v.z, 1.1 + rnd() * 0.4, rnd() < 0.7 ? c : '#fff3ea');
    });
    along(g, 120, span, postH, (v) => archLights.push(v.x, v.y + 0.1, v.z)); // fairy lights for the night
  };
  const archLights = [];
  roseArch(C.x, C.z + 13.5, 0);
  roseArch(C.x + 16.2, C.z, Math.PI / 2);
  roseArch(C.x - 16.2, C.z, Math.PI / 2);

  // ── the garden gate to the sea: a white picket gate under a rose arch ──
  const gateZ = C.z - RING;
  const gateLeaves = [];
  if (seaside) {
    roseArch(C.x, gateZ, 0);
    for (const sign of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(C.x + sign * 1.36, GROUND, gateZ);
      const dir = -sign; // each leaf reaches in toward the middle
      const lw = 1.32;
      for (const y of [0.3, 0.86]) add(new THREE.Mesh(new THREE.BoxGeometry(lw, 0.07, 0.035), M.white), (dir * lw) / 2, y, -0.03, pivot);
      const brace = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, Math.hypot(lw - 0.1, 0.56), 0.03), M.white), (dir * lw) / 2, 0.58, -0.05, pivot);
      brace.rotation.z = dir * Math.atan2(lw - 0.1, 0.56);
      for (let k = 0; k < 8; k++) {
        const x = dir * (0.08 + k * 0.165);
        const u = Math.abs(x) / 1.36; // pickets rise toward the middle of the gate
        const h = 0.92 + 0.22 * (1 - (1 - u) * (1 - u));
        add(new THREE.Mesh(new THREE.BoxGeometry(0.075, h, 0.022), M.white), x, h / 2 + 0.06, 0, pivot);
        const cap = add(new THREE.Mesh(new THREE.ConeGeometry(0.053, 0.08, 4), M.white), x, h + 0.1, 0, pivot);
        cap.rotation.y = Math.PI / 4;
        cap.scale.z = 0.4;
      }
      group.add(pivot);
      gateLeaves.push({ pivot, sign });
    }
    // close up the rest of the gap in the hedge either side of the gate
    for (const s of [-1, 1]) add(new THREE.Mesh(boxM(1.05, 1.2, 0.9), nature.mats.hedge), C.x + s * 2.0, GROUND + 0.6, gateZ);
    // a path from the arbor, out through the gate to the dunes
    const z0 = arborZ - 3.0;
    const z1 = C.z - DUNES;
    flat(add(new THREE.Mesh(meterPlane(PATH * 1.6, z0 - z1), M.paving), 0, GROUND + 0.012, (z0 + z1) / 2));
  }
  function setGate(p) {
    const a = p * 1.55;
    for (const { pivot, sign } of gateLeaves) pivot.rotation.y = sign < 0 ? a : -a;
  }

  // ── the photo arbor at the far end ──
  const arbor = new THREE.Group();
  arbor.position.set(0, GROUND, arborZ);
  group.add(arbor);
  const AW = 2.8;
  const AH = 3.3;
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.22, AH, 0.22), M.white), s * AW, AH / 2, 0, arbor);
  add(new THREE.Mesh(new THREE.TorusGeometry(AW, 0.11, 10, 56, Math.PI), M.white), 0, AH, 0, arbor);
  along(arbor, 260, AW, AH, (v) => {
    shrub(v.x, v.y - 0.25, v.z, 0.9 + rnd() * 0.6, true, 3);
    if (rnd() < 0.8) rose(v.x, v.y + 0.05, v.z + 0.1, 1.3 + rnd() * 0.5, ['#f2a7b8', '#fff3ea', '#f7d6de', '#c2185b'][(rnd() * 4) | 0]);
  });
  along(arbor, 320, AW, AH, (v) => archLights.push(v.x, v.y + 0.1, v.z + 0.12));
  group.add(nature.fairy(archLights, nightGlow));
  // easel + your photo
  const photo = config.garden?.photo;
  if (photo) {
    const frame = interior.makeFrame(photo, 3.4, 2.0, 'gold');
    const fh = frame.children[0].children[0].geometry.parameters.height;
    frame.position.set(0, 0.95 + fh / 2 + 0.06, 0.25);
    frame.rotation.x = -0.06;
    arbor.add(frame);
    // easel: legs stand behind the frame, a shelf holds it in front
    for (const [x, z, rz, rx] of [[-0.75, 0.12, -0.1, 0.06], [0.75, 0.12, 0.1, 0.06], [0, -0.4, 0, -0.25]]) {
      const leg = add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.0, 0.06), M.wood), x, 1.45, z, arbor);
      leg.rotation.set(rx, 0, rz);
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.07, 0.24), M.wood), 0, 0.95, 0.33, arbor);
  }
  // a little sign with your names, hanging in the arch above the photo
  const board = add(new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.72, 0.06), M.white), 0, AH + 1.15, 0.05, arbor);
  const signTex = TX.signTexture({ eyebrow: config.since || '', title: config.couple, ink: '#3a2e29', accent: '#9a7748' });
  add(new THREE.Mesh(new THREE.PlaneGeometry(3.3, (3.3 * 340) / 2048), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, depthWrite: false })), 0, 0, 0.035, board);
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.0, 4), M.white), s * 1.4, AH + 1.95, 0.05, arbor);

  // planters on the terrace
  for (const s of [-1, 1]) {
    add(new THREE.Mesh(boxM(0.9, 0.7, 0.9), M.trim), s * 5.2, 0.35, zBack - 3.6);
    for (let k = 0; k < 7; k++) shrub(s * 5.2 + (rnd() - 0.5) * 0.5, 0.62, zBack - 3.6 + (rnd() - 0.5) * 0.5, 0.8 + rnd() * 0.3);
    for (let k = 0; k < 14; k++) rose(s * 5.2 + (rnd() - 0.5) * 0.7, 0.95 + rnd() * 0.35, zBack - 3.6 + (rnd() - 0.5) * 0.7, 1.2, '#f2a7b8');
  }
  P.build();

  // ── hedge ring (with gaps for the paths) ──
  {
    const seg = 2.1;
    const n = Math.floor((2 * Math.PI * RING) / seg);
    const list = [];
    for (let k = 0; k < n; k++) {
      const a = (k + 0.5) * ((2 * Math.PI) / n);
      const lx = Math.sin(a) * RING;
      const lz = Math.cos(a) * RING;
      if (Math.abs(lx) < PATH + 1 || Math.abs(lz) < PATH + 1) continue;
      list.push(a);
    }
    const dummy = new THREE.Object3D();
    const hedge = new THREE.InstancedMesh(boxM(seg + 0.05, 1.2, 0.9), nature.mats.hedge, list.length);
    list.forEach((a, i) => {
      dummy.position.set(C.x + Math.sin(a) * RING, GROUND + 0.6, C.z + Math.cos(a) * RING);
      dummy.rotation.set(0, a, 0);
      dummy.updateMatrix();
      hedge.setMatrixAt(i, dummy.matrix);
    });
    hedge.computeBoundingSphere();
    group.add(hedge);
  }

  // ── trees, grown procedurally with real bark & leaf textures ──
  {
    const cherry = [
      // (their fairy lights only come on after sunset)
      nature.tree('Oak Medium', { seed: 101, height: 6.4, leafMap: nature.tex.blossom, leafTint: 0xffffff, barkTint: 0x9a8a84, leafSize: 1.15, lite: true, lights: 1100, lightsOpacity: nightGlow }),
      nature.tree('Ash Medium', { seed: 202, height: 7.0, leafMap: nature.tex.blossom, leafTint: 0xffffff, barkTint: 0x9a8a84, leafSize: 1.15, lite: true, lights: 1100, lightsOpacity: nightGlow }),
    ];
    [0.75, 1.3, 1.9, 2.5, 2.95, 3.35, 3.8, 4.4, 5.0, 5.55].forEach((a, i) => {
      const rr = 23 + rnd() * 3;
      const t = cherry[i % 2]();
      t.position.set(C.x + Math.sin(a) * rr, GROUND, C.z + Math.cos(a) * rr);
      group.add(t);
    });
    // big green oaks & ashes framing the garden
    const big = [
      nature.tree('Oak Large', { seed: 7, height: 15, lite: true, leafCount: 0.75, leafSize: 1.2 }),
      nature.tree('Ash Large', { seed: 9, height: 14, lite: true, leafCount: 0.75, leafSize: 1.2 }),
      nature.tree('Oak Medium', { seed: 13, height: 12, lite: true, leafCount: 0.75, leafSize: 1.2 }),
    ];
    for (let k = 0; k < 13; k++) {
      const a = 0.6 + (k / 13) * (Math.PI * 2 - 1.2) + (rnd() - 0.5) * 0.15;
      const rr = 36 + rnd() * 14;
      if (seaside && Math.cos(a) * rr < -DUNES + 4) continue; // that's the beach now
      const t = big[k % big.length]();
      t.position.set(C.x + Math.sin(a) * rr, GROUND, C.z + Math.cos(a) * rr);
      group.add(t);
    }
  }

  // ── fountain (see fountain.js) ──
  const fountain = buildFountain({ center: C, ground: GROUND, time, sky, lightDir });
  group.add(fountain.group);

  // ── drifting petals ──
  const PN = 700;
  const pPos = new Float32Array(PN * 3);
  const pSeed = new Float32Array(PN);
  for (let i = 0; i < PN; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 26;
    pPos.set([C.x + Math.sin(a) * r, rnd() * 9, C.z + Math.cos(a) * r], i * 3);
    pSeed[i] = rnd();
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  petalGeo.setAttribute('aSeed', new THREE.BufferAttribute(pSeed, 1));
  const petalMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uScale: { value: 800 }, uNight: nightGlow },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uScale;
      attribute float aSeed;
      varying float vSeed;
      void main() {
        vec3 p = position;
        float t = uTime * (0.35 + aSeed * 0.3);
        p.y = ${GROUND.toFixed(2)} + mod(position.y - t, 9.0);
        p.x += sin(t * 1.3 + aSeed * 30.0) * 0.8;
        p.z += cos(t * 0.9 + aSeed * 17.0) * 0.8;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.07 + aSeed * 0.05) * uScale / -mv.z;
        vSeed = aSeed;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying float vSeed;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        c.x *= 1.8;
        float a = smoothstep(0.5, 0.3, length(c));
        vec3 col = mix(vec3(1.0, 0.72, 0.8), vec3(1.0, 0.9, 0.93), vSeed) * mix(1.0, 0.25, uNight);
        gl_FragColor = vec4(col, a * 0.9 * mix(1.0, 0.4, uNight));
      }`,
    transparent: true,
    depthWrite: false,
  });
  group.add(new THREE.Points(petalGeo, petalMat));

  // ── fireflies: little green-gold lights that drift and blink after dark ──
  const FN = 420;
  const fPos = new Float32Array(FN * 3);
  const fSeed = new Float32Array(FN);
  for (let i = 0; i < FN; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 3 + Math.sqrt(rnd()) * 22;
    fPos.set([C.x + Math.sin(a) * r, GROUND + 0.25 + rnd() * 2.2, C.z + Math.cos(a) * r], i * 3);
    fSeed[i] = rnd();
  }
  const fireflyGeo = new THREE.BufferGeometry();
  fireflyGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  fireflyGeo.setAttribute('aSeed', new THREE.BufferAttribute(fSeed, 1));
  const fireflyMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uScale: { value: 800 }, uNight: nightGlow },
    vertexShader: /* glsl */ `
      uniform float uTime; uniform float uScale;
      attribute float aSeed;
      varying float vGlow;
      void main() {
        vec3 p = position;
        float t = uTime * (0.25 + aSeed * 0.25);
        p.x += sin(t * 1.1 + aSeed * 50.0) * 1.2 + sin(t * 2.7 + aSeed * 9.0) * 0.25;
        p.y += sin(t * 0.9 + aSeed * 21.0) * 0.45;
        p.z += cos(t * 0.8 + aSeed * 33.0) * 1.2 + cos(t * 2.3 + aSeed * 5.0) * 0.25;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(2.5, 0.17 * uScale / -mv.z);
        // each one pulses on its own rhythm: a slow glow, then dark for a while
        float blink = pow(max(0.0, sin(uTime * (0.9 + aSeed * 0.9) + aSeed * 60.0)), 6.0);
        vGlow = 0.06 + blink;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uNight;
      varying float vGlow;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float core = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.8, 1.0, 0.32) * 4.0 * vGlow, core * uNight);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  group.add(new THREE.Points(fireflyGeo, fireflyMat));

  // two soft garden lamps for the night, so the arch & your photo stay lit
  // (lamps the shared lights take on, like the porch lamps: see main.js)
  const lamp = (color) => Object.assign(new THREE.Object3D(), { color: new THREE.Color(color), intensity: 0 });
  const nightLamps = [
    [lamp('#ffd6a0'), 0, GROUND + 3.4, arborZ + 2.4, 7],
    [lamp('#ffcf94'), C.x, GROUND + 4.6, C.z, 3],
  ].map(([l, x, y, z, base]) => {
    add(l, x, y, z);
    l.userData.base = base;
    return l;
  });
  const woodsDay = nature.mats.treeline.color.clone();
  const woodsNight = new THREE.Color('#141a2c');

  function setDoor(p) {
    const a = p * 1.7;
    leaves[0].rotation.y = a;
    leaves[1].rotation.y = -a;
  }

  // ── butterflies ──
  const butterflies = createButterflies({ center: C, heroSpot, viewFrom: heroView });
  group.add(butterflies.group);

  function update(t, viewportHeight, night = 0) {
    time.value = t;
    petalMat.uniforms.uScale.value = viewportHeight;
    fireflyMat.uniforms.uScale.value = viewportHeight;
    nightGlow.value = night;
    for (const l of nightLamps) l.intensity = l.userData.base * night;
    nature.mats.treeline.color.lerpColors(woodsDay, woodsNight, night);
    fountain.update(viewportHeight, night);
    butterflies.update(t, night);
  }

  return {
    group,
    center: C,
    zBack,
    arborZ,
    heroSpot,
    heroView,
    hero: butterflies.hero,
    heroTarget: butterflies.heroTarget,
    heroResting: butterflies.heroResting,
    releaseButterfly: butterflies.release,
    resetButterfly: butterflies.reset,
    gateZ,
    lamps: nightLamps,
    setDoor,
    setGate,
    update,
  };
}
