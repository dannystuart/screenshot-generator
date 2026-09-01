/**
 * Cover-fit UV for a background image: the transform that maps the canvas's
 * 0..1 UV onto the middle of the image so it fills the frame with no stretch,
 * cropping the overflowing axis evenly — CSS `background-size: cover`, in a
 * shader. Sample as `uv * scale + offset`.
 */
export function coverUv(
  imageW: number,
  imageH: number,
  canvasW: number,
  canvasH: number,
): { scale: [number, number]; offset: [number, number] } {
  const imageAspect = imageW / imageH;
  const canvasAspect = canvasW / canvasH;
  if (imageAspect > canvasAspect) {
    const sx = canvasAspect / imageAspect;
    return { scale: [sx, 1], offset: [(1 - sx) / 2, 0] };
  }
  const sy = imageAspect / canvasAspect;
  return { scale: [1, sy], offset: [0, (1 - sy) / 2] };
}

/**
 * Contain-fit the preview canvas inside the stage: the largest ratioW:ratioH
 * rectangle that fits, centred, so the whole canvas shows on the ink with
 * letterboxing — what you see is exactly what exports.
 */
export function fitContain(
  stageW: number,
  stageH: number,
  ratioW: number,
  ratioH: number,
): { w: number; h: number } {
  const targetAspect = ratioW / ratioH;
  const stageAspect = stageW / stageH;
  return targetAspect > stageAspect
    ? { w: stageW, h: stageW / targetAspect }
    : { w: stageH * targetAspect, h: stageH };
}
