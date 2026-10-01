import * as THREE from 'three';
import { placeholderPhoto } from './textures.js';
import { decodeImageFile } from './imageDecode.js';

const MAX_SIZE = 2048; // photos are downscaled to this on the GPU (the lightbox shows the original)
const ASPECTS = [0.8, 1.5, 1.25, 0.75, 1.4, 1];

export async function loadFonts() {
  const fonts = [
    'italic 400 64px "Cormorant Garamond"',
    'italic 500 64px "Cormorant Garamond"',
    '400 64px "Cormorant Garamond"',
    '500 64px "Cormorant Garamond"',
    '600 64px "Cormorant Garamond"',
    '400 32px "Jost"',
    '500 32px "Jost"',
  ];
  try {
    await Promise.race([
      Promise.all(fonts.map((f) => document.fonts.load(f))),
      new Promise((r) => setTimeout(r, 4000)),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

export function photoItems(config) {
  const list = [];
  for (const room of config.rooms) {
    for (const wall of ['left', 'right', 'back']) {
      for (const item of room[wall] || []) if (item.type !== 'text') list.push(item);
    }
  }
  if (config.garden?.photo) list.push(config.garden.photo);
  return list;
}

// animated GIF / WEBP / PNG textures, advanced by updateImageAnimations()
const animations = [];

function toGpuTexture({ canvas, width, height, animation }) {
  let source = canvas;
  if (animation) {
    // a canvas of our own that each new frame is painted into
    source = document.createElement('canvas');
    source.width = canvas.width;
    source.height = canvas.height;
    source.getContext('2d').drawImage(canvas, 0, 0);
  }
  const tex = new THREE.Texture(source);
  tex.colorSpace = THREE.SRGBColorSpace;
  // The renderer clamps this to the device limit; 16 greatly reduces distant
  // shimmer on framed photos viewed down the length of the gallery.
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  if (animation) {
    const total = animation.durations.reduce((a, b) => a + b, 0);
    animations.push({ tex, ctx: source.getContext('2d'), frames: animation.frames, durations: animation.durations, total, shown: 0 });
  }
  return { texture: tex, aspect: width / height };
}

export function updateImageAnimations(nowMs) {
  for (const a of animations) {
    let t = nowMs % a.total;
    let i = 0;
    while (t >= a.durations[i] && i < a.frames.length - 1) t -= a.durations[i++];
    if (i === a.shown) continue;
    a.shown = i;
    a.ctx.clearRect(0, 0, a.ctx.canvas.width, a.ctx.canvas.height);
    a.ctx.drawImage(a.frames[i], 0, 0, a.ctx.canvas.width, a.ctx.canvas.height);
    a.tex.needsUpdate = true;
  }
}

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv)$/i;
export const isVideo = (item) => item.type === 'video' || VIDEO_EXT.test(item.src || '');

// Loads just enough of a video to know its shape; it starts playing (muted,
// looping) when you walk into its room. Resolves to null if the file is missing.
function loadVideo(src) {
  return new Promise((resolve) => {
    const v = document.createElement('video');
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    v.preload = 'auto';
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    v.addEventListener('loadedmetadata', () => {
      if (!v.videoWidth) return done(null);
      const texture = new THREE.VideoTexture(v);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 16;
      // show the first frame on the wall even before it starts playing
      v.addEventListener('loadeddata', () => (texture.needsUpdate = true), { once: true });
      done({ texture, aspect: v.videoWidth / v.videoHeight, url: src, video: v, isVideo: true, placeholder: false });
    });
    v.addEventListener('error', () => done(null));
    setTimeout(() => done(null), 20000);
    v.src = src;
  });
}

// Resolves to Map<item, { texture, aspect, url?, canvas?, video?, isVideo?, placeholder }>
export async function loadPhotos(config, onProgress) {
  const items = photoItems(config);
  const map = new Map();
  let done = 0;
  const tick = () => onProgress(++done / Math.max(1, items.length));

  await Promise.all(
    items.map(
      (item, i) =>
        new Promise((resolve) => {
          const video = isVideo(item);
          const fallback = () => {
            const ph = placeholderPhoto({
              seed: i,
              aspect: item.aspect || (video ? 16 / 9 : ASPECTS[i % ASPECTS.length]),
              label: video ? 'Your video here' : 'Your photo here',
              hint: item.src ? `public/${item.src}` : 'set a src in config.js',
            });
            map.set(item, { texture: ph.texture, aspect: ph.aspect, canvas: ph.canvas, placeholder: true, isVideo: video });
            tick();
            resolve();
          };
          if (!item.src) return fallback();
          if (video) {
            loadVideo(item.src).then((asset) => {
              if (!asset) return fallback();
              map.set(item, asset);
              tick();
              resolve();
            });
            return;
          }
          decodeImageFile(item.src, MAX_SIZE)
            .then((decoded) => {
              map.set(item, {
                ...toGpuTexture(decoded),
                // formats the browser can't show directly (HEIC, TIFF) use the decoded copy in the lightbox
                url: decoded.displayable ? item.src : null,
                canvas: decoded.canvas,
                placeholder: false,
              });
              tick();
              resolve();
            })
            .catch((err) => {
              if (!String(err.message).startsWith('missing')) console.warn('[gallery]', err.message);
              fallback();
            });
        }),
    ),
  );
  if (!items.length) onProgress(1);
  return map;
}
