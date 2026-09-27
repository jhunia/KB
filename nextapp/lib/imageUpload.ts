/* ============================================
   Client-side image helpers for product uploads.
   Images are resized + re-encoded in the browser before being
   uploaded to Supabase Storage, so phone photos (often 3–8MB)
   end up as ~100–300KB files.
   ============================================ */

const MAX_DIMENSION = 1400;
const QUALITY = 0.82;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file.')); };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise(resolve => canvas.toBlob(resolve, type, QUALITY));
}

/** Resize to fit within MAX_DIMENSION and re-encode as WebP (JPEG fallback). GIFs are left untouched. */
export async function compressImage(file: Blob): Promise<Blob> {
  if (file.type === 'image/gif') return file;
  const img = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const webp = await canvasToBlob(canvas, 'image/webp');
  const out = webp && webp.type === 'image/webp' ? webp : await canvasToBlob(canvas, 'image/jpeg');
  // Never make a small file bigger by re-encoding it
  return out && out.size < file.size ? out : file;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function extensionFor(type: string): string {
  return ({ 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/avif': 'avif' } as Record<string, string>)[type] || 'bin';
}
