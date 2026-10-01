// Turns any image file into something WebGL can draw, whatever its format.
//
//  • JPG, PNG, WEBP, AVIF, BMP, ICO, GIF: decoded natively by the browser
//  • animated GIF / WEBP / PNG: every frame is decoded so it moves on the wall
//  • SVG: rendered at a sharp size
//  • HEIC / HEIF (iPhone photos): native where supported, otherwise converted
//    in the browser (the converter is only downloaded if you actually use one)
//  • TIFF: decoded in the browser (small decoder, also only loaded when needed)
//
// The format is detected from the file's bytes, not its name, so a wrong or
// UPPERCASE extension doesn't matter.

const MAX_ANIM = 768; // animated images are kept smaller to save memory
const MAX_FRAMES = 240;

const ascii = (b, from, to) => String.fromCharCode(...b.subarray(from, to));

export function sniff(bytes) {
  const b = bytes;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { kind: 'jpeg', mime: 'image/jpeg' };
  if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return { kind: 'png', mime: 'image/png' };
  if (ascii(b, 0, 4) === 'GIF8') return { kind: 'gif', mime: 'image/gif' };
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { kind: 'webp', mime: 'image/webp' };
  if (ascii(b, 0, 2) === 'BM') return { kind: 'bmp', mime: 'image/bmp' };
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return { kind: 'ico', mime: 'image/x-icon' };
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 42 && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 42)) {
    return { kind: 'tiff', mime: 'image/tiff' };
  }
  if ((b[0] === 0xff && b[1] === 0x0a) || ascii(b, 4, 8) === 'JXL ') return { kind: 'jxl', mime: 'image/jxl' };
  if (ascii(b, 4, 8) === 'ftyp') {
    // ISO media: AVIF or HEIC. Check the major + compatible brands.
    const size = Math.min(b.length, (b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]);
    const brands = [];
    for (let i = 8; i + 4 <= size; i += 4) if (i !== 12) brands.push(ascii(b, i, i + 4));
    if (brands.some((x) => x === 'avif' || x === 'avis')) return { kind: 'avif', mime: 'image/avif' };
    if (brands.some((x) => ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(x))) {
      return { kind: 'heic', mime: 'image/heic' };
    }
  }
  const head = new TextDecoder().decode(b.subarray(0, 1024)).trimStart().toLowerCase();
  if (head.startsWith('<!doctype html') || head.startsWith('<html')) return { kind: 'missing' }; // dev server's "not found" page
  if (head.includes('<svg')) return { kind: 'svg', mime: 'image/svg+xml' };
  return { kind: 'unknown', mime: '' };
}

function toCanvas(source, w, h, max) {
  const scale = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * scale));
  c.height = Math.max(1, Math.round(h * scale));
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
  return c;
}

async function bitmapFrom(blob) {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
  } catch {
    return null;
  }
}

function imageFrom(blob) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function decodeAnimation(bytes, mime) {
  if (typeof ImageDecoder === 'undefined') return null;
  try {
    if (!(await ImageDecoder.isTypeSupported(mime))) return null;
    const decoder = new ImageDecoder({ data: bytes, type: mime });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    if (!track || !track.animated || track.frameCount < 2) {
      decoder.close();
      return null;
    }
    const count = Math.min(track.frameCount, MAX_FRAMES);
    const frames = [];
    const durations = [];
    let w = 0;
    let h = 0;
    for (let i = 0; i < count; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      w = image.displayWidth;
      h = image.displayHeight;
      frames.push(toCanvas(image, w, h, MAX_ANIM));
      durations.push(Math.max(20, (image.duration || 100000) / 1000));
      image.close();
    }
    decoder.close();
    return { frames, durations, width: w, height: h };
  } catch {
    return null;
  }
}

async function decodeHeic(blob) {
  // Safari (and anything else that can) decodes HEIC natively
  const native = await bitmapFrom(blob);
  if (native) return native;
  const { default: heic2any } = await import('heic2any');
  const out = await heic2any({ blob, toType: 'image/jpeg', quality: 0.92 });
  return bitmapFrom(Array.isArray(out) ? out[0] : out);
}

async function decodeTiff(buffer) {
  const mod = await import('utif');
  const UTIF = mod.default || mod;
  const ifds = UTIF.decode(buffer);
  const page = ifds.find((i) => i.t256 && i.t257) || ifds[0];
  UTIF.decodeImage(buffer, page, ifds);
  const rgba = UTIF.toRGBA8(page);
  const c = document.createElement('canvas');
  c.width = page.width;
  c.height = page.height;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.length), page.width, page.height), 0, 0);
  return c;
}

// Returns { canvas, width, height, displayable, animation } or throws if the file
// is missing or can't be decoded. `displayable` tells the lightbox whether the
// browser can show the original file directly.
export async function decodeImageFile(url, maxSize = 2048) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`missing: ${url}`);
  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const { kind, mime } = sniff(bytes);
  if (kind === 'missing') throw new Error(`missing: ${url}`);
  const blob = new Blob([bytes], { type: mime || res.headers.get('content-type') || '' });

  if (['gif', 'webp', 'png', 'avif'].includes(kind)) {
    const anim = await decodeAnimation(bytes, mime);
    if (anim) return { canvas: anim.frames[0], width: anim.width, height: anim.height, displayable: true, animation: anim };
  }

  let source = null;
  let displayable = true;
  if (kind === 'heic') {
    source = await decodeHeic(blob);
    displayable = false;
  } else if (kind === 'tiff') {
    source = await decodeTiff(buffer);
    displayable = false;
  } else if (kind === 'svg') {
    const img = await imageFrom(blob);
    if (img) {
      // SVGs can be tiny; render them big enough to stay sharp on the wall
      const w = img.naturalWidth || 1024;
      const h = img.naturalHeight || 1024;
      const up = Math.max(1, 1600 / Math.max(w, h));
      source = toCanvas(img, w * up, h * up, maxSize);
    }
  } else {
    source = (await bitmapFrom(blob)) || (await imageFrom(blob));
  }
  if (!source) throw new Error(`unsupported image: ${url}`);
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const canvas = source instanceof HTMLCanvasElement && Math.max(w, h) <= maxSize ? source : toCanvas(source, w, h, maxSize);
  if (source.close) source.close();
  return { canvas, width: w, height: h, displayable, animation: null };
}
