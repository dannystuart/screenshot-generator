import { DEFAULT_LAYER, DEFAULT_SPEC, coerceSpec } from "@/engine/spec";
import type { LayerSpec, Spec } from "@/engine/spec";

/**
 * A scene as a link — a saveable, shareable template.
 *
 * Only what differs from the defaults travels, so a fresh scene is a bare URL
 * and a tuned one is a few hundred characters. It rides in the hash, so the
 * page stays one static page whatever is in it and nothing reaches a server.
 *
 * Uploaded pictures live in this browser's storage and can't ride along, so the
 * link carries the settings, not the pixels: a shared "upload" background falls
 * back to a preset, and a shared shot opens on the demo image.
 */
const KEY = "s";

function encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decode(text: string): string {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Fields that point at browser-local blobs, which can't travel in a link. */
function stripImages(spec: Spec): Spec {
  const layers = spec.layers.map((l) => ({ ...l, imageKey: "" }));
  const background = spec.background === "upload" ? "preset" : spec.background;
  return { ...spec, background, backgroundKey: "", layers };
}

/** Only a layer's changed fields, so the URL stays short. */
function diffLayer(layer: LayerSpec): Partial<LayerSpec> {
  const diff: Partial<LayerSpec> = {};
  for (const key of Object.keys(DEFAULT_LAYER) as (keyof LayerSpec)[]) {
    if (key === "id") continue;
    if (layer[key] !== DEFAULT_LAYER[key]) (diff as Record<string, unknown>)[key] = layer[key];
  }
  return diff;
}

export function toShareHash(spec: Spec): string {
  const clean = stripImages(spec);
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_SPEC) as (keyof Spec)[]) {
    if (key === "layers") continue;
    if (clean[key] !== DEFAULT_SPEC[key]) diff[key] = clean[key];
  }
  const layers = clean.layers.map(diffLayer);
  if (clean.layers.length !== 1 || layers.some((l) => Object.keys(l).length)) diff.layers = layers;
  return Object.keys(diff).length ? `#${KEY}=${encode(JSON.stringify(diff))}` : "";
}

export function toShareUrl(spec: Spec, base: string): string {
  return base.split("#")[0] + toShareHash(spec);
}

/** The spec a hash carries, or null when it carries none (or nonsense). */
export function fromShareHash(hash: string): Spec | null {
  const match = hash.match(new RegExp(`[#&]${KEY}=([A-Za-z0-9_-]+)`));
  if (!match) return null;
  try {
    return coerceSpec(JSON.parse(decode(match[1])));
  } catch {
    return null;
  }
}
