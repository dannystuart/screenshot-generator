import { describe, expect, it } from "vitest";
import { BACKDROPS, backdropById } from "./backgrounds";

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("backdrops", () => {
  it("has a unique id for every backdrop", () => {
    const ids = BACKDROPS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has hex stops throughout", () => {
    for (const b of BACKDROPS) {
      for (const stop of b.stops) expect(stop).toMatch(HEX);
    }
  });

  it("has hex glow colours throughout", () => {
    for (const b of BACKDROPS) {
      for (const glow of b.glow ?? []) expect(glow.color).toMatch(HEX);
    }
  });

  it("falls back to the first backdrop for an unknown id", () => {
    expect(backdropById("nope")).toBe(BACKDROPS[0]);
    expect(backdropById("dusk").id).toBe("dusk");
  });
});
