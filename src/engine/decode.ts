/**
 * Decode any image source to a vertically-flipped canvas the engine can texture
 * with directly — the engine's `flipY = false` convention (see renderer.ts).
 *
 * This deliberately avoids `createImageBitmap` altogether. That API is where the
 * background images kept dying on some browsers: older Safari can't decode a
 * WebP *blob* through it, and the `imageOrientation` option isn't universally
 * honoured — yet the very same file shows fine in an <img>. So we go through an
 * <img> (widest format support there is, and exactly what three.js's own
 * TextureLoader uses for the bundled demo, which loads everywhere) and flip on a
 * 2D canvas by hand. If the browser can *show* the picture, it can texture it.
 */

/** Bigger than this and the GPU upload and the export both start to hurt. */
const MAX_PIXELS = 32_000_000; // 32 megapixels

/** A decoded, pre-flipped image ready to hand straight to the engine. */
export type DecodedImage = HTMLCanvasElement;

function loadImageEl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("The image could not be loaded."));
    img.src = url;
  });
}

function flipToCanvas(img: HTMLImageElement): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't read that image.");
  // Flip vertically so the texture reads upright with flipY off.
  ctx.translate(0, canvas.height);
  ctx.scale(1, -1);
  ctx.drawImage(img, 0, 0);
  return canvas;
}

/** A same-origin URL (a curated background), decoded and flipped. */
export async function decodeUrlFlipped(url: string): Promise<DecodedImage> {
  return flipToCanvas(await loadImageEl(url));
}

/** A blob from storage (an image someone uploaded earlier), decoded and flipped. */
export async function decodeBlobFlipped(blob: Blob): Promise<DecodedImage> {
  const url = URL.createObjectURL(blob);
  try {
    return await decodeUrlFlipped(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * A dropped or picked file, turned into a flipped canvas the engine can texture
 * with — or a clear error to toast. Rejects non-images and absurdly large ones.
 */
export async function decodeFileFlipped(file: File): Promise<DecodedImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That's not an image — drop a PNG, JPG or WebP.");
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImageEl(url);
    if (img.naturalWidth * img.naturalHeight > MAX_PIXELS) {
      throw new Error("That image is enormous — try one under 32 megapixels.");
    }
    return flipToCanvas(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}
