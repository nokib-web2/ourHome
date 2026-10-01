import * as THREE from 'three';

// Geometry helpers. UVs are in metres so tiling textures stay the same scale
// on every surface (set texture.repeat = 1 / tileSizeInMetres).

export function meterPlane(w, h) {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
  return g;
}

export function boxM(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  return g;
}

// Arched opening (rectangle + half circle), used as a hole path.
export function archPath(path, cx, y0, w, rectH) {
  const r = w / 2;
  path.moveTo(cx - r, y0);
  path.lineTo(cx + r, y0);
  path.lineTo(cx + r, y0 + rectH);
  path.absarc(cx, y0 + rectH, r, 0, Math.PI, false);
  path.lineTo(cx - r, y0);
  return path;
}

// A wall outline with an arched doorway notched out of the bottom centre.
export function archNotchShape(w, h, doorW, doorRect) {
  const r = doorW / 2;
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(-r, 0);
  s.lineTo(-r, doorRect);
  s.absarc(0, doorRect, r, Math.PI, 0, true);
  s.lineTo(r, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h);
  s.lineTo(-w / 2, h);
  s.lineTo(-w / 2, 0);
  return s;
}

// U-shaped moulding that frames an arched opening.
export function archTrimShape(cx, y0, rIn, rOut, rectH) {
  const s = new THREE.Shape();
  s.moveTo(cx - rOut, y0);
  s.lineTo(cx - rIn, y0);
  s.lineTo(cx - rIn, y0 + rectH);
  s.absarc(cx, y0 + rectH, rIn, Math.PI, 0, true);
  s.lineTo(cx + rIn, y0);
  s.lineTo(cx + rOut, y0);
  s.lineTo(cx + rOut, y0 + rectH);
  s.absarc(cx, y0 + rectH, rOut, 0, Math.PI, false);
  s.lineTo(cx - rOut, y0);
  return s;
}

export function ringShape(cx, cy, rIn, rOut) {
  const s = new THREE.Shape();
  s.absarc(cx, cy, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(cx, cy, rIn, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

export function halfDiscShape(r) {
  const s = new THREE.Shape();
  s.moveTo(r, 0);
  s.absarc(0, 0, r, 0, Math.PI, false);
  s.lineTo(r, 0);
  return s;
}
