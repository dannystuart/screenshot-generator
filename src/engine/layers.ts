import type { LayerSpec } from "./spec";

const rad = (deg: number) => (deg * Math.PI) / 180;

/** How far each shot steps toward the camera, so a later shot sits in front. */
const DEPTH_STEP = 0.12;

export interface LayerTransform {
  /** World position; z steps toward the camera with the index. */
  position: [number, number, number];
  /** Radians, from the degree dials. */
  rotation: [number, number, number];
  /** The zoom dial, applied on top of the card's own size. */
  scale: number;
}

/**
 * Where a shot sits and how it is turned. Pure so the stacking and the
 * degree→radian conversion can be checked without a GPU. The centre offset is
 * in half-canvas-height units, matching the spec's -1..1 range.
 */
export function layerTransform(layer: LayerSpec, index: number): LayerTransform {
  return {
    position: [layer.x, layer.y, index * DEPTH_STEP],
    rotation: [rad(layer.rotX), rad(layer.rotY), rad(layer.rotZ)],
    scale: layer.zoom,
  };
}
