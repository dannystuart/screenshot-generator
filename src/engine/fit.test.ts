import { describe, expect, it } from "vitest";
import { coverUv, fitContain } from "./fit";

describe("coverUv", () => {
  it("crops a wide image left and right, evenly", () => {
    // A 2:1 image on a 1:1 canvas samples the middle half across.
    const { scale, offset } = coverUv(2000, 1000, 1000, 1000);
    expect(scale[0]).toBeCloseTo(0.5, 6);
    expect(scale[1]).toBe(1);
    expect(offset[0]).toBeCloseTo(0.25, 6);
    expect(offset[1]).toBe(0);
  });

  it("crops a tall image top and bottom, evenly", () => {
    const { scale, offset } = coverUv(1000, 2000, 1000, 1000);
    expect(scale[1]).toBeCloseTo(0.5, 6);
    expect(scale[0]).toBe(1);
    expect(offset[1]).toBeCloseTo(0.25, 6);
    expect(offset[0]).toBe(0);
  });

  it("leaves a matched aspect untouched", () => {
    const { scale, offset } = coverUv(800, 600, 1600, 1200);
    expect(scale).toEqual([1, 1]);
    expect(offset).toEqual([0, 0]);
  });
});

describe("fitContain", () => {
  it("letterboxes a wide ratio into the stage", () => {
    expect(fitContain(1000, 800, 16, 9)).toEqual({ w: 1000, h: 562.5 });
  });

  it("pillarboxes a tall ratio into the stage", () => {
    expect(fitContain(1000, 800, 9, 16)).toEqual({ w: 450, h: 800 });
  });
});
