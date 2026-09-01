import { describe, expect, it } from "vitest";
import { DEFAULT_LAYER } from "./spec";
import { layerTransform } from "./layers";

describe("layerTransform", () => {
  it("converts the tilt dials from degrees to radians", () => {
    const t = layerTransform({ ...DEFAULT_LAYER, rotX: 90, rotY: -45, rotZ: 180 }, 0);
    expect(t.rotation[0]).toBeCloseTo(Math.PI / 2, 6);
    expect(t.rotation[1]).toBeCloseTo(-Math.PI / 4, 6);
    expect(t.rotation[2]).toBeCloseTo(Math.PI, 6);
  });

  it("stacks later shots toward the camera", () => {
    const z0 = layerTransform(DEFAULT_LAYER, 0).position[2];
    const z1 = layerTransform(DEFAULT_LAYER, 1).position[2];
    const z2 = layerTransform(DEFAULT_LAYER, 2).position[2];
    expect(z1).toBeGreaterThan(z0);
    expect(z2).toBeGreaterThan(z1);
  });

  it("carries the centre offset and zoom through", () => {
    const t = layerTransform({ ...DEFAULT_LAYER, x: 0.3, y: -0.2, zoom: 1.5 }, 0);
    expect(t.position[0]).toBe(0.3);
    expect(t.position[1]).toBe(-0.2);
    expect(t.scale).toBe(1.5);
  });
});
