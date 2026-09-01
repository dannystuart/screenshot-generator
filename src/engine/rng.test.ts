import { describe, expect, it } from "vitest";
import { mulberry32 } from "./rng";

describe("mulberry32", () => {
  it("repeats exactly for the same seed", () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("stays in [0, 1)", () => {
    const r = mulberry32(42);
    for (let i = 0; i < 200; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("gives a different sequence for a different seed", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});
