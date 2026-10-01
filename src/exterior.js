import * as THREE from 'three';
import * as TX from './textures.js';
import { boxM, meterPlane, archPath, archTrimShape, ringShape, halfDiscShape } from './geo.js';

// The gallery house: a neoclassical facade at blue hour, a columned portico,
// glowing windows, lamp-lit path and a pair of doors that swing open on scroll.
export const DOOR = { W: 4.4, RECT: 4.6 };
const GROUND = -0.9;

const EXT = (depth) => ({
  depth,
  bevelEnabled: true,
  bevelThickness: 0.02,
  bevelSize: 0.02,
  bevelSegments: 2,
  curveSegments: 40,
});

export function buildExterior(config, { length = 92, nature = null, groundTo = -300 } = {}) {
  const group = new THREE.Group();
  const tex = {
    stone: TX.stoneTexture(),
    plaster: TX.plasterTexture(),
    paving: TX.pavingTexture(),
    grass: TX.grassTexture(),
    hedge: TX.hedgeTexture(),
    glow: TX.glowTexture(),
    window: TX.windowTexture(),
    round: TX.roundWindowTexture(),
    fan: TX.fanlightTexture(),
    flute: TX.fluteTexture(),
    monogram: TX.monogramTexture(config.initials || ''),
    inscription: TX.inscriptionTexture(config.facadeText || ''),
  };
  tex.fan.repeat.set(1 / DOOR.W, 2 / DOOR.W);
  tex.fan.offset.set(0.5, 0);

  const M = {
    stone: new THREE.MeshStandardMaterial({ map: tex.stone, roughness: 0.9 }),
    trim: new THREE.MeshStandardMaterial({ color: '#f5ecdf', map: tex.plaster, roughness: 0.85 }),
    column: new THREE.MeshStandardMaterial({ color: '#f5ecdf', roughness: 0.8, bumpMap: tex.flute, bumpScale: 2.5 }),
    step: new THREE.MeshStandardMaterial({ color: '#efe6d8', map: tex.paving, roughness: 0.9 }),
    door: new THREE.MeshStandardMaterial({ color: '#21403a', roughness: 0.38, metalness: 0.15 }),
    doorPanel: new THREE.MeshStandardMaterial({ color: '#1a342f', roughness: 0.45, metalness: 0.15 }),
    brass: new THREE.MeshStandardMaterial({ color: '#c9a466', roughness: 0.28, metalness: 1 }),
    iron: new THREE.MeshStandardMaterial({ color: '#17181b', roughness: 0.45, metalness: 0.7 }),
    hedge: new THREE.MeshStandardMaterial({ color: '#8fae84', map: tex.hedge, roughness: 1 }),
    grass: new THREE.MeshStandardMaterial({ color: '#9fb08f', map: tex.grass, roughness: 1 }),
    paving: new THREE.MeshStandardMaterial({ color: '#e8e0d4', map: tex.paving, roughness: 0.85 }),
    roof: new THREE.MeshStandardMaterial({ color: '#2b2c33', roughness: 0.8 }),
    glass: new THREE.MeshBasicMaterial({ map: tex.window, color: new THREE.Color(1.3, 1.2, 1.1) }),
    round: new THREE.MeshBasicMaterial({ map: tex.round, color: new THREE.Color(1.25, 1.16, 1.06) }),
    fan: new THREE.MeshBasicMaterial({ map: tex.fan, color: new THREE.Color(1.38, 1.24, 1.1) }),
    lantern: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.15, 1.65, 1.05) }),
    inscription: new THREE.MeshStandardMaterial({ map: tex.inscription, transparent: true, roughness: 0.8, depthWrite: false }),
    monogram: new THREE.MeshBasicMaterial({ map: tex.monogram, transparent: true, color: new THREE.Color(1.25, 1.1, 0.9), depthWrite: false }),
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

  // ── ground, plaza & path ──
  // (the lawn stops where the dunes begin, if there's a beach behind the garden)
  const groundEnd = Math.max(-300, groundTo);
  flat(add(new THREE.Mesh(meterPlane(600, 300 - groundEnd), M.grass), 0, GROUND, (300 + groundEnd) / 2));
  flat(add(new THREE.Mesh(meterPlane(26, 4), M.paving), 0, GROUND + 0.004, 6.4));
  flat(add(new THREE.Mesh(meterPlane(5, 46), M.paving), 0, GROUND + 0.006, 31.4));

  // ── steps ──
  add(new THREE.Mesh(boxM(18, 0.3, 4.4), M.step), 0, -0.75, 2.2);
  add(new THREE.Mesh(boxM(17, 0.3, 3.8), M.step), 0, -0.45, 1.9);
  add(new THREE.Mesh(boxM(16, 0.3, 3.2), M.step), 0, -0.15, 1.6);

  // ── facade wall with door & window openings ──
  const WIN = [-10.8, 10.8];
  const fs = new THREE.Shape();
  fs.moveTo(-15, GROUND);
  fs.lineTo(15, GROUND);
  fs.lineTo(15, 11.5);
  fs.lineTo(-15, 11.5);
  fs.lineTo(-15, GROUND);
  fs.holes.push(archPath(new THREE.Path(), 0, 0, DOOR.W, DOOR.RECT));
  for (const x of WIN) fs.holes.push(archPath(new THREE.Path(), x, 1.2, 2.4, 3.2));
  for (const x of WIN) {
    const p = new THREE.Path();
    p.absarc(x, 8.6, 0.8, 0, Math.PI * 2, false);
    fs.holes.push(p);
  }
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(fs, { depth: 1, bevelEnabled: false, curveSegments: 40 }), M.stone), 0, 0, -1);

  for (const x of WIN) {
    add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.4), M.glass), x, 3.4, -0.45);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(archTrimShape(x, 1.2, 1.2, 1.48, 3.2), EXT(0.14)), M.trim));
    add(new THREE.Mesh(boxM(3.3, 0.2, 0.4), M.trim), x, 1.1, 0.12);
    add(new THREE.Mesh(boxM(0.38, 0.55, 0.22), M.trim), x, 5.74, 0.11);
    add(new THREE.Mesh(new THREE.CircleGeometry(0.8, 40), M.round), x, 8.6, -0.45);
    add(new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape(x, 8.6, 0.8, 1.02), EXT(0.12)), M.trim));
  }

  add(new THREE.Mesh(boxM(31, 0.6, 1.6), M.trim), 0, 11.8, -0.4); // main cornice
  add(new THREE.Mesh(boxM(30.2, 0.9, 1.1), M.stone), 0, 12.55, -0.55); // parapet
  add(new THREE.Mesh(boxM(30.6, 0.26, 1.1), M.trim), 0, 7.05, -0.45); // string course
  add(new THREE.Mesh(boxM(30.6, 0.88, 1.3), M.trim), 0, GROUND + 0.43, -0.45); // plinth

  // building body (sides & roof only, so nothing blocks the view through the door)
  const bodyLen = length;
  for (const s of [-1, 1]) {
    const side = add(new THREE.Mesh(meterPlane(bodyLen, 13.9), M.stone), s * 15, GROUND + 6.95, -bodyLen / 2);
    side.rotation.y = (s * Math.PI) / 2;
  }
  flat(add(new THREE.Mesh(meterPlane(30, bodyLen), M.roof), 0, 13.0, -bodyLen / 2));

  // ── front door ──
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(archTrimShape(0, 0, DOOR.W / 2, DOOR.W / 2 + 0.42, DOOR.RECT), EXT(0.18)), M.trim));
  add(new THREE.Mesh(boxM(0.62, 1.0, 0.34), M.trim), 0, DOOR.RECT + DOOR.W / 2 + 0.2, 0.15);
  add(new THREE.Mesh(new THREE.ShapeGeometry(halfDiscShape(DOOR.W / 2), 40), M.fan), 0, DOOR.RECT, -0.5);
  add(new THREE.Mesh(new THREE.BoxGeometry(DOOR.W, 0.16, 0.24), M.door), 0, DOOR.RECT, -0.5);

  const leaves = [-1, 1].map((sign) => {
    const pivot = new THREE.Group();
    pivot.position.set((sign * DOOR.W) / 2, 0, -0.5);
    const lw = DOOR.W / 2 - 0.01;
    const lh = DOOR.RECT - 0.08;
    add(new THREE.Mesh(new THREE.BoxGeometry(lw, lh, 0.12), M.door), (-sign * lw) / 2, lh / 2, 0, pivot);
    for (const [py, ph] of [[1.2, 1.7], [3.25, 1.9]]) {
      for (const z of [0.07, -0.07]) {
        add(new THREE.Mesh(new THREE.BoxGeometry(lw - 0.5, ph, 0.03), M.doorPanel), (-sign * lw) / 2, py, z, pivot);
      }
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.5, 0.05), M.brass), -sign * (lw - 0.16), 1.3, 0.11, pivot);
    add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.brass), -sign * (lw - 0.16), 1.0, 0.12, pivot);
    group.add(pivot);
    return pivot;
  });

  // warm light spilling onto the steps once the doors open
  const spill = flat(
    add(
      new THREE.Mesh(
        // Keep the decal on the upper tread only. The old 6 m plane floated
        // across all three step heights, so the stair edges sliced it into
        // bright bands that popped as the distant camera moved.
        new THREE.PlaneGeometry(7, 3.1),
        new THREE.MeshBasicMaterial({
          map: tex.glow,
          color: '#ffc98a',
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          // Keep the transparent light pool consistently in front of the top
          // step/floor when it is seen from the distant approach camera.
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      ),
      0,
      0.025,
      1.55,
    ),
  );

  // ── portico ──
  for (const x of [-6, -3, 3, 6]) {
    const col = new THREE.Group();
    col.position.set(x, 0, 2.2);
    group.add(col);
    add(new THREE.Mesh(boxM(1.0, 0.28, 1.0), M.trim), 0, 0.14, 0, col);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.47, 0.18, 32), M.trim), 0, 0.37, 0, col);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.38, 8.1, 40), M.column), 0, 4.51, 0, col);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.34, 0.25, 32), M.trim), 0, 8.685, 0, col);
    add(new THREE.Mesh(boxM(1.05, 0.22, 1.05), M.trim), 0, 8.92, 0, col);
  }
  add(new THREE.Mesh(boxM(14.8, 1.4, 3.4), M.trim), 0, 9.7, 1.5); // entablature
  add(new THREE.Mesh(boxM(15.6, 0.32, 3.8), M.trim), 0, 10.56, 1.5); // cornice
  add(new THREE.Mesh(new THREE.PlaneGeometry(12.4, 0.87), M.inscription), 0, 9.7, 3.205);

  const tri = new THREE.Shape();
  tri.moveTo(-7.6, 0);
  tri.lineTo(7.6, 0);
  tri.lineTo(0, 2.6);
  tri.lineTo(-7.6, 0);
  add(new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 3.4, bevelEnabled: false }), M.stone), 0, 10.72, -0.2);
  const ang = Math.atan2(2.6, 7.6);
  const rakeLen = Math.hypot(7.6, 2.6) + 0.5;
  for (const s of [-1, 1]) {
    const rc = add(new THREE.Mesh(boxM(rakeLen, 0.3, 3.8), M.trim), s * 3.8, 10.72 + 1.3 + 0.12, 1.5);
    rc.rotation.z = -s * ang;
  }
  add(new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), M.monogram), 0, 11.55, 3.215);

  // ── colourful lamps ──
  // Every lamp along the way in glows its own colour (with a matching pool of
  // light on the ground) and gently "breathes". The pendant over the door
  // stays warm gold so the entrance still feels like home.
  const LAMP_COLORS = ['#ff4f9a', '#3fd8ff', '#ffb23d', '#a86bff', '#5cf2a0', '#ff6a4d', '#ff5ce6', '#ffe45c'];
  const glowing = [];
  const glow = (hex, strength) => {
    const base = new THREE.Color(hex);
    const mat = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(strength) });
    glowing.push({ mat, base, strength, phase: glowing.length * 1.7 });
    return mat;
  };
  // a soft coloured halo around each lamp so the colours read from far away
  const halos = [];
  const haloAt = (hex, x, y, z, size) => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex.glow, color: hex, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    s.scale.setScalar(size);
    add(s, x, y, z);
    halos.push({ s, size, phase: halos.length * 1.7 });
  };
  const pool = (hex) =>
    new THREE.MeshBasicMaterial({
      map: tex.glow,
      color: hex,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

  // pendant lantern under the portico
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 6), M.iron), 0, 8.55, 1.7);
  add(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.28, 4), M.iron), 0, 8.02, 1.7).rotation.y = Math.PI / 4;
  add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.4), M.lantern), 0, 7.57, 1.7);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.46), M.iron), 0, 7.24, 1.7);

  // wall lanterns between the columns: rose on one side, aqua on the other
  [['#ff5c9d', -4.5], ['#3fd8ff', 4.5]].forEach(([hex, x]) => {
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), M.iron), x, 3.85, 0.2);
    add(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.2, 4), M.iron), x, 3.82, 0.42).rotation.y = Math.PI / 4;
    add(new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.42, 0.26), glow(hex, 2.4)), x, 3.51, 0.42);
    haloAt(hex, x, 3.51, 0.6, 1.3);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 0.3), M.iron), x, 3.28, 0.42);
  });

  // ── garden ──
  let lamp = 0;
  for (const z of [9.5, 17, 24.5, 32]) {
    for (const s of [-1, 1]) {
      const x = s * 2.95;
      const hex = LAMP_COLORS[lamp++ % LAMP_COLORS.length];
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.35, 12), M.iron), x, GROUND + 0.175, z);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 3.0, 10), M.iron), x, GROUND + 1.85, z);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.06, 0.12, 12), M.iron), x, GROUND + 3.38, z);
      add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), glow(hex, 2.8)), x, GROUND + 3.58, z);
      haloAt(hex, x, GROUND + 3.58, z, 1.9);
      flat(add(new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), pool(hex)), x, GROUND + 0.012, z));
    }
  }
  for (const s of [-1, 1]) add(new THREE.Mesh(boxM(0.9, 1.0, 22.5), M.hedge), s * 4.1, GROUND + 0.5, 19.9);

  const topiary = (x, y, z, r, planter) => {
    add(new THREE.Mesh(boxM(planter, planter * 0.8, planter), M.trim), x, y + planter * 0.4, z);
    add(new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), M.hedge), x, y + planter * 0.8 + r * 0.85, z);
  };
  for (const s of [-1, 1]) {
    topiary(s * 10.4, GROUND, 5.6, 0.75, 1.1);
    topiary(s * 7.4, 0, 0.8, 0.5, 0.75);
  }

  // ── trees either side of the house: real trees, dressed in fairy lights ──
  const frontTrees = new THREE.Group();
  group.add(frontTrees);
  if (nature) {
    const lit = [
      nature.tree('Oak Medium', { seed: 31, height: 11.5, lights: 2600, glow: '#ff9f40' }),
      nature.tree('Ash Medium', { seed: 47, height: 12.5, lights: 2600, glow: '#ff9f40' }),
    ];
    const plain = [
      nature.tree('Oak Large', { seed: 7, height: 14, lite: true, leafCount: 0.75, leafSize: 1.2 }),
      nature.tree('Ash Large', { seed: 9, height: 13, lite: true, leafCount: 0.75, leafSize: 1.2 }),
    ];
    const place = (factory, x, z) => {
      const t = factory();
      t.position.set(x, GROUND, z);
      frontTrees.add(t);
    };
    // close to the house, lit up
    [[-18.5, 1], [-23.5, -6], [-20.5, 9], [18.5, 0], [23.5, -6.5], [20.5, 8.5]].forEach(([x, z], i) => place(lit[i % 2], x, z));
    // further back: a darker wood, with the odd lit tree twinkling in the distance
    const rr = TX.rng(5);
    for (let i = 0; i < 12; i++) {
      const s = i % 2 ? 1 : -1;
      const x = s * (31 + rr() * 20);
      const z = -32 + rr() * 45;
      place(i % 4 === 1 ? lit[(i >> 2) % 2] : plain[i % 2], x, z);
    }
  }

  // ── sky dome (follows the camera) ──
  const dome = new THREE.Group();
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#070b1c') },
      mid: { value: new THREE.Color('#1f2a52') },
      horizon: { value: new THREE.Color('#b9826a') },
      bottom: { value: new THREE.Color('#141520') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 top, mid, horizon, bottom;
      varying vec3 vDir;
      void main() {
        float h = vDir.y;
        vec3 c = mix(horizon, mid, smoothstep(-0.02, 0.24, h));
        c = mix(c, top, smoothstep(0.24, 0.8, h));
        c = mix(c, bottom, smoothstep(0.0, -0.25, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
  sky.renderOrder = -2;
  dome.add(sky);

  const SN = 1500;
  const sPos = new Float32Array(SN * 3);
  const sSize = new Float32Array(SN);
  const sPhase = new Float32Array(SN);
  const sr = TX.rng(77);
  for (let i = 0; i < SN; i++) {
    const theta = sr() * Math.PI * 2;
    const y = 0.06 + sr() * 0.94;
    const rad = Math.sqrt(1 - y * y);
    sPos.set([Math.cos(theta) * rad * 460, y * 460, Math.sin(theta) * rad * 460], i * 3);
    sSize[i] = 0.8 + sr() * sr() * 2.8;
    sPhase[i] = sr() * 6.28;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  starGeo.setAttribute('aSize', new THREE.BufferAttribute(sSize, 1));
  starGeo.setAttribute('aPhase', new THREE.BufferAttribute(sPhase, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPR: { value: 1 }, uFade: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aPhase;
      uniform float uTime; uniform float uPR;
      varying float vA;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uPR * 1.7;
        vA = 0.55 + 0.45 * sin(uTime * 1.3 + aPhase);
        vA *= smoothstep(0.02, 0.25, normalize(position).y);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vA * uFade;
        gl_FragColor = vec4(1.0, 0.96, 0.9, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1;
  dome.add(stars);

  const moonDir = new THREE.Vector3(-0.72, 0.2, -0.66).normalize();
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(7, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.3, 2.1), fog: false, transparent: true }),
  );
  moon.position.copy(moonDir).multiplyScalar(420);
  dome.add(moon);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex.glow,
      color: '#8d9fd8',
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  halo.scale.setScalar(110);
  halo.position.copy(moon.position);
  dome.add(halo);

  // sunrise, seen from the garden behind the house
  const SUN_DIR = new THREE.Vector3(0.28, 0.1, -0.95).normalize();
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(11, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.2, 2.2), fog: false, transparent: true, opacity: 0 }),
  );
  sun.position.copy(SUN_DIR).multiplyScalar(420);
  dome.add(sun);
  const sunGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex.glow, color: '#ffc58a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
  );
  sunGlow.scale.setScalar(260);
  sunGlow.position.copy(sun.position);
  dome.add(sunGlow);

  const palette = (top, mid, horizon, bottom) => ({
    top: new THREE.Color(top),
    mid: new THREE.Color(mid),
    horizon: new THREE.Color(horizon),
    bottom: new THREE.Color(bottom),
  });
  const SKY = {
    front: { top: skyMat.uniforms.top.value.clone(), mid: skyMat.uniforms.mid.value.clone(), horizon: skyMat.uniforms.horizon.value.clone(), bottom: skyMat.uniforms.bottom.value.clone() },
    // the garden's own day: golden morning → sunset → starry night
    day: palette('#5b7fc0', '#e5a7a6', '#ffd09a', '#c99a82'),
    sunset: palette('#2a3a78', '#b8667e', '#ff8a4a', '#5e3f3c'),
    night: palette('#04071a', '#0f1834', '#26305a', '#0b0d17'),
  };
  const SK = ['top', 'mid', 'horizon', 'bottom'];
  const gardenSky = palette('#000', '#000', '#000', '#000');
  const smooth = (a, b, x) => {
    const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  // the garden sun sinks toward the horizon; the moon climbs on the other side
  const SUN_AZ = new THREE.Vector2(0.28, -0.95).normalize();
  const MOON_AZ = new THREE.Vector2(-0.8, -0.6).normalize();
  const lightDir = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const gardenMoonDir = new THREE.Vector3();
  const dirAt = (az, elev, out) => {
    const c = Math.cos(elev);
    return out.set(az.x * c, Math.sin(elev), az.y * c);
  };
  const SUN_DAY = new THREE.Color(4, 3.2, 2.2);
  const SUN_SET = new THREE.Color(4, 1.5, 0.7);
  let gardenF = 0;
  let night = 0;
  function setGarden(f, n = 0) {
    gardenF = f;
    night = n;
    // sky colours
    for (const k of SK) {
      if (n < 0.5) gardenSky[k].lerpColors(SKY.day[k], SKY.sunset[k], smooth(0, 0.5, n));
      else gardenSky[k].lerpColors(SKY.sunset[k], SKY.night[k], smooth(0.5, 0.85, n));
      skyMat.uniforms[k].value.lerpColors(SKY.front[k], gardenSky[k], f);
    }
    // sun: sets during the first half of the evening
    const set = smooth(0, 0.55, n);
    dirAt(SUN_AZ, 0.2 - 0.34 * set, sunDir);
    sun.position.copy(sunDir).multiplyScalar(420);
    sunGlow.position.copy(sun.position);
    sun.material.color.lerpColors(SUN_DAY, SUN_SET, set);
    sunGlow.material.color.set('#ffc58a').lerp(new THREE.Color('#ff6a2a'), set);
    const sunVis = f * (1 - smooth(0.42, 0.6, n));
    sun.material.opacity = sunVis;
    sunGlow.material.opacity = 0.75 * sunVis;
    // moon: the front garden's moon, or the garden moon rising after sunset
    const rise = smooth(0.5, 1, n);
    dirAt(MOON_AZ, -0.05 + 0.4 * rise, gardenMoonDir);
    moon.position.lerpVectors(moonDir, gardenMoonDir, f).normalize().multiplyScalar(420);
    halo.position.copy(moon.position);
    const moonVis = 1 - f + f * smooth(0.55, 0.8, n);
    moon.material.opacity = moonVis;
    halo.material.opacity = 0.4 * moonVis;
    // where the main light comes from: the sun by day, the moon by night
    lightDir.copy(n < 0.6 ? sunDir : gardenMoonDir);
    if (lightDir.y < 0.08) lightDir.y = 0.08;
  }

  // ── lights ──
  // (lamps, not lights: a few real lights shared by the whole walk take them on
  // while you're near, see main.js)
  const lights = [];
  const point = (x, y, z, intensity, color = '#ffc27f') => {
    const l = new THREE.Object3D();
    l.color = new THREE.Color(color);
    l.intensity = intensity;
    add(l, x, y, z);
    l.userData.base = intensity;
    lights.push(l);
  };
  point(0, 7.5, 2.0, 11); // pendant: lights the door, columns & steps
  point(0, GROUND + 3.0, 10.5, 9, '#e8a8ff'); // the nearest pair of lamp posts (pink + aqua blend)

  function setDoor(p) {
    const a = p * 1.75;
    leaves[0].rotation.y = a;
    leaves[1].rotation.y = -a;
    spill.material.opacity = p * 0.55;
  }

  function update(time, camera, outside, pixelRatio) {
    dome.position.copy(camera.position);
    moon.lookAt(camera.position);
    starMat.uniforms.uTime.value = time;
    starMat.uniforms.uPR.value = pixelRatio;
    // stars: out over the front at night, and over the garden once night falls
    starMat.uniforms.uFade.value = Math.max(outside * (1 - gardenF), gardenF * smooth(0.55, 0.9, night));
    for (const l of lights) l.intensity = l.userData.base * outside;
    // Stable lamp output avoids a whole-building pulse after bloom. Motion in
    // the scene already supplies life; these practical lights should stay calm.
    for (const g of glowing) {
      g.mat.color.copy(g.base).multiplyScalar(g.strength * 0.78);
    }
    for (const h of halos) {
      h.s.material.opacity = 0.4 * outside;
      h.s.scale.setScalar(h.size);
    }
  }

  return { group, dome, frontTrees, lamps: lights, sky: skyMat.uniforms, setDoor, setGarden, update, SUN_DIR, lightDir, sunDir, sunMat: sun.material };
}
