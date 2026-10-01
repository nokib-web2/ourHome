import * as THREE from 'three';
import * as TX from './textures.js';

// A two-tier stone fountain with water that behaves like water:
//  • the upper bowl overflows in a thin sheet that curves out and falls under
//    gravity into the basin (streams flow downward)
//  • droplets fall along real ballistic arcs, a small jet rises from the top
//    and falls back into the bowl, and water splashes where it lands
//  • the water surfaces reflect the sky, glint in the sun, and carry ripples
//    that spread from where the falling water hits, with a ring of foam

const G = 9.8;
// heights are relative to the ground
const BASIN_R = 2.36; // inner radius of the basin
const BASIN_Y = 0.5; // basin water level
const BOWL_R = 1.3; // inner radius of the upper bowl
const RIM_R = 1.42; // outer rim of the upper bowl, where the water spills over
const BOWL_Y = 2.33; // bowl water level
const SPILL_V = 0.7; // how fast the water leaves the rim, outward (m/s)
const JET_Y = 2.8; // top of the spout
const fallTime = Math.sqrt((2 * (BOWL_Y - BASIN_Y)) / G);
const IMPACT_R = RIM_R + SPILL_V * fallTime; // where the sheet hits the basin

const lathe = (pts, seg = 96) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// shared GLSL: value noise that wraps around in x (so it tiles round a circle)
const NOISE = /* glsl */ `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p, float wrap) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, wrap); float x1 = mod(i.x + 1.0, wrap);
    float a = hash(vec2(x0, i.y)), b = hash(vec2(x1, i.y));
    float c = hash(vec2(x0, i.y + 1.0)), d = hash(vec2(x1, i.y + 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }`;

export function buildFountain({ center, ground, time, sky, lightDir }) {
  const group = new THREE.Group();
  group.position.set(center.x, ground, center.z);

  // shared "lighting" for the water: brightness, sun/moon glint colour
  const light = { value: 1 };
  const glint = { value: new THREE.Color(1, 0.9, 0.75) };

  // ── stonework ──
  const plaster = TX.plasterTexture();
  plaster.repeat.set(6, 2);
  const stone = new THREE.MeshStandardMaterial({ color: '#ece4d7', map: plaster, roughness: 0.78 });
  const wetStone = new THREE.MeshStandardMaterial({ color: '#9fb3b0', map: plaster, roughness: 0.4 });
  // basin: a moulded outer wall, a rounded rim, the inner wall and the floor
  // (a lathe faces outward when its profile climbs, so this one runs from the
  // ground up over the rim and back down inside)
  group.add(
    new THREE.Mesh(
      lathe([
        [2.93, 0.0], [2.9, 0.07], [2.79, 0.16], [2.75, 0.44], [2.71, 0.5], [2.74, 0.57], [2.68, 0.64],
        [2.55, 0.67], [2.42, 0.64], [2.36, 0.58], [2.36, 0.24], [2.3, 0.18], [0.001, 0.18],
      ]),
      stone,
    ),
  );
  // turned pedestal
  group.add(
    new THREE.Mesh(
      lathe([
        [0.64, 0.18], [0.64, 0.3], [0.52, 0.36], [0.38, 0.5], [0.3, 0.76], [0.34, 0.96], [0.43, 1.05],
        [0.35, 1.16], [0.25, 1.36], [0.23, 1.6], [0.31, 1.7], [0.38, 1.77], [0.001, 1.78],
      ], 48),
      stone,
    ),
  );
  // the upper bowl, with a rim the water spills over
  group.add(
    new THREE.Mesh(
      lathe([
        [0.001, 1.76], [0.35, 1.78], [0.8, 1.86], [1.15, 2.0], [1.36, 2.2], [RIM_R, 2.3], [RIM_R - 0.02, 2.37],
        [1.34, 2.37], [BOWL_R, 2.31], [1.05, 2.17], [0.6, 2.07], [0.001, 2.05],
      ]),
      stone,
    ),
  );
  // the spout in the middle of the bowl
  group.add(
    new THREE.Mesh(
      lathe([[0.2, 2.05], [0.15, 2.2], [0.1, 2.48], [0.17, 2.6], [0.13, 2.69], [0.05, 2.78], [0.001, JET_Y]], 32),
      stone,
    ),
  );
  // a darker, wet band just under the lip where water runs over it
  group.add(new THREE.Mesh(lathe([[1.36, 2.2], [RIM_R, 2.3]], 96), wetStone));
  // and a wet line round the inside of the basin, just above the water
  group.add(new THREE.Mesh(lathe([[BASIN_R - 0.004, BASIN_Y + 0.06], [BASIN_R - 0.004, BASIN_Y - 0.03]], 96), wetStone));

  // ── water surfaces ──
  function waterMaterial(radius, impact) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: time,
        uLight: light,
        uGlint: glint,
        uSun: { value: lightDir },
        uRadius: { value: radius },
        uImpact: { value: impact },
        uSkyTop: { value: sky.top.value },
        uSkyMid: { value: sky.mid.value },
        uSkyHorizon: { value: sky.horizon.value },
      },
      vertexShader: /* glsl */ `
        varying vec2 vLocal; varying vec3 vWorld;
        void main() {
          vLocal = position.xy;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vWorld = w.xyz;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime, uLight, uRadius, uImpact;
        uniform vec3 uGlint, uSun, uSkyTop, uSkyMid, uSkyHorizon;
        varying vec2 vLocal; varying vec3 vWorld;
        ${NOISE}
        // height of the water at a point: broken, jostling rings spreading from
        // where the water falls in, choppy water right at the landing line, and
        // small wind ripples
        float height(vec2 p) {
          float r = length(p);
          float d = r - uImpact;
          float u = atan(p.y, p.x) / 6.2831853 + 0.5; // 0–1 round the circle
          float jit = vnoise(vec2(u * 24.0, uTime * 0.8), 24.0) - 0.5;
          float jit2 = vnoise(vec2(u * 57.0, r * 6.0 - uTime * 1.3), 57.0) - 0.5;
          float rings = sin(d * 26.0 - uTime * 7.0 + jit * 5.0) * exp(-abs(d) * 2.2) * 0.011 * (0.6 + 0.8 * jit2);
          rings += sin(d * 43.0 - uTime * 11.0 + jit2 * 6.0) * exp(-abs(d) * 3.5) * 0.005;
          float chop = (vnoise(vec2(u * 90.0, r * 14.0 + uTime * 3.0), 90.0) - 0.5) * 0.02 * exp(-abs(d) * 5.0);
          float wind = sin(dot(p, vec2(3.1, 1.7)) * 2.3 + uTime * 1.7) * 0.004
                     + sin(dot(p, vec2(-1.3, 2.9)) * 3.1 - uTime * 2.1) * 0.003;
          return rings + chop + wind;
        }
        void main() {
          vec2 p = vLocal;
          float e = 0.01;
          float h = height(p);
          vec3 nLocal = normalize(vec3(-(height(p + vec2(e, 0.0)) - h) / e, -(height(p + vec2(0.0, e)) - h) / e, 1.0));
          vec3 N = normalize(vec3(nLocal.x, nLocal.z, -nLocal.y)); // plane lies flat (local z → world y)
          vec3 V = normalize(cameraPosition - vWorld);
          float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 R = reflect(-V, N);
          vec3 skyCol = R.y < 0.25 ? mix(uSkyHorizon, uSkyMid, R.y / 0.25) : mix(uSkyMid, uSkyTop, (R.y - 0.25) / 0.75);
          // looking down into the water: a clear teal over pale stone, darker toward the wall
          float r = length(p);
          vec3 deep = mix(vec3(0.42, 0.66, 0.66), vec3(0.2, 0.42, 0.46), smoothstep(uRadius * 0.4, uRadius, r)) * uLight;
          vec3 col = mix(deep, skyCol, clamp(fres * 1.1, 0.0, 1.0));
          // sun (or moon) glint
          vec3 L = normalize(uSun);
          col += uGlint * pow(max(dot(reflect(-L, N), V), 0.0), 180.0) * 3.0;
          // foam where the falling water lands
          float d = abs(r - uImpact);
          float foam = smoothstep(0.22, 0.0, d) * (0.45 + 0.55 * vnoise(vec2(atan(p.y, p.x) * 28.0, r * 9.0 - uTime * 2.0), 176.0));
          col = mix(col, vec3(0.95, 0.97, 0.97) * (0.4 + 0.6 * uLight), foam * 0.75);
          gl_FragColor = vec4(col, 0.9);
        }`,
      transparent: true,
    });
  }
  const basinWater = new THREE.Mesh(new THREE.CircleGeometry(BASIN_R, 96), waterMaterial(BASIN_R, IMPACT_R));
  basinWater.rotation.x = -Math.PI / 2;
  basinWater.position.y = BASIN_Y;
  group.add(basinWater);
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(BOWL_R, 64), waterMaterial(BOWL_R, 0.42));
  bowlWater.rotation.x = -Math.PI / 2;
  bowlWater.position.y = BOWL_Y;
  group.add(bowlWater);

  // ── the overflow sheet: a thin, streaming curtain following the fall curve ──
  const sheetPts = [];
  for (let k = 0; k <= 16; k++) {
    const t = (k / 16) * fallTime;
    sheetPts.push([RIM_R + 0.01 + SPILL_V * t, BOWL_Y + 0.03 - 0.5 * G * t * t]);
  }
  const sheetMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uLight: light },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uLight;
      varying vec2 vUv;
      ${NOISE}
      void main() {
        // v runs from the rim (0) down to the basin (1): streams flow toward v = 1
        float v = vUv.y;
        float flow = v * 3.0 - uTime * 2.6;
        float streams = vnoise(vec2(vUv.x * 150.0, flow), 150.0);
        float fine = vnoise(vec2(vUv.x * 420.0, flow * 2.3), 420.0);
        float s = smoothstep(0.35, 0.9, streams * 0.7 + fine * 0.45);
        float alpha = (0.12 + 0.5 * s) * smoothstep(0.0, 0.06, v) * (1.0 - 0.45 * smoothstep(0.7, 1.0, v));
        vec3 col = mix(vec3(0.62, 0.78, 0.8), vec3(1.0), s * 0.8) * (0.35 + 0.65 * uLight);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // the profile runs top → bottom, so the lathe's v coordinate follows the fall
  group.add(new THREE.Mesh(lathe(sheetPts, 128), sheetMat));

  // ── droplets, the jet and splashes: particles on real gravity arcs ──
  const rnd = TX.rng(71);
  const types = [];
  const seeds = [];
  const pos = [];
  const addParticles = (n, type) => {
    for (let i = 0; i < n; i++) {
      types.push(type);
      seeds.push(rnd(), rnd(), rnd(), rnd());
      pos.push(0, 0, 0);
    }
  };
  addParticles(520, 0); // drips over the rim
  addParticles(280, 1); // the jet
  addParticles(360, 2); // splashes in the basin
  addParticles(120, 3); // splashes in the bowl
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  pGeo.setAttribute('aType', new THREE.Float32BufferAttribute(types, 1));
  pGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 4));
  pGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.8, 0), 3.5);
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uTime: time, uScale: { value: 800 }, uLight: light },
    vertexShader: /* glsl */ `
      uniform float uTime, uScale;
      attribute float aType; attribute vec4 aSeed;
      varying float vAlpha;
      const float G = ${G.toFixed(2)};
      void main() {
        float ang = aSeed.x * 6.2831853;
        vec2 dir = vec2(cos(ang), sin(ang));
        vec3 p; float alpha = 1.0; float size = 0.03;
        if (aType < 0.5) {
          // drips spilling over the rim, curving out and down
          float life = ${fallTime.toFixed(3)} * (0.95 + aSeed.w * 0.1);
          float t = fract(uTime / life + aSeed.y) * life;
          float vr = ${SPILL_V.toFixed(2)} * (0.8 + aSeed.z * 0.5);
          float r = ${(RIM_R + 0.02).toFixed(3)} + vr * t;
          p = vec3(dir.x * r, ${(BOWL_Y + 0.02).toFixed(3)} + (aSeed.w - 0.5) * 0.2 * t - 0.5 * G * t * t, dir.y * r);
          alpha = 0.55 * smoothstep(0.0, 0.05, t);
          size = 0.022 + aSeed.z * 0.018;
        } else if (aType < 1.5) {
          // the jet: up from the spout, then back down into the bowl
          float v0 = 3.0 + aSeed.z * 0.5;
          float vh = 0.15 + aSeed.w * 0.45;
          float life = (v0 + sqrt(v0 * v0 + 2.0 * G * ${(JET_Y - BOWL_Y).toFixed(3)})) / G;
          float t = fract(uTime / life * 1.3 + aSeed.y) * life;
          p = vec3(dir.x * vh * t, ${JET_Y.toFixed(3)} + v0 * t - 0.5 * G * t * t, dir.y * vh * t);
          alpha = 0.7;
          size = 0.028 + aSeed.w * 0.02;
        } else {
          // splashes: little hops of water where the falling water lands
          bool basin = aType < 2.5;
          float life = 0.22 + aSeed.w * 0.2;
          float t = fract(uTime / life + aSeed.y) * life;
          float r = basin ? ${IMPACT_R.toFixed(3)} + (aSeed.z - 0.5) * 0.3 : 0.1 + aSeed.z * 0.45;
          float vy = 0.6 + aSeed.w * 1.0;
          float vr = (aSeed.z - 0.5) * 0.8;
          float base = basin ? ${BASIN_Y.toFixed(3)} : ${BOWL_Y.toFixed(3)};
          p = vec3(dir.x * (r + vr * t), base + vy * t - 0.5 * G * t * t, dir.y * (r + vr * t));
          alpha = 0.6 * (1.0 - t / life) * step(base - 0.01, p.y);
          size = 0.02 + aSeed.w * 0.02;
        }
        vAlpha = alpha;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, size * uScale / -mv.z);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uLight;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.15, d) * vAlpha;
        gl_FragColor = vec4(vec3(0.93, 0.97, 1.0) * (0.35 + 0.65 * uLight), a);
      }`,
    transparent: true,
    depthWrite: false,
  });
  group.add(new THREE.Points(pGeo, pMat));

  const DAY_GLINT = new THREE.Color(1, 0.88, 0.7);
  const NIGHT_GLINT = new THREE.Color(0.55, 0.62, 0.9);
  return {
    group,
    impactRadius: IMPACT_R,
    update(viewportHeight, night) {
      pMat.uniforms.uScale.value = viewportHeight;
      light.value = 1 - 0.68 * night;
      glint.value.lerpColors(DAY_GLINT, NIGHT_GLINT, night);
    },
  };
}
