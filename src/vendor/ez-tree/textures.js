import * as THREE from 'three';

// Trimmed from ez-tree (MIT, see LICENSE): only the oak bark and the oak/ash
// leaf textures ship with this site; any other type falls back to these.
import oakAo from './assets/bark/oak_ao_1k.jpg';
import oakColor from './assets/bark/oak_color_1k.jpg';
import oakNormal from './assets/bark/oak_normal_1k.jpg';
import oakRoughness from './assets/bark/oak_roughness_1k.jpg';
import ashLeaves from './assets/leaves/ash_color.png';
import oakLeaves from './assets/leaves/oak_color.png';

const textureLoader = new THREE.TextureLoader();

const loadTexture = (url, srgb = true) => {
  const texture = textureLoader.load(url);
  texture.premultiplyAlpha = true;
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

let textures = null;
function all() {
  if (!textures) {
    textures = {
      bark: {
        oak: {
          ao: loadTexture(oakAo, false),
          color: loadTexture(oakColor),
          normal: loadTexture(oakNormal, false),
          roughness: loadTexture(oakRoughness, false),
        },
      },
      leaves: {
        ash: loadTexture(ashLeaves),
        oak: loadTexture(oakLeaves),
      },
    };
  }
  return textures;
}

export function getBarkTexture(barkType, fileType, scale = { x: 1, y: 1 }) {
  const set = all().bark[barkType] || all().bark.oak;
  const texture = set[fileType];
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.x = scale.x;
  texture.repeat.y = 1 / scale.y;
  return texture;
}

export function getLeafTexture(leafType) {
  return all().leaves[leafType] || all().leaves.oak;
}

// Resolves once every texture above has finished loading (used by the loader screen).
export function texturesReady() {
  const list = [...Object.values(all().bark.oak), ...Object.values(all().leaves)];
  return Promise.all(
    list.map(
      (t) =>
        new Promise((resolve) => {
          if (t.image && (t.image.complete ?? true) && t.image.width) return resolve();
          const check = () => (t.image && t.image.width ? resolve() : setTimeout(check, 50));
          check();
        }),
    ),
  );
}
