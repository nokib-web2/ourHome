import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeCanvas, rng, toTexture } from './textures.js';

// Butterflies for the garden. Each one is a tiny rig: a body and two wings
// hinged at the body, painted per species (with a different underside), that
// flap as it flutters along a looping path. One "hero" butterfly rests on a
// rose for the close-up in the scroll tour and takes off as you walk on.

// ── wing painting ───────────────────────────────────────────────────────────

// One right-hand wing pair per canvas: the body/hinge is the left edge,
// the head is at the top. Coordinates are 0–1.
function forewing(ctx, S) {
  ctx.moveTo(0, 0.47 * S);
  ctx.bezierCurveTo(0.05 * S, 0.25 * S, 0.25 * S, 0.06 * S, 0.55 * S, 0.04 * S);
  ctx.bezierCurveTo(0.8 * S, 0.02 * S, 0.97 * S, 0.08 * S, 0.98 * S, 0.16 * S);
  ctx.bezierCurveTo(0.97 * S, 0.3 * S, 0.85 * S, 0.42 * S, 0.72 * S, 0.5 * S);
  ctx.bezierCurveTo(0.5 * S, 0.53 * S, 0.2 * S, 0.53 * S, 0, 0.53 * S);
  ctx.closePath();
}
function hindwing(ctx, S, tail) {
  ctx.moveTo(0, 0.5 * S);
  ctx.bezierCurveTo(0.25 * S, 0.47 * S, 0.6 * S, 0.5 * S, 0.72 * S, 0.58 * S);
  ctx.bezierCurveTo(0.8 * S, 0.66 * S, 0.76 * S, 0.82 * S, 0.62 * S, 0.9 * S);
  if (tail) {
    ctx.lineTo(0.6 * S, 0.99 * S);
    ctx.lineTo(0.53 * S, 0.99 * S);
    ctx.lineTo(0.5 * S, 0.93 * S);
  }
  ctx.bezierCurveTo(0.4 * S, 0.99 * S, 0.2 * S, 0.93 * S, 0.06 * S, 0.76 * S);
  ctx.bezierCurveTo(0, 0.66 * S, 0, 0.58 * S, 0, 0.5 * S);
  ctx.closePath();
}

const SPECIES = {
  monarch: {
    tail: false,
    top: { hinge: '#f7a23c', edge: '#dc6a18', border: '#15100d', veins: '#15100d', veinW: 0.012, borderW: 0.085, dots: '#fff7e8', apex: true },
    under: { hinge: '#f2b766', edge: '#e1a254', border: '#1d1612', veins: '#1d1612', veinW: 0.012, borderW: 0.08, dots: '#fff7e8', apex: true },
  },
  morpho: {
    tail: false,
    top: { hinge: '#7fd6ff', edge: '#0d56d8', border: '#0b0d18', veins: 'rgba(6,30,90,0.5)', veinW: 0.005, borderW: 0.16, dots: '#e9f4ff', apex: false },
    under: { hinge: '#8a6a4a', edge: '#5d4430', border: '#3a2a1e', veins: 'rgba(40,25,15,0.6)', veinW: 0.004, borderW: 0.05, dots: '#f2e3c4', apex: false, eyes: true },
  },
  swallowtail: {
    tail: true,
    top: { hinge: '#f9e27d', edge: '#f0cf52', border: '#17120e', veins: '#17120e', veinW: 0.006, borderW: 0.12, dots: '#f9e27d', apex: false, stripes: true, blue: true },
    under: { hinge: '#f6e9a8', edge: '#efdc8a', border: '#3b3024', veins: '#3b3024', veinW: 0.005, borderW: 0.08, dots: '#f6e9a8', apex: false, stripes: true },
  },
  white: {
    tail: false,
    top: { hinge: '#e9e8df', edge: '#fbfaf4', border: 'rgba(0,0,0,0)', veins: 'rgba(90,90,80,0.25)', veinW: 0.003, borderW: 0, dots: null, apex: false, tip: true },
    under: { hinge: '#e6ebc9', edge: '#f4f6e1', border: 'rgba(0,0,0,0)', veins: 'rgba(90,100,60,0.25)', veinW: 0.003, borderW: 0, dots: null, apex: false },
  },
  admiral: {
    tail: false,
    top: { hinge: '#2a1d18', edge: '#1b1411', border: '#e4502c', veins: 'rgba(0,0,0,0.4)', veinW: 0.004, borderW: 0.0, dots: '#ffffff', apex: false, band: true },
    under: { hinge: '#5a4539', edge: '#3e2f28', border: '#8a6a55', veins: 'rgba(0,0,0,0.35)', veinW: 0.004, borderW: 0.03, dots: '#dcd2c6', apex: false, eyes: true },
  },
};

function paintWing(species, side) {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const r = rng(side === 'top' ? 3 : 7);
  const sp = SPECIES[species];
  const p = sp[side];
  const both = () => {
    ctx.beginPath();
    forewing(ctx, S);
    hindwing(ctx, S, sp.tail);
  };
  ctx.save();
  both();
  ctx.clip();
  // base colour: brighter by the body, deeper toward the edges
  const g = ctx.createRadialGradient(0, S * 0.5, S * 0.05, 0, S * 0.5, S * 0.95);
  g.addColorStop(0, p.hinge);
  g.addColorStop(1, p.edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  if (p.band) {
    // red admiral: an orange-red band across the forewing and along the hindwing edge
    ctx.strokeStyle = '#e4502c';
    ctx.lineWidth = S * 0.09;
    ctx.beginPath();
    ctx.moveTo(S * 0.4, S * 0.08);
    ctx.quadraticCurveTo(S * 0.52, S * 0.3, S * 0.5, S * 0.5);
    ctx.stroke();
    ctx.lineWidth = S * 0.07;
    ctx.beginPath();
    hindwing(ctx, S, false);
    ctx.stroke();
  }
  if (p.stripes) {
    // swallowtail: bold black bars from the leading edge
    ctx.fillStyle = side === 'top' ? '#17120e' : 'rgba(40,30,20,0.8)';
    for (const [x, w] of [[0.12, 0.07], [0.3, 0.06], [0.46, 0.05], [0.6, 0.05]]) {
      ctx.beginPath();
      ctx.moveTo(S * x, 0);
      ctx.lineTo(S * (x + w), 0);
      ctx.lineTo(S * (x + w * 0.4 - 0.06), S * 0.5);
      ctx.lineTo(S * (x - 0.1), S * 0.5);
      ctx.fill();
    }
  }
  // veins radiating from the body
  ctx.strokeStyle = p.veins;
  ctx.lineWidth = S * p.veinW;
  for (let k = 0; k < 14; k++) {
    const a = -1.2 + (k / 13) * 2.3;
    ctx.beginPath();
    ctx.moveTo(0, S * 0.5);
    ctx.quadraticCurveTo(S * 0.35 * Math.cos(a * 0.8), S * (0.5 + 0.35 * Math.sin(a * 0.8)), S * Math.cos(a) * 1.1, S * (0.5 + Math.sin(a) * 0.9));
    ctx.stroke();
  }
  // dark margins
  if (p.borderW > 0) {
    ctx.strokeStyle = p.border;
    ctx.lineWidth = S * p.borderW * 2;
    both();
    ctx.stroke();
  }
  if (p.apex) {
    ctx.fillStyle = p.border;
    ctx.beginPath();
    ctx.ellipse(S * 0.86, S * 0.14, S * 0.16, S * 0.12, -0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.tip) {
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.ellipse(S * 0.9, S * 0.1, S * 0.14, S * 0.1, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(S * 0.55, S * 0.3, S * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.blue) {
    // swallowtail: blue crescents and an orange eyespot on the hindwing
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = '#5b8fe0';
      ctx.beginPath();
      ctx.arc(S * (0.2 + k * 0.1), S * (0.86 - Math.abs(k - 2) * 0.02), S * 0.02, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#f08a2c';
    ctx.beginPath();
    ctx.arc(S * 0.12, S * 0.8, S * 0.035, 0, Math.PI * 2);
    ctx.fill();
  }
  if (p.eyes) {
    // eyespots on the underside
    for (const [x, y, rad] of [[0.55, 0.28, 0.07], [0.45, 0.72, 0.08], [0.25, 0.8, 0.05]]) {
      const e = ctx.createRadialGradient(S * x, S * y, 0, S * x, S * y, S * rad);
      e.addColorStop(0, '#f6efe0');
      e.addColorStop(0.25, '#1a120d');
      e.addColorStop(0.55, '#c98a3a');
      e.addColorStop(0.8, '#3a2618');
      e.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = e;
      ctx.fillRect(0, 0, S, S);
    }
  }
  if (p.dots) {
    // small pale spots set into the dark margin
    ctx.fillStyle = p.dots;
    const spots = (path, n) => {
      for (let k = 0; k < n; k++) {
        const [x, y] = path(k / (n - 1));
        ctx.beginPath();
        ctx.arc(x * S, y * S, S * (0.009 + r() * 0.006), 0, Math.PI * 2);
        ctx.fill();
      }
    };
    spots((t) => [0.93 - t * 0.2, 0.2 + t * 0.28], 7);
    spots((t) => [0.7 - t * 0.12, 0.62 + t * 0.26], 6);
    if (species === 'admiral' && side === 'top') spots((t) => [0.78 + t * 0.12, 0.08 + t * 0.12], 4);
  }
  // fine scale texture + a furry base near the body
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 18;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const fur = ctx.createLinearGradient(0, 0, S * 0.14, 0);
  fur.addColorStop(0, 'rgba(30,22,18,0.85)');
  fur.addColorStop(1, 'rgba(30,22,18,0)');
  ctx.fillStyle = fur;
  ctx.fillRect(0, 0, S * 0.14, S);
  ctx.restore();
  return toTexture(c);
}

// ── rig ───────────────────────────────────────────────────────────────────────

function wingGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, 2, 1);
  g.translate(0.5, 0, 0); // hinge on x = 0
  g.rotateX(-Math.PI / 2); // lie flat, upper side facing up, head toward -z
  // a slight droop toward the tips
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, -0.06 * pos.getX(i) ** 2);
  g.computeVertexNormals();
  return g;
}

function bodyGeometry() {
  const abdomen = new THREE.CapsuleGeometry(0.055, 0.5, 4, 8);
  abdomen.rotateX(Math.PI / 2);
  abdomen.translate(0, -0.02, 0.18);
  const thorax = new THREE.SphereGeometry(0.085, 10, 8);
  thorax.scale(1, 0.9, 1.3);
  thorax.translate(0, 0, -0.1);
  const head = new THREE.SphereGeometry(0.06, 8, 6);
  head.translate(0, 0.01, -0.27);
  const parts = [abdomen, thorax, head];
  for (const s of [-1, 1]) {
    const antenna = new THREE.CylinderGeometry(0.006, 0.006, 0.42, 4);
    antenna.translate(0, 0.21, 0);
    antenna.rotateX(-1.05);
    antenna.rotateZ(s * 0.28);
    antenna.translate(s * 0.02, 0.03, -0.3);
    const club = new THREE.SphereGeometry(0.018, 6, 4);
    club.translate(0, 0.42, 0);
    club.rotateX(-1.05);
    club.rotateZ(s * 0.28);
    club.translate(s * 0.02, 0.03, -0.3);
    parts.push(antenna, club);
  }
  return mergeGeometries(
    parts.map((g) => {
      const n = g.index ? g.toNonIndexed() : g;
      for (const k of Object.keys(n.attributes)) if (k !== 'position') n.deleteAttribute(k);
      n.computeVertexNormals();
      return n;
    }),
  );
}

function wingMaterial(top, under) {
  const m = new THREE.MeshLambertMaterial({ map: top, alphaTest: 0.5, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.08, emissiveMap: top });
  // the underside of a wing shows its own pattern
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uUnder = { value: under };
    shader.fragmentShader = `uniform sampler2D uUnder;\n${shader.fragmentShader}`.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        vec4 sampledDiffuseColor = gl_FrontFacing ? texture2D( map, vMapUv ) : texture2D( uUnder, vMapUv );
        diffuseColor *= sampledDiffuseColor;
      #endif`,
    );
  };
  m.customProgramCacheKey = () => 'butterfly-wing';
  return m;
}

export function createButterflies({ center, heroSpot, viewFrom, radius = 17 }) {
  const group = new THREE.Group();
  const r = rng(808);
  const wingGeo = wingGeometry();
  const bodyGeo = bodyGeometry();
  const bodyMat = new THREE.MeshLambertMaterial({ color: '#1b1512' });
  const mats = {};
  for (const name of Object.keys(SPECIES)) mats[name] = wingMaterial(paintWing(name, 'top'), paintWing(name, 'under'));

  function rig(species, span) {
    const b = new THREE.Group();
    b.scale.setScalar(span / 2);
    b.add(new THREE.Mesh(bodyGeo, bodyMat));
    const wings = [1, -1].map((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.03, 0.02, -0.02);
      const w = new THREE.Mesh(wingGeo, mats[species]);
      w.scale.x = side; // the left wing is the right one mirrored
      pivot.add(w);
      b.add(pivot);
      return pivot;
    });
    group.add(b);
    return { b, wings };
  }

  // ── fliers ──
  const names = Object.keys(SPECIES);
  const fliers = [];
  const spawn = (hx, hy, hz, reach, species, big = false) => {
    const span = big ? 0.2 + r() * 0.06 : 0.15 + r() * 0.07;
    fliers.push({
      ...rig(species || names[(r() * names.length) | 0], span),
      home: new THREE.Vector3(hx, hy, hz),
      reach,
      f: [0.18 + r() * 0.25, 0.45 + r() * 0.5, 0.3 + r() * 0.4, 0.2 + r() * 0.3],
      ph: Array.from({ length: 5 }, () => r() * 6.28),
      flap: 15 + r() * 7,
      height: 0.25 + r() * 0.35,
    });
  };
  const C = center;
  // a ring of them at eye level just inside the walk round the fountain,
  // so a few are always fluttering across the view
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + r() * 0.3;
    const d = 9.5 + r() * 2;
    spawn(C.x + Math.sin(a) * d, C.y + 1.7 + r() * 0.6, C.z + Math.cos(a) * d, 1.2 + r() * 1.0, names[k % names.length], true);
  }
  // lower down, over the flower beds
  for (let k = 0; k < 8; k++) {
    const a = r() * Math.PI * 2;
    const d = 6 + r() * 8;
    spawn(C.x + Math.sin(a) * d, C.y + 0.8 + r() * 0.8, C.z + Math.cos(a) * d, 1.5 + r() * 2.5);
  }
  // greeting you on the terrace steps and near the close-up rose
  spawn(C.x + 1.5, C.y + 2.2, C.z + 20.5, 1.6, 'monarch', true);
  spawn(C.x - 1.8, C.y + 2.0, C.z + 19.5, 1.4, 'swallowtail', true);
  spawn(C.x + 0.4, C.y + 1.6, C.z + 18.5, 1.2, 'morpho', true);
  spawn(heroSpot.x - 0.5, heroSpot.y + 0.55, heroSpot.z - 0.9, 0.9, 'white');
  // around the flower arch at the end, a couple close to where you stop
  for (let k = 0; k < 4; k++) spawn(C.x + (r() - 0.5) * 5, C.y + 1.4 + r() * 1.4, C.z - 14 + (r() - 0.5) * 3, 1.4 + r(), names[k]);
  spawn(C.x - 1.4, C.y + 2.1, C.z - 10.5, 1.3, 'monarch', true);
  spawn(C.x + 1.2, C.y + 1.8, C.z - 9.5, 1.2, 'swallowtail', true);
  // a few wandering further out
  for (let k = 0; k < 5; k++) {
    const a = r() * Math.PI * 2;
    spawn(C.x + Math.sin(a) * radius, C.y + 1 + r(), C.z + Math.cos(a) * radius, 3 + r() * 3);
  }

  // ── the hero, resting on a rose for the close-up ──
  const hero = rig('morpho', 0.17);
  // face across the camera's line of sight and tilt toward it, so the wings show
  const heroYaw = heroSpot.yaw ?? 0;
  const heroFrom = heroSpot.clone();
  // a generous invisible target so it's easy to click / tap
  const heroTarget = new THREE.Mesh(new THREE.SphereGeometry(1.5, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hero.b.add(heroTarget);
  // When clicked it hops off the rose, flutters slowly up across the close-up
  // frame (so you can watch it go), then heads off over the garden and keeps
  // wandering. The first part is laid out in the camera's screen directions.
  const toHero = heroSpot.clone().sub(viewFrom).normalize();
  const screenRight = new THREE.Vector3().crossVectors(toHero, new THREE.Vector3(0, 1, 0)).normalize();
  const screenUp = new THREE.Vector3().crossVectors(screenRight, toHero).normalize();
  const away = new THREE.Vector3(-2.4, 2.0, -3.8);
  const smooth = (a, b, x) => {
    const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return k * k * (3 - 2 * k);
  };
  let flight = null;
  const heroPath = (s, out) => {
    const hop = smooth(0, 0.5, s);
    const across = smooth(0.5, 3.0, s); // up and to the left, out of the top corner
    const off = smooth(2.8, 6.0, s);
    const flutter = Math.min(1, s * 2);
    out.copy(heroFrom)
      .addScaledVector(screenUp, 0.05 * hop + 0.34 * across + Math.sin(s * 9) * 0.018 * flutter)
      .addScaledVector(screenRight, -0.5 * across + Math.sin(s * 4.7) * 0.035 * flutter)
      .addScaledVector(away, off);
    if (s > 6) {
      const w = s - 6;
      out.x += Math.sin(w * 0.5) * 2.2;
      out.y += Math.sin(w * 0.7) * 0.4;
      out.z += (Math.cos(w * 0.4) - 1) * 2.2;
    }
    return out;
  };
  const angleTo = (a, b, t) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;

  const tmp = new THREE.Vector3();
  const next = new THREE.Vector3();
  const pathAt = (b, t, out) => {
    const [f1, f2, f3, f4] = b.f;
    const [p1, p2, p3, p4, p5] = b.ph;
    return out.set(
      b.home.x + Math.sin(t * f1 + p1) * b.reach + Math.sin(t * f2 + p2) * b.reach * 0.3,
      b.home.y + Math.sin(t * f3 + p3) * b.height + Math.sin(t * f4 * 3 + p5) * 0.1,
      b.home.z + Math.cos(t * f1 * 0.9 + p4) * b.reach + Math.cos(t * f2 * 1.2 + p2) * b.reach * 0.3,
    );
  };

  function update(t, night = 0) {
    // butterflies settle down for the night (the fireflies take over)
    const flying = night < 0.55;
    for (const b of fliers) {
      b.b.visible = flying;
      if (!flying) continue;
      pathAt(b, t, tmp);
      pathAt(b, t + 0.08, next);
      const flap = Math.sin(t * b.flap + b.ph[0]);
      b.b.position.copy(tmp);
      b.b.position.y += flap * 0.012;
      const vx = next.x - tmp.x;
      const vz = next.z - tmp.z;
      const vy = next.y - tmp.y;
      b.b.rotation.set(Math.atan2(vy, Math.hypot(vx, vz)) * 0.6, Math.atan2(-vx, -vz), 0, 'YXZ');
      const a = 0.15 + 0.95 * (0.5 + 0.5 * flap);
      b.wings[0].rotation.z = a;
      b.wings[1].rotation.z = -a;
    }

    // hero: basks on the rose with slow wingbeats until someone clicks it
    const rest = 0.12 + 1.15 * Math.pow(0.5 - 0.5 * Math.cos(t * 1.1), 4);
    if (!flight) {
      hero.b.position.copy(heroFrom);
      hero.b.rotation.set(0, heroYaw, -0.3, 'YXZ');
      hero.wings[0].rotation.z = rest;
      hero.wings[1].rotation.z = -rest;
      return;
    }
    const s = Math.max(0, t - flight.start);
    heroPath(s, tmp);
    heroPath(s + 0.06, next);
    hero.b.position.copy(tmp);
    const vx = next.x - tmp.x;
    const vz = next.z - tmp.z;
    const turn = Math.min(1, s * 1.5); // swing from its resting pose into the direction of flight
    const heading = Math.hypot(vx, vz) > 1e-4 ? Math.atan2(-vx, -vz) : heroYaw;
    hero.b.rotation.set(
      Math.atan2(next.y - tmp.y, Math.hypot(vx, vz) + 1e-4) * 0.35 * turn,
      angleTo(heroYaw, heading, turn),
      -0.3 * (1 - Math.min(1, s * 2.5)),
      'YXZ',
    );
    const fly = 0.15 + 0.95 * (0.5 + 0.5 * Math.sin(t * 20));
    const a = rest + (fly - rest) * Math.min(1, s * 5);
    hero.wings[0].rotation.z = a;
    hero.wings[1].rotation.z = -a;
  }

  return {
    group,
    update,
    hero: hero.b,
    heroTarget,
    heroResting: () => !flight,
    release: (t) => {
      if (!flight) flight = { start: t };
    },
    reset: () => {
      flight = null;
    },
  };
}
