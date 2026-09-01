import { Matrix4, Vector3 } from "three";

/**
 * The view-space depth of the sharp point.
 *
 * Lifts the focus point (0..1 across the image rect, y down) into the shot's
 * local space, out to world through the mesh matrix, then into the camera's
 * view space — and returns its distance in front of the lens. The card shader
 * blurs each pixel by how far its own depth strays from this one, which is what
 * a real lens does: a tilted shot is sharp along one line and softens away
 * from it. Pure, so it can be checked without a GPU.
 */
export function focusViewZ(
  meshMatrixWorld: Matrix4,
  cameraMatrixWorldInverse: Matrix4,
  focusX: number,
  focusY: number,
  cardHalf: [number, number],
): number {
  const point = new Vector3((2 * focusX - 1) * cardHalf[0], (1 - 2 * focusY) * cardHalf[1], 0);
  point.applyMatrix4(meshMatrixWorld);
  point.applyMatrix4(cameraMatrixWorldInverse);
  return -point.z;
}
