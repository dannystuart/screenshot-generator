import { describe, expect, it } from "vitest";
import { CANVAS_META, DEFAULT_LAYER, DEFAULT_SPEC, LAYER_META, coerceSpec } from "./spec";

describe("coerceSpec", () => {
  it("returns defaults for garbage", () => {
    expect(coerceSpec(null)).toEqual(DEFAULT_SPEC);
    expect(coerceSpec("nope")).toEqual(DEFAULT_SPEC);
  });
  it("clamps numbers into their meta range", () => {
    const spec = coerceSpec({ ...DEFAULT_SPEC, bgBlur: 99, layers: [{ ...DEFAULT_LAYER, zoom: -5 }] });
    expect(spec.bgBlur).toBe(CANVAS_META.bgBlur.kind === "number" ? CANVAS_META.bgBlur.max : 1);
    expect(spec.layers[0].zoom).toBe(LAYER_META.zoom.kind === "number" ? LAYER_META.zoom.min : 0.2);
  });
  it("rejects unknown enum values", () => {
    const spec = coerceSpec({ ...DEFAULT_SPEC, layers: [{ ...DEFAULT_LAYER, frame: "sparkly" }] });
    expect(spec.layers[0].frame).toBe(DEFAULT_LAYER.frame);
  });
  it("keeps 1..3 layers", () => {
    expect(coerceSpec({ ...DEFAULT_SPEC, layers: [] }).layers).toHaveLength(1);
    const four = coerceSpec({ ...DEFAULT_SPEC, layers: [DEFAULT_LAYER, DEFAULT_LAYER, DEFAULT_LAYER, DEFAULT_LAYER] });
    expect(four.layers).toHaveLength(3);
  });
  it("sanitises colours", () => {
    const spec = coerceSpec({ ...DEFAULT_SPEC, backdropColor: "javascript:alert(1)" });
    expect(spec.backdropColor).toBe(DEFAULT_SPEC.backdropColor);
  });
  it("allows deep zoom and wide moves after round 2", () => {
    const spec = coerceSpec({ layers: [{ zoom: 8, x: -3, y: 3 }] });
    expect(spec.layers[0].zoom).toBe(8);
    expect(spec.layers[0].x).toBe(-3);
    expect(spec.layers[0].y).toBe(3);
    const clamped = coerceSpec({ layers: [{ zoom: 20, x: -5 }] });
    expect(clamped.layers[0].zoom).toBe(8);
    expect(clamped.layers[0].x).toBe(-3);
  });
  it("carries the round-2 shot fields with sane defaults", () => {
    const spec = coerceSpec({});
    expect(spec.layers[0].glowInner).toBe(0.25);
  });
  it("coerces retired fade texture styles back to smooth", () => {
    // Only smooth ships now; old saved dissolves fall back rather than crash.
    expect(coerceSpec({ layers: [{ fadeTexture: "dots" }] }).layers[0].fadeTexture).toBe("smooth");
    expect(coerceSpec({ layers: [{ fadeTexture: "nope" }] }).layers[0].fadeTexture).toBe("smooth");
  });
  it("migrates the old uploaded-image background mode to upload", () => {
    expect(coerceSpec({ background: "image", backgroundKey: "k1" }).background).toBe("upload");
    expect(coerceSpec({ background: "image" }).background).toBe("image");
  });
  it("coerces the round-2 focus fields", () => {
    const spec = coerceSpec({ layers: [{ focusMode: "band", focusBand: 0.4, focusSize: 0.5, blurStyle: "lens" }] });
    expect(spec.layers[0].focusMode).toBe("band");
    expect(spec.layers[0].blurStyle).toBe("lens");
    expect(coerceSpec({}).layers[0].focusMode).toBe("point");
  });
});
