import { describe, expect, it } from "vitest";
import { mipSizes } from "./pyramid";

describe("mipSizes", () => {
  it("halves each level down to 1×1, WebGL style", () => {
    expect(mipSizes(8, 4)).toEqual([
      [8, 4],
      [4, 2],
      [2, 1],
      [1, 1],
    ]);
  });

  it("matches floor(base / 2^level) for odd sizes", () => {
    const sizes = mipSizes(1000, 750);
    sizes.forEach(([w, h], i) => {
      expect(w).toBe(Math.max(1, Math.floor(1000 / 2 ** i)));
      expect(h).toBe(Math.max(1, Math.floor(750 / 2 ** i)));
    });
    expect(sizes[sizes.length - 1]).toEqual([1, 1]);
  });

  it("handles a 1×1 source", () => {
    expect(mipSizes(1, 1)).toEqual([[1, 1]]);
  });
});
