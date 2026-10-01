import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import * as TX from './textures.js';
import { windy, planter } from './nature.js';
import { createBoy } from './boy.js';
import { layoutText } from './sandFont.js';

// Through the gate at the bottom of the garden: a boardwalk over the dunes down
// to the sea at golden hour. On the beach a young man draws a big heart in the
// sand with a stick, kneels, and writes your names inside it (close-up), then
// stands and waves as the camera rises into a drone's-eye view.
//
//  • the sand is one sculpted surface: dunes, a dry upper beach, then wet,
//    shining sand where the waves reach; the writing is carved into it
//  • the sea rolls in in sets of waves that steepen, break into whitewater and
//    wash up the beach in a thin sheet before draining back
//  • everything the boy does is driven by the scroll, but runs at its own
//    natural pace when you stop, so he never freezes mid-stride

const GROUND = -0.9;
export const SEA_Y = -3.0;
const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The shape of the coast: sand height at x, `s` metres seaward of the dune line.
// (The same formula runs in the sand and sea shaders below.)
function profile(x, s) {
  const e = s + 0.00025 * x * x - 0.8 * Math.sin(x * 0.02);
  return (
    GROUND -
    0.04 * (1 - ss(-2, 0.5, e)) + // tucked just under the lawn, so the dunes rise out from beneath it
    0.45 * ss(-1, 4, e) * (1 - ss(4, 9, e)) +
    0.25 * Math.sin(x * 0.11 + 1.3) * Math.sin(x * 0.043) * ss(-1, 3, e) * (1 - ss(5, 12, e)) -
    1.65 * ss(4, 16, e) -
    0.2 * ss(16, 30, e) -
    0.042 * Math.max(0, e - 30) -
    4 * ss(55, 140, e)
  );
}
const PROFILE_GLSL = /* glsl */ `
  float ssb(float a, float b, float x) { float t = clamp((x - a) / (b - a), 0.0, 1.0); return t * t * (3.0 - 2.0 * t); }
  float bay(float x) { return 0.00025 * x * x - 0.8 * sin(x * 0.02); }
  float profile(float x, float s) {
    float e = s + bay(x);
    return ${GROUND.toFixed(2)}
      - 0.04 * (1.0 - ssb(-2.0, 0.5, e))
      + 0.45 * ssb(-1.0, 4.0, e) * (1.0 - ssb(4.0, 9.0, e))
      + 0.25 * sin(x * 0.11 + 1.3) * sin(x * 0.043) * ssb(-1.0, 3.0, e) * (1.0 - ssb(5.0, 12.0, e))
      - 1.65 * ssb(4.0, 16.0, e)
      - 0.2 * ssb(16.0, 30.0, e)
      - 0.042 * max(0.0, e - 30.0)
      - 4.0 * ssb(55.0, 140.0, e);
  }`;
const NOISE_GLSL = /* glsl */ `
  float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x), mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x), u.y);
  }`;

export function beachLayout(center) {
  const O = new THREE.Vector3(0, GROUND, center.z - 28); // where the lawn gives way to the dunes
  const heart = new THREE.Vector3(0, profile(0, 22), O.z - 22);
  let s = 30;
  while (profile(0, s) > SEA_Y) s += 0.05;
  return { O, heart, shoreZ: O.z - s, walkY: (s) => profile(0, s) + 0.17 };
}

function sandTexture() {
  const S = 512;
  const [c, ctx] = TX.makeCanvas(S);
  ctx.fillStyle = '#dcc7a0';
  ctx.fillRect(0, 0, S, S);
  const r = TX.rng(88);
  // thousands of grains, light and dark (larger variations come from the shader,
  // so nothing here repeats visibly from tile to tile)
  for (let i = 0; i < 26000; i++) {
    const v = r();
    ctx.fillStyle = v < 0.5 ? `rgba(120,98,70,${0.15 + r() * 0.25})` : v < 0.9 ? `rgba(250,240,220,${0.2 + r() * 0.3})` : `rgba(70,62,58,${0.2 + r() * 0.3})`;
    const s = r() < 0.9 ? 1 : 2;
    ctx.fillRect(r() * S, r() * S, s, s);
  }
  return TX.toTexture(c, { repeat: 1 });
}

// marram grass: tall, thin, straw-tipped blades that lean with the wind
function duneGrassClump() {
  const r = TX.rng(21);
  const pos = [];
  const col = [];
  const base = new THREE.Color('#58663a');
  const tip = new THREE.Color('#d8cf98');
  for (let b = 0; b < 12; b++) {
    const h = 0.35 + r() * 0.6;
    const w = 0.012 + r() * 0.008;
    const a = r() * Math.PI * 2;
    const lean = 0.15 + r() * 0.35;
    const ox = (r() - 0.5) * 0.25;
    const oz = (r() - 0.5) * 0.25;
    const pt = (t, side) => {
      const x = side * w * (1 - t);
      const out = lean * t * t * h;
      return [ox + x * Math.cos(a) + out * Math.sin(a), t * h * (1 - 0.15 * t * lean), oz - x * Math.sin(a) + out * Math.cos(a)];
    };
    for (let s = 0; s < 4; s++) {
      const t0 = s / 4;
      const t1 = (s + 1) / 4;
      const quad = [pt(t0, -1), pt(t0, 1), pt(t1, 1), pt(t0, -1), pt(t1, 1), pt(t1, -1)];
      [t0, t0, t1, t0, t1, t1].forEach((t, i) => {
        pos.push(...quad[i]);
        const c = base.clone().lerp(tip, Math.pow(t, 0.8));
        col.push(c.r, c.g, c.b);
      });
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// a weathered boulder: a lumpy sphere
function rockGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position;
  const r = TX.rng(seed);
  const bumps = Array.from({ length: 6 }, () => [new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).normalize(), 0.1 + r() * 0.2]);
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let k = 1;
    for (const [d, a] of bumps) k += a * Math.max(0, v.dot(d)) ** 3;
    k += (Math.sin(v.x * 7 + seed) * Math.sin(v.y * 6) * Math.sin(v.z * 8)) * 0.05;
    v.multiplyScalar(k);
    v.y *= 0.62;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  // weld the corners so it shades smooth, like worn stone, not cut facets
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const smooth = mergeVertices(g);
  smooth.computeVertexNormals();
  return smooth;
}

export function buildBeach(config, garden, { nature, sky, sunDir, sunMat }) {
  const L = beachLayout(garden.center);
  const { O, heart: H } = L;
  const sandY = (x, z) => profile(x, O.z - z);
  const time = nature.time;
  const group = new THREE.Group();

  // ── the writing in the sand: a canvas the shader reads as grooves & ridges ──
  // red = groove depth, green = the little ridge of sand pushed up beside it
  const MASK_PX = 1024;
  const MASK_SIZE = 9.6;
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = maskCanvas.height = MASK_PX;
  const mctx = maskCanvas.getContext('2d');
  const maskTex = new THREE.CanvasTexture(maskCanvas);
  maskTex.flipY = false;
  maskTex.colorSpace = THREE.NoColorSpace;
  const toPx = (x, z) => [((x - H.x) / MASK_SIZE + 0.5) * MASK_PX, ((z - H.z) / MASK_SIZE + 0.5) * MASK_PX];

  // ── sand ──
  const sandTex = sandTexture();
  sandTex.repeat.set(450, 95);
  sandTex.anisotropy = 4;
  const sandGeo = new THREE.PlaneGeometry(900, 190, 180, 190);
  sandGeo.rotateX(-Math.PI / 2);
  {
    const p = sandGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const s = 87 - p.getZ(i); // s from -8 (lawn side) to 182 (out under the sea)
      p.setXYZ(i, x, profile(x, s), O.z - s);
    }
    sandGeo.computeVertexNormals();
  }
  const sandMat = new THREE.MeshStandardMaterial({ map: sandTex, roughness: 0.97 });
  sandMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      uMask: { value: maskTex },
      uMaskC: { value: new THREE.Vector2(H.x, H.z) },
      uMaskS: { value: MASK_SIZE },
      uOz: { value: O.z },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vW;\nuniform sampler2D uMask; uniform vec2 uMaskC; uniform float uMaskS; uniform float uOz;\n${NOISE_GLSL}`)
      .replace(
        '#include <map_fragment>',
        /* glsl */ `#include <map_fragment>
        float e = (uOz - vW.z) + 0.00025 * vW.x * vW.x - 0.8 * sin(vW.x * 0.02);
        float n1 = vnoise(vW.xz * 0.35);
        // the lawn's edge frays into the dunes
        float grassy = 1.0 - smoothstep(-2.0, 4.5, e + (n1 - 0.5) * 5.0);
        // below the reach of the waves the sand is wet: darker, and it shines
        float wet = smoothstep(30.3, 35.0, e + (vnoise(vW.xz * 0.5) - 0.5) * 1.6);
        diffuseColor.rgb *= 0.9 + 0.2 * vnoise(vW.xz * 0.06);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.62, 0.59, 0.56), wet);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.26, 0.31, 0.16), grassy * 0.9);
        vec2 muv = (vW.xz - uMaskC) / uMaskS + 0.5;
        float inBox = step(0.0, muv.x) * step(muv.x, 1.0) * step(0.0, muv.y) * step(muv.y, 1.0);
        vec4 mk = texture2D(uMask, muv) * inBox;
        diffuseColor.rgb *= 1.0 - mk.r * 0.32; // freshly turned sand is a little damper`,
      )
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.28, wet);')
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        {
          float px = 1.5 / ${MASK_PX}.0;
          #define MH(o) dot(texture2D(uMask, muv + o).rg, vec2(-1.0, 0.4))
          float gx = (MH(vec2(px, 0.0)) - MH(vec2(-px, 0.0))) * inBox;
          float gz = (MH(vec2(0.0, px)) - MH(vec2(0.0, -px))) * inBox;
          // little wind ripples across the dry sand
          float dry = (1.0 - wet) * smoothstep(6.0, 12.0, e);
          float rip = cos(dot(vW.xz, vec2(0.25, 1.0)) * 7.0 + n1 * 9.0) * 0.1 * dry * (0.5 + 0.5 * vnoise(vW.xz * 1.3));
          vec3 bump = vec3(gx * 1.6 + rip * 0.25, 0.0, gz * 1.6 + rip);
          normal = normalize(normal - (viewMatrix * vec4(bump, 0.0)).xyz);
        }`,
      );
  };
  sandMat.customProgramCacheKey = () => 'beach-sand';
  const sand = new THREE.Mesh(sandGeo, sandMat);
  sand.receiveShadow = true;
  group.add(sand);

  // ── the sea ──
  const light = { value: 1 };
  const sunVis = { value: 1 };
  const seaMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: time,
      uSeaY: { value: SEA_Y },
      uShoreZ: { value: L.shoreZ },
      uOz: { value: O.z },
      uLight: light,
      uSunVis: sunVis,
      uSunDir: { value: sunDir },
      uSunColor: { value: sunMat.color },
      uSkyTop: { value: sky.top.value },
      uSkyMid: { value: sky.mid.value },
      uSkyHorizon: { value: sky.horizon.value },
    },
    vertexShader: /* glsl */ `
      uniform float uTime, uSeaY, uShoreZ;
      varying vec3 vW; varying float vFoam; varying float vCrest;
      // One set of waves rolling in: each crest steepens as the water gets
      // shallow, breaks into whitewater about ten metres out, and then surges
      // up the beach as a thin sheet before draining back.
      float train(vec2 p, float d, float T, float off, float amp, inout float foam, inout float surge, inout float crestOut) {
        float ph = uTime / T + off + 0.1 * sin(p.x * 0.013 + off * 7.0) + 0.05 * sin(p.x * 0.041 + off * 3.0);
        float s = fract(ph);
        float dc = 40.0 * (1.0 - s);
        float build = smoothstep(40.0, 18.0, dc);
        float broken = smoothstep(13.0, 8.0, dc);
        float x = d - dc;
        float crest = exp(-x * x / (x > 0.0 ? 10.0 : 1.8));
        float fade = smoothstep(0.0, 5.0, dc);
        foam += (crest * broken + step(0.0, x) * exp(-x * 0.28) * broken * 0.75) * fade;
        crestOut += crest * build * (1.0 - broken);
        surge += amp * (s < 0.08 ? smoothstep(0.0, 0.08, s) : exp(-(s - 0.08) * 3.2));
        return amp * crest * (0.3 + 0.7 * build) * (1.0 - 0.55 * broken) * fade;
      }
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        // distance out from the waterline (which curves round with the bay)
        float d = (uShoreZ - w.z) + 0.00025 * w.x * w.x - 0.8 * sin(w.x * 0.02);
        float foam = 0.0, surge = 0.0, crest = 0.0;
        float h = train(w.xz, d, 9.0, 0.0, 0.34, foam, surge, crest) + train(w.xz, d, 12.3, 0.41, 0.22, foam, surge, crest);
        float edge = 1.0 - smoothstep(240.0, 290.0, abs(w.x));
        w.y = uSeaY + (h * smoothstep(-2.0, 4.0, d) + surge * 0.36 * (1.0 - smoothstep(-6.0, 24.0, d))) * edge;
        vFoam = foam * edge;
        vCrest = crest * edge;
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uLight, uSunVis, uOz;
      uniform vec3 uSkyTop, uSkyMid, uSkyHorizon, uSunDir, uSunColor;
      varying vec3 vW; varying float vFoam; varying float vCrest;
      ${NOISE_GLSL}
      ${PROFILE_GLSL}
      // small wind waves on top of the swell; the short ones fade with distance
      float waves(vec2 p, float dist) {
        float t = uTime;
        float h = 0.045 * sin(dot(p, vec2(0.08, 0.69)) + t * 2.6);
        h += 0.03 * sin(dot(p, vec2(-0.35, 1.2)) + t * 3.4 + 1.3);
        h += 0.02 * sin(dot(p, vec2(1.1, 1.7)) + t * 4.1 + 2.1) * smoothstep(260.0, 80.0, dist);
        h += 0.012 * sin(dot(p, vec2(-2.4, 2.0)) + t * 4.9 + 0.7) * smoothstep(160.0, 50.0, dist);
        h += 0.008 * sin(dot(p, vec2(3.3, -1.9)) + t * 5.7 + 4.0) * smoothstep(110.0, 30.0, dist);
        h += 0.014 * (vnoise(p * 2.2 + vec2(t * 0.6, t * 0.9)) - 0.5) * smoothstep(60.0, 15.0, dist);
        h += 0.007 * (vnoise(p * 5.1 - vec2(t * 0.9, t * 0.4)) - 0.5) * smoothstep(30.0, 8.0, dist);
        return h;
      }
      vec3 skyCol(float y) {
        vec3 c = mix(uSkyHorizon, uSkyMid, smoothstep(-0.02, 0.24, y));
        return mix(c, uSkyTop, smoothstep(0.24, 0.8, y));
      }
      void main() {
        vec3 toCam = cameraPosition - vW;
        float dist = length(toCam.xz);
        vec3 V = normalize(toCam);
        vec2 p = vW.xz;
        float e = 0.04 + dist * 0.004;
        float h0 = waves(p, dist);
        vec3 n = vec3(-(waves(p + vec2(e, 0.0), dist) - h0) / e, 1.0, -(waves(p + vec2(0.0, e), dist) - h0) / e);
        // the rolling swell (the mesh itself) tilts the surface too
        vec3 geo = normalize(cross(dFdx(vW), dFdy(vW)));
        if (geo.y < 0.0) geo = -geo;
        vec3 N = normalize(n + geo - vec3(0.0, 1.0, 0.0));
        float F = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec3 refl = skyCol(R.y);
        vec3 S = normalize(uSunDir);
        float sd = max(dot(R, S), 0.0);
        vec3 glint = uSunColor * (pow(sd, 1400.0) * 5.0 + pow(sd, 160.0) * 0.3 + pow(sd, 18.0) * 0.04) * uSunVis;
        // the water itself: sand showing through the shallows, turquoise, then deep blue
        float depth = vW.y - profile(vW.x, uOz - vW.z);
        vec3 body = mix(vec3(0.3, 0.4, 0.33), vec3(0.05, 0.3, 0.32), smoothstep(0.0, 0.8, depth));
        body = mix(body, vec3(0.01, 0.075, 0.115), smoothstep(0.8, 7.0, depth));
        body *= 0.75 + 0.5 * uSkyMid; // tinted by the evening sky it's lit by
        // the low sun shining through the back of a rising wave
        body += vec3(0.04, 0.3, 0.26) * vCrest * pow(max(dot(-V, S), 0.0), 2.0) * uSunVis;
        body *= uLight;
        vec3 col = mix(body, refl, F) + glint;
        // foam: breaking crests, the whitewater left behind them, and the lacy edge of each wash
        // (three turned octaves of noise, so the lace never lines up on a grid)
        vec2 q1 = mat2(0.8, -0.6, 0.6, 0.8) * p;
        vec2 q2 = mat2(0.5, 0.87, -0.87, 0.5) * p;
        float lace = vnoise(q1 * vec2(3.2, 6.0) + vec2(0.0, uTime * 0.25)) * 0.5
                   + vnoise(q2 * 9.0 - uTime * 0.2) * 0.3
                   + vnoise(p * 21.0 + vec2(uTime * 0.3, 0.0)) * 0.2;
        float f1 = clamp(vFoam, 0.0, 1.2) * smoothstep(0.28, 0.68, lace + vFoam * 0.2);
        float film = 1.0 - smoothstep(0.0, 0.09, depth);
        float edge = film * smoothstep(0.38, 0.62, lace) * 0.75 + (1.0 - smoothstep(0.0, 0.014, depth)) * 0.5;
        float foam = clamp(f1 + edge, 0.0, 1.0);
        col = mix(col, vec3(0.92, 0.92, 0.88) * uLight * (0.75 + 0.25 * F), foam * 0.88);
        // haze out toward the horizon
        col = mix(col, uSkyHorizon, smoothstep(200.0, 1500.0, dist) * 0.9);
        float alpha = clamp(smoothstep(0.0, 0.1, depth) + foam * step(0.001, depth), 0.0, 1.0);
        gl_FragColor = vec4(col, alpha);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // near the beach: fine enough for the waves to roll in; beyond it a plain
  // plane (with a hole where the fine one sits) out to the horizon
  const nearSea = new THREE.PlaneGeometry(600, 72, 300, 144);
  nearSea.rotateX(-Math.PI / 2);
  nearSea.translate(0, SEA_Y, O.z - 62);
  const far = new THREE.Shape([
    new THREE.Vector2(-3200, 0),
    new THREE.Vector2(3200, 0),
    new THREE.Vector2(3200, 3200),
    new THREE.Vector2(-3200, 3200),
  ]);
  far.holes.push(new THREE.Path([new THREE.Vector2(-300, 26), new THREE.Vector2(-300, 98), new THREE.Vector2(300, 98), new THREE.Vector2(300, 26)]));
  const farSea = new THREE.ShapeGeometry(far);
  farSea.rotateX(-Math.PI / 2);
  farSea.translate(0, SEA_Y, O.z);
  for (const g of [nearSea, farSea]) {
    const m = new THREE.Mesh(g, seaMat);
    m.frustumCulled = false;
    m.renderOrder = 1;
    group.add(m);
  }

  // ── boardwalk over the dunes ──
  const wood = new THREE.MeshStandardMaterial({ color: '#a38a6c', roughness: 0.92 });
  {
    const S0 = -1;
    const S1 = 15.5;
    const n = Math.round((S1 - S0) / 0.19);
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.045, 0.165), wood, n);
    const r = TX.rng(5);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const s = S0 + (i + 0.5) * 0.19;
      const slope = Math.atan2(L.walkY(s + 0.1) - L.walkY(s - 0.1), 0.2);
      q.setFromEuler(new THREE.Euler(slope, (r() - 0.5) * 0.02, 0));
      m.compose(new THREE.Vector3((r() - 0.5) * 0.03, L.walkY(s) - 0.03, O.z - s), q, new THREE.Vector3(1, 1, 1));
      planks.setMatrixAt(i, m);
      planks.setColorAt(i, c.setHSL(0.08, 0.2 + r() * 0.1, 0.42 + r() * 0.12));
    }
    group.add(planks);
    // posts and a rope rail along both sides
    const postGeo = new THREE.BoxGeometry(0.09, 1, 0.09);
    const rope = new THREE.MeshStandardMaterial({ color: '#c9b690', roughness: 1 });
    for (const side of [-1, 1]) {
      let prev = null;
      for (let s = S0; s <= S1 + 0.01; s += 2.4) {
        const top = L.walkY(s) + 0.72;
        const bottom = profile(side * 0.8, s) - 0.3;
        const post = new THREE.Mesh(postGeo, wood);
        post.scale.y = top - bottom;
        post.position.set(side * 0.82, (top + bottom) / 2, O.z - s);
        group.add(post);
        const here = new THREE.Vector3(side * 0.82, top - 0.06, O.z - s);
        if (prev) {
          const len = here.distanceTo(prev);
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, len, 5), rope);
          seg.position.copy(here).add(prev).multiplyScalar(0.5);
          seg.position.y -= 0.05; // a little sag
          seg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), here.clone().sub(prev).normalize());
          group.add(seg);
        }
        prev = here;
      }
    }
  }

  // ── dune grass, rocks, a piece of driftwood ──
  {
    const P = planter(group, new THREE.Vector3(0, 0, O.z - 6));
    const geo = duneGrassClump();
    const mat = windy(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), time, 0.45);
    const r = TX.rng(9);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let x = -110; x <= 110; x += 0.85) {
      for (let s = -3; s <= 13; s += 0.85) {
        const px = x + (r() - 0.5) * 0.8;
        const ps = s + (r() - 0.5) * 0.8;
        if (Math.abs(px) < 1.25) continue; // the boardwalk
        const patch = 0.5 + 0.5 * Math.sin(px * 0.31 + ps * 0.2) * Math.sin(px * 0.13 - ps * 0.41);
        if (r() > (1 - ss(5, 12.5, ps)) * (0.25 + 0.65 * patch)) continue;
        const k = 0.75 + r() * 0.75;
        q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, r() * Math.PI * 2, (r() - 0.5) * 0.2));
        m.compose(new THREE.Vector3(px, profile(px, ps) - 0.03, O.z - ps), q, new THREE.Vector3(k, k * (0.8 + r() * 0.5), k));
        P.add('marram', geo, mat, m, null);
      }
    }
    P.build();

    const stone = new THREE.MeshStandardMaterial({ color: '#6b625a', roughness: 0.9 });
    [[19, 37.5, 1.7, 3], [23.5, 35, 1.0, 4], [26, 39, 2.3, 5], [-31, 33.5, 1.3, 6], [-35, 36.5, 2.0, 7], [-38.5, 34, 0.8, 8], [-9, 45, 0.9, 9]].forEach(([x, s, k, seed]) => {
      const rock = new THREE.Mesh(rockGeometry(seed), stone);
      rock.scale.setScalar(k);
      rock.rotation.y = seed;
      rock.position.set(x, profile(x, s) - 0.15 * k, O.z - s);
      group.add(rock);
    });
    const drift = new THREE.CylinderGeometry(0.1, 0.16, 3.1, 8, 8);
    {
      const p = drift.attributes.position;
      for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 1.7) * 0.06);
      drift.computeVertexNormals();
    }
    const log = new THREE.Mesh(drift, new THREE.MeshStandardMaterial({ color: '#a39584', roughness: 0.95 }));
    log.rotation.set(Math.PI / 2 - 0.05, 0, 1.1);
    log.position.set(-6.2, profile(-6.2, 16.5) + 0.07, O.z - 16.5);
    group.add(log);
  }

  // ── gulls wheeling over the water ──
  const gulls = [];
  {
    const white = new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.8 });
    const grey = new THREE.MeshStandardMaterial({ color: '#9aa1a8', roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2b2b2b', roughness: 0.8 });
    const r = TX.rng(31);
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), white);
      bodyM.scale.set(0.9, 0.85, 2.6);
      g.add(bodyM);
      const headM = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), white);
      headM.position.set(0, 0.04, 0.26);
      g.add(headM);
      const wings = [-1, 1].map((sd) => {
        const inner = new THREE.Group();
        inner.position.set(sd * 0.06, 0.02, 0.02);
        const a = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.012, 0.19), grey);
        a.position.x = sd * 0.225;
        inner.add(a);
        const outer = new THREE.Group();
        outer.position.x = sd * 0.45;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.01, 0.15), grey);
        b.position.set(sd * 0.21, 0, -0.02);
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.011, 0.12), dark);
        tip.position.set(sd * 0.36, 0, -0.03);
        outer.add(b, tip);
        inner.add(outer);
        g.add(inner);
        return { inner, outer, sd };
      });
      g.scale.setScalar(1.3);
      group.add(g);
      gulls.push({
        g,
        wings,
        cx: (r() - 0.5) * 50,
        cz: O.z - 40 - r() * 30,
        cy: SEA_Y + 9 + r() * 12,
        rad: 12 + r() * 20,
        speed: (0.12 + r() * 0.08) * (r() < 0.5 ? -1 : 1),
        phase: r() * Math.PI * 2,
        flap: r() * 10,
      });
    }
  }

  // ── the heart and the words, as paths for the stick ──
  const K = 0.215;
  const heartLocal = (t) => [16 * Math.sin(t) ** 3 * K, (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2.5) * K];
  const heartPts = [];
  const heartCum = [0];
  for (let i = 0; i <= 480; i++) {
    heartPts.push(heartLocal((i / 480) * Math.PI * 2));
    if (i) heartCum.push(heartCum[i - 1] + Math.hypot(heartPts[i][0] - heartPts[i - 1][0], heartPts[i][1] - heartPts[i - 1][1]));
  }
  const heartLen = heartCum[heartCum.length - 1];
  // heart-local (x right, y toward the sea) → world
  const W = (lx, ly, out = new THREE.Vector3()) => {
    out.set(H.x + lx, 0, H.z - ly);
    out.y = sandY(out.x, out.z);
    return out;
  };
  const alongPath = (pts, cum, d) => {
    d = Math.max(0, Math.min(cum[cum.length - 1], d));
    let i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    const t = (d - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
  };

  const TEXT_Y = 0.55;
  const text = layoutText(config.beach?.text || 'Me & You', { height: 0.62, maxWidth: 4.6 });
  const steps = [];
  {
    let t = 0;
    let pen = null;
    let anchor = null;
    for (const g of text.glyphs) {
      const want = (g.x0 + g.x1) / 2 - 0.3;
      if (anchor === null) anchor = want;
      else if (Math.abs(want - anchor) > 0.42) {
        steps.push({ kind: 'shuffle', t0: t, dur: 0.85, from: anchor, to: want, a: pen, b: pen });
        t += 0.85;
        anchor = want;
      }
      for (const st of g.strokes) {
        const pts = st.map(([x, y]) => [x, y + TEXT_Y]);
        if (pen) {
          const dur = 0.14 + Math.hypot(pts[0][0] - pen[0], pts[0][1] - pen[1]) / 0.9;
          steps.push({ kind: 'lift', t0: t, dur, a: pen, b: pts[0], anchor });
          t += dur;
        }
        const cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
        const dur = Math.max(0.12, cum[cum.length - 1] / 0.42);
        steps.push({ kind: 'draw', t0: t, dur, pts, cum, anchor });
        t += dur;
        pen = pts[pts.length - 1];
      }
    }
    steps.total = t + 0.4;
  }
  const firstPen = steps.find((s) => s.kind === 'draw').pts[0];
  const lastStep = steps[steps.length - 1];
  const lastPen = lastStep.pts[lastStep.pts.length - 1];
  const firstAnchor = steps.find((s) => s.anchor !== undefined).anchor;
  const lastAnchor = lastStep.anchor;
  function penAt(tw) {
    let st = steps[0];
    for (const s of steps) {
      if (s.t0 <= tw) st = s;
      else break;
    }
    const k = Math.min(1, Math.max(0, (tw - st.t0) / st.dur));
    if (st.kind === 'draw') return { p: alongPath(st.pts, st.cum, k * st.cum[st.cum.length - 1]), down: k < 1 || tw < steps.total - 0.4, anchor: st.anchor, bob: 0 };
    if (st.kind === 'lift') {
      const e = k * k * (3 - 2 * k);
      return { p: [st.a[0] + (st.b[0] - st.a[0]) * e, st.a[1] + (st.b[1] - st.a[1]) * e], down: false, anchor: st.anchor, bob: 0 };
    }
    const e = k * k * (3 - 2 * k);
    return { p: st.a, down: false, anchor: st.from + (st.to - st.from) * e, bob: Math.sin(Math.PI * k) };
  }

  // ── his timeline (seconds) ──
  const KNEEL_Y = -0.18; // heart-local y where he kneels, just below the words
  const WALK_SPEED = 1.25;
  const CYCLE = 1.3; // metres per full stride (two steps)
  const heartDir = (d, out = new THREE.Vector3()) => {
    const a = alongPath(heartPts, heartCum, d - 0.6);
    const b = alongPath(heartPts, heartCum, d + 0.9);
    return out.set(b[0] - a[0], 0, -(b[1] - a[1])).normalize();
  };
  const bodyOnHeart = (d, out = new THREE.Vector3()) => {
    const tip = alongPath(heartPts, heartCum, d);
    const f = heartDir(d);
    W(tip[0], tip[1], out);
    // he walks just outside the line, the stick trailing at his right side
    out.x += f.x * 0.5 - -f.z * 0.42;
    out.z += f.z * 0.5 - f.x * 0.42;
    out.y = sandY(out.x, out.z);
    return out;
  };
  const kneelAt = (anchor, out = new THREE.Vector3()) => W(anchor, KNEEL_Y, out);
  const endSpot = W(0, -1.3);
  const tl = { idle: 1.2 };
  tl.heart = tl.idle + heartLen / WALK_SPEED;
  const walkFrom = bodyOnHeart(heartLen);
  const walkTo = kneelAt(firstAnchor);
  tl.walk = tl.heart + walkFrom.distanceTo(walkTo) / 1.05;
  tl.kneel = tl.walk + 1.4;
  tl.write = tl.kneel + steps.total;
  tl.rise = tl.write + 1.6;
  tl.center = tl.rise + kneelAt(lastAnchor).distanceTo(endSpot) / 0.9 + 0.8;
  tl.end = tl.center + 4.5;
  const marks = { heartEnd: tl.heart / tl.end, kneelEnd: tl.kneel / tl.end, textEnd: tl.write / tl.end };

  // ── drawing into the sand ──
  const line = (pts) => {
    const [x0, y0] = toPx(...pts[0]);
    mctx.beginPath();
    mctx.moveTo(x0, y0);
    for (let i = 1; i < pts.length; i++) mctx.lineTo(...toPx(...pts[i]));
    mctx.stroke();
  };
  const localToXZ = ([lx, ly]) => [H.x + lx, H.z - ly];
  function carve(localPts) {
    if (localPts.length < 2) return;
    const pts = localPts.map(localToXZ);
    mctx.globalCompositeOperation = 'lighten';
    mctx.lineCap = mctx.lineJoin = 'round';
    mctx.strokeStyle = 'rgb(0,110,0)';
    mctx.lineWidth = 13;
    line(pts);
    mctx.strokeStyle = 'rgb(255,0,0)';
    mctx.lineWidth = 4.2;
    line(pts);
  }
  const slice = (pts, cum, d0, d1) => {
    const out = [alongPath(pts, cum, d0)];
    for (let i = 1; i < cum.length - 1; i++) if (cum[i] > d0 && cum[i] < d1) out.push(pts[i]);
    out.push(alongPath(pts, cum, d1));
    return out;
  };
  // footprints left outside the heart while he walks round it
  function footprint(x, z, f) {
    const [px, py] = toPx(x, z);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(Math.atan2(f.x, f.z));
    mctx.globalCompositeOperation = 'lighten';
    const k = MASK_PX / MASK_SIZE;
    mctx.fillStyle = 'rgb(0,70,0)';
    mctx.beginPath();
    mctx.ellipse(0, 0.02 * k, 0.075 * k, 0.16 * k, 0, 0, Math.PI * 2);
    mctx.fill();
    mctx.fillStyle = 'rgb(120,0,0)';
    for (const [oy, rx, ry] of [[0.07, 0.05, 0.065], [-0.07, 0.04, 0.05]]) {
      mctx.beginPath();
      mctx.ellipse(0, oy * k, rx * k, ry * k, 0, 0, Math.PI * 2);
      mctx.fill();
    }
    mctx.restore();
  }
  const fp = new THREE.Vector3();
  const fdir = new THREE.Vector3();
  function steps_(d0, d1) {
    // left foot plants at 0.25 of each stride, right at 0.75
    for (let k = Math.floor(d0 / CYCLE) - 1; k * CYCLE <= d1; k++) {
      for (const [side, off] of [[1, 0.25], [-1, 0.75]]) {
        const d = (k + off) * CYCLE;
        if (d < d0 || d >= d1 || d < 0.3 || d > heartLen - 0.2) continue;
        bodyOnHeart(d, fp);
        heartDir(d, fdir);
        const lx = side * 0.1;
        footprint(fp.x + fdir.z * lx + fdir.x * 0.3, fp.z - fdir.x * lx + fdir.z * 0.3, fdir);
      }
    }
  }
  let drawnTo = 0; // seconds of his timeline already carved
  function carveRange(t0, t1) {
    if (t1 <= t0) return;
    // the heart
    const h0 = Math.max(0, (t0 - tl.idle) * WALK_SPEED);
    const h1 = Math.min(heartLen, (t1 - tl.idle) * WALK_SPEED);
    if (h1 > h0) {
      steps_(h0, h1);
      carve(slice(heartPts, heartCum, h0, h1));
    }
    // the words
    const w0 = t0 - tl.kneel;
    const w1 = t1 - tl.kneel;
    if (w1 > 0) {
      for (const st of steps) {
        if (st.kind !== 'draw' || st.t0 + st.dur < w0 || st.t0 > w1) continue;
        const len = st.cum[st.cum.length - 1];
        const a = Math.max(0, (w0 - st.t0) / st.dur) * len;
        const b = Math.min(1, (w1 - st.t0) / st.dur) * len;
        if (b > a) carve(slice(st.pts, st.cum, a, b));
      }
    }
  }
  function carveTo(t) {
    if (Math.abs(t - drawnTo) < 1e-4) return;
    if (t < drawnTo) {
      mctx.globalCompositeOperation = 'source-over';
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, MASK_PX, MASK_PX);
      carveRange(0, t);
    } else carveRange(drawnTo, t);
    drawnTo = t;
    maskTex.needsUpdate = true;
  }
  mctx.fillStyle = '#000';
  mctx.fillRect(0, 0, MASK_PX, MASK_PX);

  // ── the boy ──
  const boy = createBoy({ ground: sandY });
  group.add(boy.group, boy.stick, boy.shadows);
  const UP = new THREE.Vector3(0, 1, 0);
  const V = () => new THREE.Vector3();
  // a point in his own frame (x = his left, z = forward) → world
  const toW = (B, f, lx, ly, lz) => new THREE.Vector3(B.x + f.z * lx + f.x * lz, B.y + ly, B.z - f.x * lx + f.z * lz);
  const onSand = (v, above) => {
    v.y = sandY(v.x, v.z) + above;
    return v;
  };
  const gripFor = (B, f, tip, hipY, lean) => {
    const sh = toW(B, f, -0.2, hipY + 0.06 + 0.42 * Math.cos(lean), 0.42 * Math.sin(lean));
    const toSh = sh.clone().sub(tip);
    const dd = toSh.length();
    return tip.clone().addScaledVector(toSh.normalize(), Math.min(1.05, Math.max(0.45, dd - 0.5)));
  };
  function standPose(B, f, { tip = null, grip = null, lookAt = null } = {}) {
    const hipY = 0.935;
    const p = {
      x: B.x,
      y: B.y,
      z: B.z,
      heading: Math.atan2(f.x, f.z),
      hipY,
      lean: 0.03,
      twist: 0,
      feet: [onSand(toW(B, f, 0.11, 0, 0.03), 0.075), onSand(toW(B, f, -0.11, 0, -0.02), 0.075)],
      footDir: [f.clone(), f.clone()],
      hands: [toW(B, f, 0.25, 0.8, 0.06), toW(B, f, -0.25, 0.8, 0.06)],
      poles: {
        legL: toW(B, f, 0.2, 0.6, 1.5),
        legR: toW(B, f, -0.2, 0.6, 1.5),
        armL: toW(B, f, 0.7, 1.1, -0.6),
        armR: toW(B, f, -0.7, 1.1, -0.6),
      },
      lookAt: lookAt || toW(B, f, 0, 1.4, 6),
      tip,
      grip,
    };
    if (tip && !grip) p.grip = p.hands[1] = gripFor(B, f, tip, hipY, 0.03);
    else if (grip) p.hands[1] = grip.clone();
    return p;
  }
  function walkPose(B, f, phase, { tip, lookAt }) {
    const hipY = 0.915 + 0.02 * Math.cos(2 * phase);
    const foot = (side, ph) => onSand(toW(B, f, side * 0.1, 0, 0.3 * Math.sin(ph)), 0.075 + 0.11 * Math.max(0, Math.cos(ph)));
    const p = standPose(B, f, { tip, lookAt });
    p.hipY = hipY;
    p.lean = 0.1;
    p.twist = 0.1 * Math.sin(phase);
    p.feet = [foot(1, phase), foot(-1, phase + Math.PI)];
    p.footDir = [f.clone(), f.clone()];
    p.hands[0] = toW(B, f, 0.24, hipY - 0.1, -0.22 * Math.sin(phase));
    p.grip = p.hands[1] = gripFor(B, f, tip, hipY, 0.1);
    return p;
  }
  const SEA = new THREE.Vector3(0, 0, -1);
  function kneelPose(B, pen, bob) {
    const f = SEA;
    const hipY = 0.52 + 0.1 * bob;
    const lean = 0.55 - 0.15 * bob;
    const back = new THREE.Vector3(0, -0.8, 0.6).normalize(); // toes curled under behind him
    const p = {
      x: B.x,
      y: B.y,
      z: B.z,
      heading: Math.PI,
      hipY,
      lean,
      twist: -0.22,
      feet: [onSand(toW(B, f, 0.14, 0, 0.3), 0.075 + 0.05 * bob), onSand(toW(B, f, -0.13, 0, -0.34), 0.09)],
      footDir: [f.clone(), back],
      hands: [onSand(toW(B, f, 0.15, 0, 0.3), 0.6 + 0.05 * bob), null],
      poles: {
        legL: toW(B, f, 0.2, 1.2, 1.2),
        legR: toW(B, f, -0.15, 0.1, 1.5),
        armL: toW(B, f, 0.7, 0.4, 0.2),
        armR: toW(B, f, -0.7, 0.9, -0.2),
      },
      lookAt: pen.clone(),
      tip: pen.clone(),
    };
    p.grip = p.hands[1] = gripFor(B, f, pen, hipY, lean);
    return p;
  }
  const lerpV = (a, b, k) => (a && b ? a.clone().lerp(b, k) : (b || a)?.clone() ?? null);
  function blend(a, b, k) {
    const out = { ...b };
    for (const key of ['x', 'y', 'z', 'hipY', 'lean', 'twist']) out[key] = a[key] + (b[key] - a[key]) * k;
    let dh = b.heading - a.heading;
    dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    out.heading = a.heading + dh * k;
    out.feet = a.feet.map((v, i) => lerpV(v, b.feet[i], k));
    out.footDir = a.footDir.map((v, i) => lerpV(v, b.footDir[i], k).normalize());
    out.hands = a.hands.map((v, i) => lerpV(v, b.hands[i], k));
    out.poles = {};
    for (const key of Object.keys(b.poles)) out.poles[key] = lerpV(a.poles[key], b.poles[key], k);
    out.lookAt = lerpV(a.lookAt, b.lookAt, k);
    out.tip = lerpV(a.tip, b.tip, k);
    out.grip = lerpV(a.grip, b.grip, k);
    return out;
  }
  const ease = (x) => x * x * (3 - 2 * x);
  const penWorld = (pl, down) => onSand(W(pl[0], pl[1]), down ? -0.004 : 0.07);
  // where he leaves the stick standing in the sand when he's done
  const planted = (() => {
    const B = kneelAt(lastAnchor);
    const tip = onSand(toW(B, SEA, -0.62, 0, -0.05), -0.22);
    return { tip, grip: tip.clone().add(new THREE.Vector3(0.04, 1.02, 0.02)) };
  })();
  const pen = new THREE.Vector3();
  const f0 = new THREE.Vector3();
  const B0 = new THREE.Vector3();

  // walking, or — when you stop scrolling — standing where he is, feet together
  const stepping = (B, f, phase, opts, moving) => {
    const w = walkPose(B, f, phase, opts);
    if (moving > 0.999) return w;
    const still = standPose(B, f, opts);
    return blend(still, w, moving);
  };
  function poseAt(tau, viewer, t, moving) {
    if (tau < tl.idle || tau <= 0) {
      // waiting at the top of the heart, stick in the sand, looking out to sea
      bodyOnHeart(0, B0);
      heartDir(0, f0);
      return standPose(B0, f0, { tip: onSand(W(...heartPts[0]), -0.004), lookAt: new THREE.Vector3(B0.x + 3, B0.y, B0.z - 40) });
    }
    if (tau < tl.heart) {
      const d = (tau - tl.idle) * WALK_SPEED;
      bodyOnHeart(d, B0);
      heartDir(d, f0);
      const tipL = alongPath(heartPts, heartCum, d);
      pen.copy(penWorld(tipL, true));
      return stepping(B0, f0, (d / CYCLE) * Math.PI * 2, { tip: pen.clone(), lookAt: pen.clone().addScaledVector(f0, -0.8) }, moving);
    }
    if (tau < tl.walk) {
      // over to where he'll kneel, stick carried
      const k = (tau - tl.heart) / (tl.walk - tl.heart);
      B0.copy(walkFrom).lerp(walkTo, k);
      B0.y = sandY(B0.x, B0.z);
      f0.copy(walkTo).sub(walkFrom).setY(0).normalize();
      f0.lerp(SEA, ease(Math.max(0, k * 2 - 1))).normalize();
      const d = heartLen + walkFrom.distanceTo(walkTo) * k;
      return stepping(B0, f0, (d / CYCLE) * Math.PI * 2, { tip: onSand(toW(B0, f0, -0.35, 0, 0.55), 0.25), lookAt: walkTo.clone().add(new THREE.Vector3(0, 0, -1.5)) }, moving);
    }
    if (tau < tl.write) {
      const tw = Math.max(0, tau - tl.kneel);
      const st = penAt(tw);
      pen.copy(penWorld(st.p, st.down));
      const kneel = kneelPose(kneelAt(st.anchor, B0), pen, st.bob);
      if (tau >= tl.kneel) return kneel;
      // kneeling down
      const k = ease((tau - tl.walk) / (tl.kneel - tl.walk));
      const B = kneelAt(firstAnchor);
      const stand = standPose(B, SEA, { tip: onSand(toW(B, SEA, -0.35, 0, 0.55), 0.25) });
      return blend(stand, kneel, k);
    }
    if (tau < tl.rise) {
      // stands up, leaving the stick standing in the sand
      const k = ease((tau - tl.write) / (tl.rise - tl.write));
      const B = kneelAt(lastAnchor);
      pen.copy(penWorld(lastPen, false));
      const kneel = kneelPose(B, pen, 0);
      const stand = standPose(B, SEA, { lookAt: W(0, 0.6) });
      const a = blend(kneel, stand, k);
      const plant = Math.min(1, k * 1.6);
      a.tip = kneel.tip.clone().lerp(planted.tip, plant);
      a.grip = kneel.grip.clone().lerp(planted.grip, plant);
      a.hands[1] = k < 0.65 ? a.grip.clone() : a.grip.clone().lerp(stand.hands[1], ease((k - 0.65) / 0.35));
      return a;
    }
    if (tau < tl.center) {
      // steps back into the middle of the heart and turns round
      const k = Math.min(1, (tau - tl.rise) / (tl.center - tl.rise - 0.8));
      const from = kneelAt(lastAnchor);
      B0.copy(from).lerp(endSpot, ease(k));
      B0.y = sandY(B0.x, B0.z);
      const dir = endSpot.clone().sub(from).setY(0).normalize();
      const turn = ease(Math.max(0, (tau - tl.rise) / (tl.center - tl.rise)));
      f0.copy(dir).lerp(new THREE.Vector3(0, 0, 1), turn).normalize();
      const d = from.distanceTo(endSpot) * ease(k);
      const w = stepping(B0, f0, (d / CYCLE) * Math.PI * 2, { tip: planted.tip, lookAt: W(0, 0.6) }, moving);
      const still = standPose(B0, f0, { lookAt: W(0, 0.6) });
      const out = blend(w, still, Math.max(0, k * 3 - 2));
      out.tip = planted.tip;
      out.grip = planted.grip;
      out.hands[1] = still.hands[1];
      return out;
    }
    // looks up at the camera and waves
    const f = new THREE.Vector3(0, 0, 1);
    const p = standPose(endSpot, f, { lookAt: viewer.clone() });
    p.tip = planted.tip;
    p.grip = planted.grip;
    const up = ease(Math.min(1, (tau - tl.center) / 0.8));
    const wave = toW(endSpot, f, -0.32 + 0.12 * Math.sin(t * 7), 1.95, 0.1);
    p.hands[1] = p.hands[1].clone().lerp(wave, up);
    p.poles.armR = toW(endSpot, f, -1, 1.2, 0);
    return p;
  }

  // ── the close-up camera: follows the tip of the stick like a camera operator would ──
  const shot = { pos: new THREE.Vector3(), target: new THREE.Vector3(), primed: false };
  // over his right shoulder, a little above: the stick, his hand and the words
  // forming in the sand, with the sea and the low sun beyond
  const OFFSET = new THREE.Vector3(1.45, 1.3, 1.85);
  const LOOK = new THREE.Vector3(-0.3, 0, -0.45);
  const shotFor = (pl) => {
    const p = W(pl[0], pl[1]);
    return { target: p.clone().add(LOOK), pos: p.clone().add(OFFSET) };
  };

  // keyframes for the camera route (tour.js adds these after the garden)
  function shots(portrait) {
    const C = garden.center;
    const look = (pos, target) => {
      const d = target.clone().sub(pos);
      return { yaw: Math.PI * 2 + Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) };
    };
    const at = (x, y, z, target, w, extra = {}) => {
      const pos = new THREE.Vector3(x, y, z);
      return { x, y, z, ...look(pos, target), w, ...extra };
    };
    const sandH = H.y;
    const a = shotFor(firstPen);
    const b = shotFor(lastPen);
    const back = portrait ? 1.35 : 1;
    return [
      { x: 3.9, y: C.y + 2.1, z: garden.arborZ - 0.3, yaw: Math.PI * 2 + 0.1, pitch: -0.03, w: 1.0 },
      { x: 0.5, y: C.y + 1.75, z: garden.gateZ + 2.0, yaw: Math.PI * 2, pitch: 0, w: 1.1, mark: 'gate' },
      { x: 0, y: L.walkY(-1.5) + 1.75, z: O.z + 1.5, yaw: Math.PI * 2, pitch: -0.05, w: 1.4, mark: 'reveal' },
      { x: 0.15, y: L.walkY(4) + 1.7, z: O.z - 4, yaw: Math.PI * 2, pitch: -0.1, w: 1.1 },
      { x: 0.3, y: L.walkY(13.5) + 1.7, z: O.z - 13.5, yaw: Math.PI * 2 - 0.04, pitch: -0.13, w: 1.2 },
      at(H.x - 3.2 * back, sandH + 1.6, H.z + 5.5 * back, H, 1.3, { mark: 'approach' }),
      at(a.pos.x, a.pos.y, a.pos.z, a.target, 1.4, { zoom: 1.3, mark: 'closeA' }),
      at(b.pos.x, b.pos.y, b.pos.z, b.target, 2.4, { zoom: 1.3, mark: 'closeB' }),
      at(H.x + 2.0 * back, sandH + 2.3, H.z + 6.0 * back, H, 1.3, { mark: 'stand' }),
      // the drone lifts off: up and back, tilting down until it's looking straight
      // down on the heart, with the waves washing in at the top of the frame
      at(H.x + 0.6, sandH + 7, H.z + 7 * back, H, 1.5),
      { x: H.x + 0.3, y: sandH + 11 * back, z: H.z + 4.5, yaw: Math.PI * 2 + 0.06, pitch: -1.02, w: 1.5, mark: 'drone' },
      { x: H.x, y: sandH + 15 * back, z: H.z + 4.2, yaw: Math.PI * 2 + 0.08, pitch: -1.14, w: 1.5 },
    ];
  }

  let progress = 0;
  let moving = 0;
  const viewer = new THREE.Vector3();
  return {
    group,
    heart: H,
    shoreZ: L.shoreZ,
    marks,
    shots,
    shot,
    pen,
    // His story follows the scroll exactly: scroll on and he draws and writes,
    // stop and he stops, scroll back and the sand smooths over again.
    update({ dt, t, target, camera, night }) {
      const prev = progress;
      progress += (target - progress) * (1 - Math.exp(-dt * 3.5));
      if (Math.abs(target - progress) < 1e-5) progress = target;
      const tau = progress * tl.end;
      // how briskly he's going: about 1 at a walking pace, easing to 0 when you stop
      const pace = (Math.abs(progress - prev) * tl.end) / Math.max(dt, 1e-3);
      moving += (Math.min(1, pace * 1.3) - moving) * (1 - Math.exp(-dt * 5));
      viewer.copy(camera.position);
      const pose = poseAt(tau, viewer, t, moving);
      pose.breath = 0.014 * Math.sin(t * 1.6); // and he breathes
      boy.pose(pose);
      carveTo(Math.min(tau, tl.write));
      // the close-up follows the stick (smoothly, so it never jitters)
      const want = shotFor(penAt(Math.max(0, tau - tl.kneel)).p);
      if (tau < tl.kneel) Object.assign(want, shotFor(firstPen));
      if (!shot.primed) {
        shot.pos.copy(want.pos);
        shot.target.copy(want.target);
        shot.primed = true;
      }
      const k = 1 - Math.exp(-dt * 2.5);
      shot.pos.lerp(want.pos, k);
      shot.target.lerp(want.target, k);
      // light: the sea's colour follows the evening
      light.value = 1 - 0.75 * night;
      sunVis.value = sunMat.opacity;
      for (const g of gulls) {
        const a = g.phase + t * g.speed;
        g.g.position.set(g.cx + Math.cos(a) * g.rad, g.cy + Math.sin(t * 0.3 + g.phase) * 1.5, g.cz + Math.sin(a) * g.rad);
        // facing along its circle, banked into the turn
        const sgn = Math.sign(g.speed);
        g.g.rotation.set(0, Math.atan2(-Math.sin(a) * sgn, Math.cos(a) * sgn), -sgn * 0.35);
        // mostly gliding, now and then a few wingbeats
        const beat = Math.max(0, Math.sin(t * 0.7 + g.flap)) > 0.6 ? Math.sin(t * 9 + g.flap) : 0.15;
        for (const w of g.wings) {
          w.inner.rotation.z = w.sd * (0.12 + beat * 0.45);
          w.outer.rotation.z = w.sd * (-0.1 + beat * 0.25);
        }
      }
    },
    get progress() {
      return progress;
    },
  };
}
