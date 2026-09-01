import { describe, expect, it } from "vitest";
import { DEFAULT_SPEC, coerceSpec } from "@/engine/spec";
import { fromShareHash, toShareHash, toShareUrl } from "./share";

describe("share links", () => {
  it("a default scene makes a bare link", () => {
    expect(toShareHash(DEFAULT_SPEC)).toBe("");
    expect(toShareUrl(DEFAULT_SPEC, "https://x.dev/tool")).toBe("https://x.dev/tool");
  });

  it("round-trips a tuned scene through the hash", () => {
    const spec = coerceSpec(DEFAULT_SPEC);
    spec.background = "solid";
    spec.backdropColor = "#123456";
    spec.perspective = 55;
    spec.layers[0] = { ...spec.layers[0], rotX: 20, rotY: -30, edgeLight: 0.6, edgeLightSpread: 0.2, saturation: 1.4 };
    const url = toShareUrl(spec, "https://x.dev/tool");
    expect(url).toContain("#s=");
    const back = fromShareHash(new URL(url).hash);
    expect(back).not.toBeNull();
    expect(back!.background).toBe("solid");
    expect(back!.backdropColor).toBe("#123456");
    expect(back!.perspective).toBe(55);
    expect(back!.layers[0].rotX).toBe(20);
    expect(back!.layers[0].rotY).toBe(-30);
    expect(back!.layers[0].edgeLight).toBeCloseTo(0.6);
    expect(back!.layers[0].edgeLightSpread).toBeCloseTo(0.2);
    expect(back!.layers[0].saturation).toBeCloseTo(1.4);
  });

  it("drops browser-local pictures, since they can't travel", () => {
    const spec = coerceSpec(DEFAULT_SPEC);
    spec.background = "upload";
    spec.backgroundKey = "idb-key-123";
    spec.layers[0] = { ...spec.layers[0], imageKey: "idb-shot-456", rotZ: 10 };
    const back = fromShareHash(new URL(toShareUrl(spec, "https://x.dev")).hash)!;
    expect(back.background).toBe("preset"); // upload falls back
    expect(back.backgroundKey).toBe("");
    expect(back.layers[0].imageKey).toBe(""); // demo shot, not the missing upload
    expect(back.layers[0].rotZ).toBe(10); // the settings still travel
  });

  it("carries extra shots", () => {
    const spec = coerceSpec(DEFAULT_SPEC);
    spec.layers = [spec.layers[0], { ...spec.layers[0], id: "b", rotX: 15 }];
    const back = fromShareHash(new URL(toShareUrl(spec, "https://x.dev")).hash)!;
    expect(back.layers).toHaveLength(2);
    expect(back.layers[1].rotX).toBe(15);
  });

  it("returns null for junk", () => {
    expect(fromShareHash("")).toBeNull();
    expect(fromShareHash("#s=not-valid-base64!!")).toBeNull();
    expect(fromShareHash("#other=1")).toBeNull();
  });
});
