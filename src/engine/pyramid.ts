/**
 * A hand-built blur pyramid: every mip level is downsampled *and* gaussian
 * blurred, so sampling the chain with textureLod reads as true soft blur.
 *
 * The GPU's auto-generated mips are plain box averages — sampling them at a
 * high level shows the bilinear diamond pattern of the tiny level underneath,
 * and a sparse tap kernel over them separates into visible ghost copies. Each
 * level here carries a little more blur than plain halving, which is exactly
 * enough that upsampling it again is smooth.
 */

/** Mip dimensions for a base size, full chain down to 1×1 (WebGL's rule). */
export function mipSizes(width: number, height: number): Array<[number, number]> {
  const sizes: Array<[number, number]> = [[width, height]];
  while (sizes[sizes.length - 1][0] > 1 || sizes[sizes.length - 1][1] > 1) {
    const [w, h] = sizes[sizes.length - 1];
    sizes.push([Math.max(1, w >> 1), Math.max(1, h >> 1)]);
  }
  return sizes;
}

let filterSupport: boolean | null = null;
function canvasFilterSupported(): boolean {
  if (filterSupport === null) {
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.filter = "blur(1px)";
      filterSupport = ctx.filter === "blur(1px)";
    } else {
      filterSupport = false;
    }
  }
  return filterSupport;
}

type PyramidSource = (ImageBitmap | HTMLImageElement | HTMLCanvasElement) & {
  width: number;
  height: number;
};

/**
 * An ImageBitmap and a 2D canvas take different upload paths into WebGL, and
 * browsers disagree on whether a bitmap's baked orientation survives — so a
 * chain headed by the bitmap itself can show its blurred levels upside down.
 * Copying the bitmap into a canvas first sends every level down the same
 * canvas upload path, which keeps the whole chain one way up.
 */
export function bitmapToLevelCanvas(bitmap: ImageBitmap): HTMLCanvasElement | null {
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0);
  return canvas;
}

/**
 * Build the full mip chain for a texture: level 0 is the source untouched,
 * every level below is half-size with a touch of gaussian blur folded in.
 * Assign to `texture.mipmaps` with `generateMipmaps = false`. An empty result
 * means "couldn't build one" — leave the texture on auto-generated mips.
 */
export function buildBlurPyramid(source: PyramidSource): Array<PyramidSource> {
  const sizes = mipSizes(source.width, source.height);
  const levels: Array<PyramidSource> = [source];
  const blur = canvasFilterSupported();
  for (let i = 1; i < sizes.length; i++) {
    const [w, h] = sizes[i];
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // The blur compounds level over level, which is what keeps the deep,
    // heavily-blurred levels free of upsampling structure.
    if (blur && Math.min(w, h) > 2) ctx.filter = "blur(0.6px)";
    ctx.drawImage(levels[i - 1], 0, 0, w, h);
    levels.push(canvas);
  }
  return levels;
}
