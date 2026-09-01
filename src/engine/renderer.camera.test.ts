import { describe, expect, it } from "vitest";
import { cameraDistance } from "./renderer";

describe("cameraDistance", () => {
  it("keeps a 2-unit-tall world exactly filling the frame at any lens", () => {
    // At the returned distance the visible half-height is 1, so the canvas
    // (2 units tall) fills the view whatever the FOV — drama, not size.
    for (const fov of [8, 30, 45, 70]) {
      const d = cameraDistance(fov);
      const halfHeight = d * Math.tan(((fov / 2) * Math.PI) / 180);
      expect(halfHeight).toBeCloseTo(1, 6);
    }
  });

  it("dollies the camera closer as the lens widens", () => {
    expect(cameraDistance(60)).toBeLessThan(cameraDistance(20));
  });
});
