import { describe, expect, it } from "vitest";
import { RATIOS, sizeFor } from "./ratios";

describe("ratios", () => {
  it("sizes 16:9 as 1920×1080", () => {
    expect(sizeFor("16:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("keeps the short side at 1080 for a portrait 9:16", () => {
    expect(sizeFor("9:16")).toEqual({ width: 1080, height: 1920 });
  });

  it("respects a custom base", () => {
    expect(sizeFor("16:9", 1280)).toEqual({ width: 1280, height: 720 });
  });

  it("falls back to a square for an unknown ratio", () => {
    expect(sizeFor("banana", 1000)).toEqual({ width: 1000, height: 1000 });
  });

  it("has unique ids and a label each", () => {
    const ids = RATIOS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(RATIOS.every((r) => r.label.length > 0)).toBe(true);
  });
});
