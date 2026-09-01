import { describe, expect, it } from "vitest";
import { Matrix4, PerspectiveCamera } from "three";
import { focusViewZ } from "./focus";

/** A camera at (0,0,dist) looking at the origin, as its view (inverse) matrix. */
function cameraInverse(dist: number): Matrix4 {
  const cam = new PerspectiveCamera(50, 1, 0.1, 100);
  cam.position.set(0, 0, dist);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  return cam.matrixWorldInverse.clone();
}

const HALF: [number, number] = [0.3125, 0.3125];

describe("focusViewZ", () => {
  it("is the camera distance for a flat card facing the lens", () => {
    const z = focusViewZ(new Matrix4(), cameraInverse(3), 0.5, 0.5, HALF);
    expect(z).toBeCloseTo(3, 6);
  });

  it("does not move with the focus point while the card is flat", () => {
    const inv = cameraInverse(3);
    const a = focusViewZ(new Matrix4(), inv, 0.1, 0.2, HALF);
    const b = focusViewZ(new Matrix4(), inv, 0.9, 0.8, HALF);
    expect(a).toBeCloseTo(b, 6);
  });

  it("separates top from bottom once the card is tilted", () => {
    // Tilt about x: the top leans toward the camera and the bottom away, so the
    // two edges sit at different depths — which is the whole point of the blur.
    const tilt = new Matrix4().makeRotationX((40 * Math.PI) / 180);
    const inv = cameraInverse(3);
    const top = focusViewZ(tilt, inv, 0.5, 0.0, HALF);
    const bottom = focusViewZ(tilt, inv, 0.5, 1.0, HALF);
    expect(Math.abs(top - bottom)).toBeGreaterThan(0.1);
  });
});
