import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A young man on the beach: white linen shirt with the sleeves rolled up, navy
// trousers rolled to the calf, barefoot, a driftwood stick in his hand.
//
// He's one continuous skinned body (not a stack of parts): a skeleton of bones
// with the skin, shirt and trousers weighted smoothly across the joints, so
// knees, elbows, hips and shoulders bend the way a body does. Arms and legs are
// placed with two-bone IK — give a hand or a foot a target and the elbow or
// knee bends to reach it — so he can walk, kneel and write wherever the scene
// needs him to.

const DOWN = new THREE.Vector3(0, -1, 0);
const LEN = { thigh: 0.45, shin: 0.43, ankle: 0.075, upper: 0.29, fore: 0.26 };
const HIP_Y = 0.93;
const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const gauss = (x, w) => Math.exp(-(x * x) / (w * w));

// a smooth body part turned round a vertical axis: [radius, y] from the bottom up
function lathe(profile, { seg = 20, depth = 1, x = 0, z = 0, dz = null } = {}) {
  const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), seg);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const zs = typeof depth === 'function' ? depth(y) : depth;
    p.setXYZ(i, p.getX(i) + x, y, p.getZ(i) * zs + z + (dz ? dz(y) : 0));
  }
  g.computeVertexNormals();
  return g;
}
const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1, seg = 16) => {
  const g = new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75));
  g.scale(sx, sy, sz);
  g.translate(x, y, z);
  return g;
};
const ring = (r, tube, x, y, z, sz = 1) => {
  const g = new THREE.TorusGeometry(r, tube, 8, 22);
  g.rotateX(Math.PI / 2);
  g.scale(1, 1, sz);
  g.translate(x, y, z);
  return g;
};

// give every vertex of a part its bone weights (up to four), from its rest position
function skin(g, weigh) {
  const p = g.attributes.position;
  const idx = new Uint16Array(p.count * 4);
  const wts = new Float32Array(p.count * 4);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const list = weigh(v).filter(([, w]) => w > 1e-4).slice(0, 4);
    const sum = list.reduce((a, [, w]) => a + w, 0) || 1;
    list.forEach(([b, w], k) => {
      idx[i * 4 + k] = b;
      wts[i * 4 + k] = w / sum;
    });
  }
  g.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(wts, 4));
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

// the face: a sphere sculpted into a head — jaw, chin, cheekbones, brow, nose, lips
function headGeometry() {
  const g = new THREE.SphereGeometry(0.1, 48, 40);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let { x, y, z } = v;
    const front = Math.max(0, z / 0.1);
    x *= 0.9;
    y *= 1.13;
    z *= 1.03;
    x *= 1 - 0.3 * ss(-0.01, -0.11, y) * (0.6 + 0.4 * front); // the jaw narrows to the chin
    z += 0.012 * gauss(y + 0.085, 0.025) * front; // chin
    x *= 1 + 0.06 * gauss(y + 0.005, 0.03) * front; // cheekbones
    z += 0.007 * gauss(y - 0.035, 0.012) * gauss(x, 0.05) * front; // brow
    z -= 0.007 * gauss(Math.abs(x) - 0.033, 0.014) * gauss(y - 0.012, 0.013) * front; // eye sockets
    z += 0.024 * gauss(x, 0.011) * gauss(y + 0.012, 0.024) * front * ss(0.5, 0.9, front); // nose
    z += 0.005 * gauss(x, 0.02) * gauss(y + 0.05, 0.008) * front; // lips
    z -= 0.01 * ss(0.02, 0.1, y) * (1 - front) * 0; // (the back of the skull stays round)
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}
// hair: a tousled cap, short at the sides, a little longer on top, swept back
function hairGeometry() {
  const g = new THREE.SphereGeometry(0.112, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.57);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    const tuft = 0.006 * Math.sin(n.x * 31 + n.z * 17) * Math.sin(n.y * 23 + n.x * 11) + 0.004 * Math.sin(n.z * 47);
    const top = ss(0.3, 1, n.y) * 0.012;
    v.addScaledVector(n, tuft + top);
    v.x *= 0.93;
    v.y *= 1.08;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.rotateX(-0.6); // a hairline above the forehead, down to the nape at the back
  g.computeVertexNormals();
  return g;
}
// a bare foot: high at the instep, thinning to the toes, a rounded heel
function footGeometry() {
  const g = new THREE.SphereGeometry(0.045, 20, 14);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i) * 2.3; // 0.2 long
    const toe = ss(-0.02, 0.1, z);
    x *= 0.95 + 0.15 * toe; // wider across the ball of the foot
    y = y * 0.62 * (1 - 0.5 * toe) - 0.004 * toe; // flatter toward the toes
    if (y < -0.016) y = -0.016 - (y + 0.016) * 0.25; // a flat sole
    p.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

// a soft round shadow texture, for where he touches the sand
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.5)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

// `ground(x, z)` is the height of whatever he stands on
export function createBoy({ ground = () => 0 } = {}) {
  const root = new THREE.Group();

  // ── the skeleton, standing at rest with his arms down ──
  const bones = [];
  const bone = (parent, x, y, z) => {
    const b = new THREE.Bone();
    b.position.set(x, y, z);
    if (parent) parent.add(b);
    bones.push(b);
    return b;
  };
  const base = bone(null, 0, 0, 0);
  root.add(base);
  const hips = bone(base, 0, HIP_Y, 0);
  const spine = bone(hips, 0, 0.06, 0);
  const chest = bone(spine, 0, 0.2, 0);
  const neck = bone(chest, 0, 0.28, 0.01);
  const head = bone(neck, 0, 0.12, 0.01);
  const arm = (side) => {
    const shoulder = bone(chest, side * 0.2, 0.22, -0.01);
    const upper = bone(shoulder, 0, 0, 0);
    const fore = bone(upper, 0, -LEN.upper, 0);
    const hand = bone(fore, 0, -LEN.fore, 0);
    return { shoulder, upper, fore, hand, a: LEN.upper, b: LEN.fore };
  };
  const leg = (side) => {
    const hip = bone(hips, side * 0.095, -0.02, 0);
    const upper = bone(hip, 0, 0, 0);
    const fore = bone(upper, 0, -LEN.thigh, 0);
    const foot = bone(fore, 0, -LEN.shin, 0);
    return { shoulder: hip, upper, fore, hand: foot, a: LEN.thigh, b: LEN.shin };
  };
  const armL = arm(1);
  const armR = arm(-1);
  const legL = leg(1);
  const legR = leg(-1);
  root.updateMatrixWorld(true);
  const B = (b) => bones.indexOf(b);
  const Y = (b) => b.getWorldPosition(new THREE.Vector3()).y;

  // ── the body, in the rest pose, weighted to the bones ──
  const parts = { skin: [], shirt: [], trousers: [], hair: [] };
  const torsoWeights = (v) => {
    const s1 = ss(0.97, 1.08, v.y);
    const s2 = ss(1.14, 1.27, v.y);
    const nk = ss(1.46, 1.56, v.y);
    return [
      [B(hips), 1 - s1],
      [B(spine), s1 * (1 - s2)],
      [B(chest), s2 * (1 - nk)],
      [B(neck), nk],
    ];
  };
  // trousers round the hips, and the shirt over the body
  parts.trousers.push(
    skin(lathe([[0.001, 0.75], [0.1, 0.755], [0.148, 0.79], [0.168, 0.85], [0.176, 0.92], [0.168, 0.98], [0.162, 1.04]], { seg: 28, depth: 0.72, dz: (y) => -0.012 * ss(0.95, 0.8, y) }), torsoWeights),
  );
  parts.shirt.push(
    skin(
      lathe(
        [[0.18, 0.955], [0.176, 1.02], [0.163, 1.09], [0.165, 1.17], [0.177, 1.25], [0.19, 1.32], [0.197, 1.38], [0.186, 1.43], [0.14, 1.475], [0.07, 1.5], [0.001, 1.505]],
        // (loose and untucked at the bottom, so it hangs over the waist of the trousers)
        { seg: 32, depth: (y) => 0.76 - 0.12 * ss(1.02, 1.2, y) + 0.06 * gauss(y - 1.28, 0.08), dz: (y) => 0.012 * gauss(y - 1.28, 0.1) },
      ),
      torsoWeights,
    ),
    skin(ring(0.068, 0.012, 0, 1.475, 0.005, 0.85), torsoWeights), // the open collar
  );
  // neck and head
  const headY = Y(head);
  parts.skin.push(
    skin(lathe([[0.052, 1.44], [0.048, 1.5], [0.046, 1.57], [0.047, 1.63]], { seg: 16, z: 0.01 }), (v) => {
      const k = ss(1.47, 1.6, v.y);
      return [[B(chest), 1 - ss(1.44, 1.5, v.y)], [B(neck), ss(1.44, 1.5, v.y) * (1 - k)], [B(head), k]];
    }),
  );
  const rigid = (b) => () => [[B(b), 1]];
  const headG = headGeometry();
  headG.translate(0, headY + 0.1, 0.02);
  parts.skin.push(skin(headG, rigid(head)));
  for (const s of [-1, 1]) {
    const ear = ball(0.022, s * 0.088, headY + 0.1, 0.005, 0.45, 1, 0.8, 10);
    parts.skin.push(skin(ear, rigid(head)));
    // eyes and brows, only just there, as you'd see them in low evening light
    parts.hair.push(skin(ball(0.007, s * 0.032, headY + 0.11, 0.101, 1.4, 0.75, 0.5, 8), rigid(head)));
    const brow = new THREE.BoxGeometry(0.03, 0.007, 0.008);
    brow.rotateZ(s * -0.12);
    brow.translate(s * 0.033, headY + 0.132, 0.109);
    parts.hair.push(skin(brow, rigid(head)));
  }
  const hairG = hairGeometry();
  hairG.translate(0, headY + 0.112, 0.012);
  parts.hair.push(skin(hairG, rigid(head)));

  // arms: a rolled-up sleeve, then the bare forearm and hand
  for (const A of [armL, armR]) {
    const s = A === armL ? 1 : -1;
    const x = s * 0.2;
    const sy = Y(A.shoulder);
    const ey = sy - LEN.upper;
    const wy = ey - LEN.fore;
    const armW = (v) => {
      const toFore = ss(ey + 0.05, ey - 0.05, v.y);
      const toChest = ss(sy - 0.05, sy + 0.04, v.y) * 0.55;
      const toHand = ss(wy + 0.03, wy - 0.02, v.y);
      return [[B(chest), toChest], [B(A.upper), (1 - toFore) * (1 - toChest)], [B(A.fore), toFore * (1 - toHand)], [B(A.hand), toHand]];
    };
    parts.shirt.push(
      skin(lathe([[0.049, ey + 0.02], [0.056, ey + 0.08], [0.059, ey + 0.17], [0.062, sy - 0.05], [0.058, sy], [0.042, sy + 0.028], [0.001, sy + 0.038]], { seg: 16, x: s * 0.195 }), armW),
      skin(ring(0.051, 0.013, s * 0.195, ey + 0.025, 0), armW),
    );
    parts.skin.push(
      skin(lathe([[0.024, wy - 0.005], [0.028, wy + 0.03], [0.035, wy + 0.11], [0.041, ey - 0.06], [0.043, ey + 0.04]], { seg: 14, x }), armW),
      // a loose fist round the stick, thumb over the fingers
      skin(ball(0.036, x, wy - 0.05, 0.004, 0.72, 1.35, 0.95, 12), rigid(A.hand)),
      skin(ball(0.014, x + s * -0.022, wy - 0.035, 0.022, 1, 1.8, 1, 8), rigid(A.hand)),
    );
  }
  // legs: trousers rolled to the calf, bare shins and feet
  for (const Lg of [legL, legR]) {
    const s = Lg === legL ? 1 : -1;
    const x = s * 0.095;
    const hy = Y(Lg.shoulder);
    const ky = hy - LEN.thigh;
    const ay = ky - LEN.shin;
    const legW = (v) => {
      const toShin = ss(ky + 0.06, ky - 0.06, v.y);
      const toHips = ss(hy - 0.12, hy + 0.04, v.y) * 0.6;
      return [[B(hips), toHips], [B(Lg.upper), (1 - toShin) * (1 - toHips)], [B(Lg.fore), toShin]];
    };
    parts.trousers.push(
      skin(lathe([[0.067, 0.29], [0.064, 0.33], [0.062, 0.4], [0.064, ky], [0.076, ky + 0.1], [0.085, ky + 0.25], [0.093, hy - 0.05], [0.097, hy + 0.04]], { seg: 18, x }), legW),
      skin(ring(0.066, 0.015, x, 0.3, 0), legW), // the rolled cuff
    );
    // (the ankle joint sits LEN.ankle above the sole, as in the poses)
    parts.skin.push(
      skin(lathe([[0.03, ay - 0.035], [0.035, ay], [0.037, ay + 0.06], [0.045, ay + 0.14], [0.053, ay + 0.23], [0.05, 0.33]], { seg: 14, x, dz: (y) => -0.006 * gauss(y - ay - 0.23, 0.06) }), legW),
      skin(footGeometry().translate(x, ay - 0.052, 0.055), rigid(Lg.hand)),
    );
  }

  const M = {
    skin: new THREE.MeshPhysicalMaterial({ color: '#8c624b', roughness: 0.55, sheen: 0.35, sheenColor: new THREE.Color('#ff9f7a'), sheenRoughness: 0.5 }),
    shirt: new THREE.MeshPhysicalMaterial({ color: '#f1ede4', roughness: 0.88, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.7 }),
    trousers: new THREE.MeshPhysicalMaterial({ color: '#3b4a63', roughness: 0.9, sheen: 0.4, sheenColor: new THREE.Color('#8fa0c0'), sheenRoughness: 0.8 }),
    hair: new THREE.MeshStandardMaterial({ color: '#17110d', roughness: 0.6 }),
    stick: new THREE.MeshStandardMaterial({ color: '#8a7358', roughness: 0.95 }),
  };
  const skeleton = new THREE.Skeleton(bones);
  const meshes = [];
  for (const key of ['skin', 'shirt', 'trousers', 'hair']) {
    const geo = mergeGeometries(parts[key]);
    const mesh = new THREE.SkinnedMesh(geo, M[key]);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    meshes.push(mesh);
  }

  // contact shadows: soft dark patches where his feet (and knees, and body) meet the sand
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), color: '#000', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const blobs = [0, 1, 2, 3, 4].map(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), blobMat.clone());
    m.renderOrder = 2;
    return m;
  });
  const shadows = new THREE.Group();
  shadows.add(...blobs);
  const place = (m, x, z, above, w, l, heading, strength) => {
    m.position.set(x, ground(x, z) + 0.006, z);
    m.rotation.y = heading;
    m.scale.set(w, 1, l);
    m.material.opacity = strength * Math.max(0, 1 - above / 0.18);
  };

  // the stick lives in the world, not in his hand: it's placed from its tip up through his grip
  const stickGeo = new THREE.CylinderGeometry(0.011, 0.016, 1, 7, 4);
  {
    const p = stickGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 5) * 0.006); // not quite straight
  }
  stickGeo.translate(0, 0.5, 0);
  const stick = new THREE.Mesh(stickGeo, M.stick);
  stick.castShadow = true;

  // ── two-bone IK ──
  const vA = new THREE.Vector3();
  const vT = new THREE.Vector3();
  const vU = new THREE.Vector3();
  const vP = new THREE.Vector3();
  const vE = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const qParent = new THREE.Quaternion();
  const qUpper = new THREE.Quaternion();
  function aim(j, dir, worldParent) {
    q.setFromUnitVectors(DOWN, dir);
    j.quaternion.copy(worldParent).invert().multiply(q);
    return q.clone();
  }
  function reach(limb, target, pole) {
    limb.shoulder.updateWorldMatrix(true, false);
    limb.shoulder.getWorldPosition(vA);
    limb.shoulder.getWorldQuaternion(qParent);
    const { a, b } = limb;
    vT.copy(target).sub(vA);
    const d = THREE.MathUtils.clamp(vT.length(), Math.abs(a - b) + 1e-3, a + b - 1e-3);
    vU.copy(vT).normalize();
    vP.copy(pole).sub(vA);
    vP.addScaledVector(vU, -vP.dot(vU)).normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    vE.copy(vU).multiplyScalar(a * cosA).addScaledVector(vP, a * sinA);
    qUpper.copy(aim(limb.upper, vE.clone().normalize(), qParent));
    aim(limb.fore, vU.clone().multiplyScalar(d).sub(vE).normalize(), qUpper);
    limb.fore.updateWorldMatrix(true, false);
  }
  const qEnd = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  function orientEnd(limb, forward) {
    const x = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, forward).normalize();
    const y = new THREE.Vector3().crossVectors(forward, x);
    m4.makeBasis(x, y, forward);
    qEnd.setFromRotationMatrix(m4);
    limb.fore.getWorldQuaternion(qParent);
    limb.hand.quaternion.copy(qParent).invert().multiply(qEnd);
  }

  const tmp = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const qHead = new THREE.Quaternion();
  return {
    group: root,
    stick,
    shadows,
    meshes,
    // pose = {
    //   x, z, y (ground), heading (radians, 0 = facing +z), hipY, lean, twist,
    //   lookAt (world point), feet: [left, right] world targets, footDir: [left, right],
    //   hands: [left, right] world targets, poles: { armL, armR, legL, legR } (world points),
    //   grip / tip: the stick (world points)
    // }
    pose(p) {
      root.position.set(p.x, p.y, p.z);
      root.rotation.y = p.heading;
      hips.position.y = p.hipY;
      hips.rotation.set(0, p.twist * 0.35, p.roll || 0);
      spine.rotation.set(p.lean * 0.55, p.twist * 0.35, 0);
      chest.rotation.set(p.lean * 0.45 + (p.breath || 0), p.twist * 0.3, 0);
      root.updateMatrixWorld(true);
      if (p.lookAt) {
        neck.getWorldPosition(tmp);
        const dir = p.lookAt.clone().sub(tmp);
        chest.getWorldQuaternion(qHead);
        dir.applyQuaternion(qHead.invert());
        const yaw = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -1.1, 1.1);
        const pitch = THREE.MathUtils.clamp(-Math.atan2(dir.y, Math.hypot(dir.x, dir.z)), -0.7, 0.9);
        neck.rotation.set(pitch * 0.4, yaw * 0.4, 0);
        head.rotation.set(pitch * 0.6, yaw * 0.6, 0);
      }
      reach(legL, p.feet[0], p.poles.legL);
      reach(legR, p.feet[1], p.poles.legR);
      fwd.set(Math.sin(p.heading), 0, Math.cos(p.heading));
      orientEnd(legL, p.footDir?.[0] ?? fwd);
      orientEnd(legR, p.footDir?.[1] ?? fwd);
      reach(armL, p.hands[0], p.poles.armL);
      reach(armR, p.hands[1], p.poles.armR);
      stick.visible = !!p.grip;
      if (p.grip) {
        tmp.copy(p.grip).sub(p.tip);
        const len = tmp.length() + 0.12;
        stick.position.copy(p.tip);
        stick.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, tmp.normalize());
        stick.scale.set(1, len, 1);
      }
      // shadows under each foot, each knee (when he kneels) and a wide soft one under him
      root.updateMatrixWorld(true);
      [legL, legR].forEach((lg, i) => {
        lg.hand.getWorldPosition(tmp);
        place(blobs[i], tmp.x, tmp.z, tmp.y - LEN.ankle - ground(tmp.x, tmp.z), 0.16, 0.3, p.heading, 0.55);
        lg.fore.getWorldPosition(tmp);
        place(blobs[2 + i], tmp.x, tmp.z, tmp.y - 0.05 - ground(tmp.x, tmp.z), 0.16, 0.16, p.heading, 0.5);
      });
      hips.getWorldPosition(tmp);
      place(blobs[4], tmp.x, tmp.z, Math.max(0, tmp.y - ground(tmp.x, tmp.z) - 1.0), 0.7, 0.55, p.heading, 0.28);
    },
    LEN,
  };
}
