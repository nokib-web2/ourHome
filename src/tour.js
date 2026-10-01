import * as THREE from 'three';
import { EYE } from './interior.js';

// The camera route. Each keyframe is a viewpoint; `w` is how much scrolling the
// move INTO that keyframe takes. Positions follow a Catmull-Rom spline, and the
// look direction uses monotone cubic interpolation, so the camera settles on
// each wall instead of overshooting.

const EASE = 0.55; // how much the camera lingers at each viewpoint (0 = linear)

function monotone(ys) {
  const n = ys.length;
  const d = [];
  const m = new Array(n).fill(0);
  for (let k = 0; k < n - 1; k++) d[k] = ys[k + 1] - ys[k];
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] <= 0 ? 0 : (d[k - 1] + d[k]) / 2;
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) {
      m[k] = 0;
      m[k + 1] = 0;
      continue;
    }
    const a = m[k] / d[k];
    const b = m[k + 1] / d[k];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[k] = t * a * d[k];
      m[k + 1] = t * b * d[k];
    }
  }
  return (u) => {
    const k = Math.max(0, Math.min(n - 2, Math.floor(u)));
    const t = Math.min(1, Math.max(0, u - k));
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[k] + (t3 - 2 * t2 + t) * m[k] + (-2 * t3 + 3 * t2) * ys[k + 1] + (t3 - t2) * m[k + 1]
    );
  };
}

export function buildTour(config, layout, { portrait = false, garden = null, beach = null } = {}) {
  const kf = [];
  // zoom > 1 narrows the lens (a macro close-up)
  const add = (x, y, z, yaw, pitch, w, zoom = 1) => {
    kf.push({ p: new THREE.Vector3(x, y, z), yaw, pitch, w, zoom });
    return kf.length - 1;
  };

  // outside
  add(7.5, 3.0, 40, 0.19, 0.15, 0);
  add(1.0, 2.8, 22, 0.05, 0.11, 1.4);
  const approachU = add(0, 2.25, 10.5, 0, 0.075, 1.2);
  const doorU = add(0, 1.85, 3.2, 0, 0.03, 1.2);

  // inside: scrolling only walks forward. In each room the camera stops near the
  // middle (the visitor drags to look around), then walks up to the doorway,
  // where the curtain draws open, and on through into the next room.
  const roomU = [];
  const passU = [];
  layout.forEach((r, i) => {
    if (r.library) {
      // the library: in through the door, then up close to the shelves (close enough
      // to read the spines), along the left wall, across to the right, and on out
      roomU.push(add(0, EYE, r.zStart - 2.4, 0.25, 0.0, 1.6));
      add(-5.75, EYE, r.zStart - 4.6, Math.PI / 2 - 0.12, -0.03, 1.4);
      add(-5.75, EYE, r.zStart - 8.6, Math.PI / 2 + 0.05, -0.03, 1.3);
      add(5.75, EYE, r.zStart - 7.4, -Math.PI / 2 + 0.1, -0.03, 1.8);
    } else roomU.push(add(0, EYE, r.zc + 2.6, 0, 0.04, i === 0 ? 1.6 : 1.4));
    if (!r.last || garden) {
      passU.push(add(0, EYE, r.zEnd + 2.4, 0, 0.03, 1.2));
    } else {
      // step back and take in the final wall: your names above the big photo
      add(0, 1.85, r.zEnd + 10.2, 0, 0.0, 1.6);
    }
  });

  // out through the glass doors, then once around the fountain
  let gardenDoorU = -1;
  let closeU = -1;
  if (garden) {
    const { center: C, zBack, arborZ, heroSpot: H, heroView: V } = garden;
    gardenDoorU = kf.length - 1;
    add(0, EYE, zBack - 1.2, 0, 0.0, 1.0);
    roomU.push(add(0, 2.7, zBack - 5.4, 0, -0.14, 1.3)); // the view from the terrace
    // crouch by the path for a macro close-up of the butterfly on the rose
    const dx = H.x - V.x;
    const dz = H.z - V.z;
    closeU = add(V.x, V.y, V.z, Math.atan2(-dx, -dz), Math.atan2(H.y - V.y, Math.hypot(dx, dz)), 1.5, 2.6);
    const R = portrait ? 10 : 12.5;
    const camY = C.y + 2.6;
    const pitch = Math.atan2(C.y + 1.1 - camY, R);
    for (let k = 0; k <= 8; k++) {
      const a = (k * Math.PI) / 4;
      add(C.x + Math.sin(a) * R, camY, C.z + Math.cos(a) * R, a, pitch, k === 0 ? 1.4 : 0.95);
    }
    // slip past the fountain to the flower arch with your photo
    add(3.6, C.y + 2.4, C.z - 1.5, Math.PI * 2 + 0.05, 0.0, 1.0);
    // (on wide screens the arch sits right of centre; the closing words go on the left)
    if (portrait) add(0, C.y + 4.2, arborZ + 11, Math.PI * 2, -0.16, 1.4);
    else add(-0.6, C.y + 2.5, arborZ + 8.6, Math.PI * 2 + 0.2, 0.06, 1.4);
  }
  // …then out through the gate to the sea: the beach, the close-up, the drone
  const beachU = {};
  if (garden && beach) {
    for (const k of beach.shots(portrait)) {
      const i = add(k.x, k.y, k.z, k.yaw, k.pitch, k.w, k.zoom ?? 1);
      if (k.mark) beachU[k.mark] = i;
    }
    roomU.push(beachU.reveal);
  }
  const endU = kf.length - 1;

  const N = kf.length;
  const curve = new THREE.CatmullRomCurve3(kf.map((k) => k.p), false, 'centripetal');
  const yaw = monotone(kf.map((k) => k.yaw));
  const pitch = monotone(kf.map((k) => k.pitch));
  const zoom = monotone(kf.map((k) => k.zoom));
  const cum = [0];
  for (let k = 1; k < N; k++) cum[k] = cum[k - 1] + kf[k].w;
  const total = cum[N - 1];

  function uAt(p) {
    const s = Math.min(1, Math.max(0, p)) * total;
    let k = 0;
    while (k < N - 2 && cum[k + 1] < s) k++;
    const w = cum[k + 1] - cum[k];
    let t = w > 0 ? (s - cum[k]) / w : 0;
    t += (t * t * (3 - 2 * t) - t) * EASE;
    return k + t;
  }

  const out = { pos: new THREE.Vector3(), yaw: 0, pitch: 0, zoom: 1, u: 0 };
  function sample(p) {
    const u = uAt(p);
    curve.getPoint(u / (N - 1), out.pos);
    out.yaw = yaw(u);
    out.pitch = pitch(u);
    out.zoom = Math.max(1, zoom(u));
    out.u = u;
    return out;
  }

  // Direction of the rail at a given progress. Keyboard walking uses this to
  // decide whether "forward" should advance or retrace the route after the
  // visitor has turned around with free look.
  function tangentAt(p, target) {
    return curve.getTangent(uAt(p) / (N - 1), target).normalize();
  }

  // scroll progress (0–1) at which the camera sits exactly on keyframe u
  function progressAt(u) {
    const k = Math.max(0, Math.min(N - 2, Math.floor(u)));
    const t = u - k;
    return (cum[k] + t * kf[k + 1].w) / total;
  }

  return { sample, tangentAt, progressAt, total, roomU, passU, approachU, doorU, endU, gardenDoorU, closeU, beachU };
}
