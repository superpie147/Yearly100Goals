// Client-side image compression before upload. Downscales to a max long edge
// and re-encodes as JPEG/WebP so files land comfortably under the 5MB bucket
// limit. Returns a { blob, ext } pair.
const MAX_EDGE = 1600;
const QUALITY = 0.8;
const MAX_BYTES = 5 * 1024 * 1024;

export async function compressImage(file) {
  // GIFs would lose animation on canvas re-encode and are already small enough;
  // pass them through untouched (the bucket allows image/gif).
  if (file.type === 'image/gif') {
    return { blob: file, ext: 'gif' };
  }

  const bitmap = await loadBitmap(file);
  const { width, height } = fit(bitmap.width, bitmap.height, MAX_EDGE);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();

  // Prefer WebP when supported (smaller), else JPEG.
  const preferWebp = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  const mime = preferWebp ? 'image/webp' : 'image/jpeg';
  const ext = preferWebp ? 'webp' : 'jpg';

  let blob = await toBlob(canvas, mime, QUALITY);

  // If somehow still too big, step quality down.
  let q = QUALITY;
  while (blob.size > MAX_BYTES && q > 0.4) {
    q -= 0.15;
    blob = await toBlob(canvas, mime, q);
  }

  return { blob, ext };
}

function fit(w, h, maxEdge) {
  if (w <= maxEdge && h <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / Math.max(w, h);
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

async function loadBitmap(file) {
  if (window.createImageBitmap) {
    try {
      return await createImageBitmap(file);
    } catch (_) {
      /* fall through to <img> path */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('圖片讀取失敗。'));
    };
    img.src = url;
  });
}

function toBlob(canvas, mime, quality) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), mime, quality));
}
