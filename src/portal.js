import * as THREE from 'three';

// Portal culling. From inside the house the garden (and the beach beyond it) can
// only be seen through the glass doors, so anything out there that lies outside
// the view through that doorway is skipped. It takes a lot off a small GPU: most
// of the garden is hidden behind the back wall while you're in the library.
//
// `rect` is the doorway: { x0, x1, y0, y1, z }, with the house on the +z side.
// Culling uses layers (not `visible`), so it never fights the garden's own logic.
export function createPortal(roots, rect, { margin = 1.2 } = {}) {
  const units = [];
  const box = new THREE.Box3();
  let built = false;

  // cull whole things (a tree, a flower bed), but split up anything that spans the garden
  function collect(o) {
    for (const c of o.children) {
      if (c.isLight) continue;
      box.setFromObject(c);
      if (box.isEmpty()) continue;
      const sphere = box.getBoundingSphere(new THREE.Sphere());
      if (sphere.radius > 12 && c.children.length && !c.isMesh && !c.isPoints) {
        collect(c);
        continue;
      }
      const draw = [];
      c.traverse((m) => {
        if (m.isMesh || m.isPoints || m.isLine || m.isSprite) draw.push(m);
      });
      if (draw.length) units.push({ root: c, sphere, draw, culled: false });
    }
  }

  const planes = [new THREE.Plane(), new THREE.Plane(), new THREE.Plane(), new THREE.Plane()];
  const A = new THREE.Vector3(rect.x0, rect.y0, rect.z);
  const B = new THREE.Vector3(rect.x1, rect.y0, rect.z);
  const C = new THREE.Vector3(rect.x1, rect.y1, rect.z);
  const D = new THREE.Vector3(rect.x0, rect.y1, rect.z);
  const inside = new THREE.Vector3((rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, rect.z - 2);
  const edges = [[A, D], [B, C], [A, B], [D, C]];

  function set(u, culled) {
    if (u.culled === culled) return;
    u.culled = culled;
    for (const m of u.draw) {
      if (culled) m.layers.disable(0);
      else m.layers.enable(0);
    }
  }

  let active = false;
  let refresh = 0;
  return {
    update(eye) {
      // only from well inside the house (at the doorway itself, everything is in view)
      const on = eye.z > rect.z + 0.4;
      if (!on) {
        if (active) for (const u of units) set(u, false);
        active = false;
        return;
      }
      if (!built) {
        for (const r of roots) {
          r.updateMatrixWorld(true);
          collect(r);
        }
        built = true;
      }
      active = true;
      // the view through the doorway: four planes from your eye through its edges
      edges.forEach(([p, q], i) => {
        planes[i].setFromCoplanarPoints(eye, p, q);
        if (planes[i].distanceToPoint(inside) < 0) planes[i].negate();
      });
      // (things that move, like the butterflies, get their bounds refreshed now and then)
      for (let k = 0; k < 12 && units.length; k++) {
        const u = units[refresh++ % units.length];
        box.setFromObject(u.root);
        if (!box.isEmpty()) box.getBoundingSphere(u.sphere);
      }
      for (const u of units) {
        const r = u.sphere.radius + margin;
        let seen = true;
        for (const pl of planes) {
          if (pl.distanceToPoint(u.sphere.center) < -r) {
            seen = false;
            break;
          }
        }
        set(u, !seen);
      }
    },
  };
}
