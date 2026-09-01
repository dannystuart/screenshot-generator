/**
 * One canvas, one recipe.
 *
 * Everything on screen is this one serialisable object: a handful of canvas-wide
 * fields plus up to three shots. The preview and the exported PNG are both drawn
 * from it by the same engine. Keys are the engine's words and never change; the
 * labels people read live in CANVAS_META / LAYER_META below.
 */
export type Section = "canvas" | "background" | "angle" | "focus" | "adjustments" | "frame" | "shadow" | "effects";

export type FrameStyle =
  | "none"
  | "line"
  | "border"
  | "glassLight"
  | "glassDark"
  | "insetLight"
  | "insetDark"
  | "neon";
export type FocusMode = "point" | "band";
export type BlurStyle = "soft" | "lens";
export type FadeMode = "none" | "fade" | "melt";
export type EdgeLightMode = "behind" | "front";
export type FadeTexture = "smooth" | "grain" | "dots" | "ascii" | "lines" | "pixels";
/** preset = curated gradient, image = curated picture, upload = the user's own. */
export type BackgroundMode = "preset" | "image" | "upload" | "solid" | "transparent";

/** One shot on the canvas. Index 0 is drawn furthest back. */
export interface LayerSpec {
  /** Stable — keys the IndexedDB image record. */
  id: string;
  /** "" = the bundled demo image. */
  imageKey: string;
  /** Centre offset, fractions of canvas height, -3..3. */
  x: number;
  y: number;
  /** 0.2..8. */
  zoom: number;
  /** Degrees. Tilt up/down, tilt left/right, and roll. */
  rotX: number;
  rotY: number;
  rotZ: number;
  /** Aperture, 0..1 — how fast things fall out of focus away from the sharp point. */
  blur: number;
  /** 0..1 across (x) and down (y) the shot: the point that stays sharp. */
  focusX: number;
  focusY: number;
  /** Point keeps one spot sharp; band is a tilt-shift strip. */
  focusMode: FocusMode;
  /** Band mode: strip height, 0..1 of the shot. */
  focusBand: number;
  /** How large the fully-sharp zone is before falloff, 0..1. */
  focusSize: number;
  /** Lens blur blooms bright spots into discs. */
  blurStyle: BlurStyle;
  /** Corner rounding, 0..0.5 of the shot's short side. */
  radius: number;
  frame: FrameStyle;
  /** 0..0.05 of the shot's short side. */
  frameWidth: number;
  /** How solid the frame band is, 0..1 — 1 is opaque, low lets the scene through. */
  frameOpacity: number;
  frameColor1: string;
  frameColor2: string;
  /** Outer neon glow, and how far it spreads. 0..1 each. */
  glow: number;
  glowSpread: number;
  /** Frame light washing onto the image edges, 0..1. */
  glowInner: number;
  /** Soft drop shadow: strength, softness, and offset (fractions of the shot). */
  shadow: number;
  shadowSoftness: number;
  shadowX: number;
  shadowY: number;
  fadeMode: FadeMode;
  /** Degrees; 90 = fades downward. */
  fadeAngle: number;
  fadeAmount: number;
  /** How the fading edge breaks apart. */
  fadeTexture: FadeTexture;
  /** The bright colour the melt pours into. */
  meltColor: string;
  /** One edge or corner glows outward (the zadriel look), 0..1 — independent of fade. */
  edgeLight: number;
  /** Degrees; snapped to the nearest of 8 directions — edges and corners. */
  edgeLightAngle: number;
  edgeLightColor: string;
  /** How far the edge glow spreads out past the shot, 0..1. */
  edgeLightSpread: number;
  /** Behind the shot (backlight) or in front (bright, spilling onto it). */
  edgeLightMode: EdgeLightMode;
  /** Chromatic ghost trail behind the sharp shot, 0..1, and its direction. */
  streak: number;
  streakAngle: number;
  /** A soft blurred bloom of the picture itself spilling past its edges, 0..1. */
  diffuse: number;
  /** Colour grading, all neutral at their defaults. */
  brightness: number;
  contrast: number;
  saturation: number;
  /** Warm/cool push, -1..1, 0 = neutral. */
  warmth: number;
}

export interface Spec {
  /** One of RATIOS ids or "custom". */
  ratio: string;
  /** Export base size, 320..4096. */
  width: number;
  height: number;
  background: BackgroundMode;
  /** Curated preset id (backgrounds.ts). */
  backdropId: string;
  /** Curated picture id (backgrounds.ts BG_IMAGES). */
  bgImageId: string;
  /** IndexedDB key for an uploaded background image. */
  backgroundKey: string;
  /** Solid-mode colour. */
  backdropColor: string;
  /** Background softness, dim and grain, 0..1 each. */
  bgBlur: number;
  bgDim: number;
  grain: number;
  /** Background picture framing: zoom (0.2..4) and pan (fractions, -1..1). */
  bgScale: number;
  bgX: number;
  bgY: number;
  /** Blob overlay: amount (0 = off), size, and the seed the shuffle bumps. */
  blobs: number;
  blobSize: number;
  blobSeed: number;
  blobColor1: string;
  blobColor2: string;
  /** Camera FOV in degrees, 8..70 — drama, not size. */
  perspective: number;
  /** 1..3, index 0 rendered furthest back. */
  layers: LayerSpec[];
}

export const DEFAULT_LAYER: LayerSpec = {
  id: "shot-1",
  imageKey: "",
  x: 0,
  y: 0,
  zoom: 1,
  // The default shot is flat and clean: no tilt, no focus blur, no frame —
  // just a touch of drop shadow. Everything else is a dial away.
  rotX: 0,
  rotY: 0,
  rotZ: 0,
  blur: 0,
  focusX: 0.46,
  focusY: 0.4,
  focusMode: "point",
  focusBand: 0.25,
  focusSize: 0,
  blurStyle: "soft",
  radius: 0.02,
  frame: "none",
  frameWidth: 0.005,
  frameOpacity: 1,
  frameColor1: "#8b9dff",
  frameColor2: "#4afffc",
  glow: 0.16,
  glowSpread: 0.6,
  glowInner: 0.25,
  shadow: 0.35,
  shadowSoftness: 0.45,
  shadowX: 0,
  shadowY: 0.35,
  fadeMode: "none",
  fadeAngle: 90,
  fadeAmount: 0.4,
  fadeTexture: "smooth",
  meltColor: "#bcd7ff",
  edgeLight: 0,
  edgeLightAngle: -90,
  edgeLightColor: "#ffb46a",
  edgeLightSpread: 0.4,
  edgeLightMode: "behind",
  streak: 0,
  streakAngle: 0,
  diffuse: 0,
  brightness: 1,
  contrast: 1,
  saturation: 1,
  warmth: 0,
};

export const DEFAULT_SPEC: Spec = {
  ratio: "3:2",
  width: 1920,
  height: 1280,
  background: "preset",
  backdropId: "paper",
  bgImageId: "hand",
  backgroundKey: "",
  backdropColor: "#101114",
  bgBlur: 0.35,
  bgDim: 0,
  grain: 0,
  bgScale: 1,
  bgX: 0,
  bgY: 0,
  blobs: 0,
  blobSize: 0.5,
  blobSeed: 1,
  blobColor1: "#ff8ab4",
  blobColor2: "#6ad7ff",
  perspective: 30,
  layers: [DEFAULT_LAYER],
};

/** One choice in a pill: the engine's word, and the word on screen. */
export interface Option {
  value: string;
  label: string;
}

export type Meta =
  | { kind: "number"; label: string; min: number; max: number; step: number; unit?: string; centred?: true; hint?: string; section: Section }
  | { kind: "boolean"; label: string; hint?: string; section: Section }
  /** chips: wrap as a grid of chips instead of a cramped segmented pill. */
  | { kind: "enum"; label: string; options: Option[]; chips?: true; hint?: string; section: Section }
  | { kind: "color"; label: string; hint?: string; section: Section }
  /** Picked from a grid the section draws itself; no generic control. */
  | { kind: "picker"; label: string; section: Section }
  /** The focus pad, drawn by the focus section rather than by Control. */
  | { kind: "pad"; label: string; section: Section }
  /** Carried data with no control at all (ids, the array, the blob seed). */
  | { kind: "hidden"; label: string; section: Section };

export const SECTIONS: { id: Section; title: string }[] = [
  { id: "canvas", title: "Canvas" },
  { id: "background", title: "Background" },
  { id: "angle", title: "Angle" },
  { id: "focus", title: "Focus" },
  { id: "adjustments", title: "Adjustments" },
  { id: "frame", title: "Frame" },
  { id: "shadow", title: "Shadow" },
  { id: "effects", title: "Effects" },
];

const FRAME_OPTIONS: Option[] = [
  { value: "none", label: "None" },
  { value: "line", label: "Line" },
  { value: "border", label: "Border" },
  { value: "glassLight", label: "Glass light" },
  { value: "glassDark", label: "Glass dark" },
  { value: "insetLight", label: "Inset light" },
  { value: "insetDark", label: "Inset dark" },
  { value: "neon", label: "Neon" },
];

const FADE_OPTIONS: Option[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "melt", label: "Melt" },
];

// Only smooth ships: the patterned dissolves never looked good enough. The
// engine still knows the other styles, but old saved specs coerce back here.
const FADE_TEXTURE_OPTIONS: Option[] = [{ value: "smooth", label: "Smooth" }];

/** The canvas-wide dials. */
export type CanvasKey = Exclude<keyof Spec, "layers">;

export const CANVAS_META: Record<CanvasKey, Meta> = {
  ratio: { kind: "hidden", label: "Ratio", section: "canvas" },
  width: { kind: "number", label: "Width", min: 320, max: 4096, step: 1, unit: "px", section: "canvas" },
  height: { kind: "number", label: "Height", min: 320, max: 4096, step: 1, unit: "px", section: "canvas" },
  background: {
    kind: "enum",
    label: "Background",
    options: [
      { value: "preset", label: "Gradient" },
      { value: "solid", label: "Solid" },
      { value: "image", label: "Image" },
      { value: "upload", label: "Upload" },
      { value: "transparent", label: "None" },
    ],
    section: "background",
  },
  backdropId: { kind: "hidden", label: "Backdrop", section: "background" },
  bgImageId: { kind: "hidden", label: "Background picture", section: "background" },
  backgroundKey: { kind: "hidden", label: "Background image", section: "background" },
  backdropColor: { kind: "color", label: "Colour", section: "background" },
  bgBlur: { kind: "number", label: "Softness", min: 0, max: 1, step: 0.01, hint: "Blurs the background picture so the shot stands off it.", section: "background" },
  bgDim: { kind: "number", label: "Dim", min: 0, max: 1, step: 0.01, section: "background" },
  grain: { kind: "number", label: "Grain", min: 0, max: 1, step: 0.01, section: "background" },
  bgScale: { kind: "number", label: "Scale", min: 0.2, max: 4, step: 0.01, unit: "×", section: "background" },
  bgX: { kind: "number", label: "Position ↔", min: -1, max: 1, step: 0.01, centred: true, section: "background" },
  bgY: { kind: "number", label: "Position ↕", min: -1, max: 1, step: 0.01, centred: true, section: "background" },
  blobs: { kind: "number", label: "Blobs", min: 0, max: 1, step: 0.01, hint: "Soft out-of-focus orbs floating over the shot.", section: "effects" },
  blobSize: { kind: "number", label: "Blob size", min: 0, max: 1, step: 0.01, section: "effects" },
  blobSeed: { kind: "hidden", label: "Blob seed", section: "effects" },
  blobColor1: { kind: "color", label: "Blob colour 1", section: "effects" },
  blobColor2: { kind: "color", label: "Blob colour 2", section: "effects" },
  perspective: { kind: "number", label: "Perspective", min: 8, max: 70, step: 1, unit: "°", hint: "Narrow is a flat product shot, wide is dramatic — the size stays put.", section: "angle" },
};

export const LAYER_META: Record<keyof LayerSpec, Meta> = {
  id: { kind: "hidden", label: "Shot id", section: "angle" },
  imageKey: { kind: "hidden", label: "Image", section: "angle" },
  x: { kind: "number", label: "Move ↔", min: -3, max: 3, step: 0.01, centred: true, section: "angle" },
  y: { kind: "number", label: "Move ↕", min: -3, max: 3, step: 0.01, centred: true, section: "angle" },
  zoom: { kind: "number", label: "Zoom", min: 0.2, max: 8, step: 0.01, unit: "×", section: "angle" },
  rotX: { kind: "number", label: "Tilt ↕", min: -80, max: 80, step: 1, unit: "°", centred: true, section: "angle" },
  rotY: { kind: "number", label: "Tilt ↔", min: -80, max: 80, step: 1, unit: "°", centred: true, section: "angle" },
  rotZ: { kind: "number", label: "Rotate", min: -180, max: 180, step: 1, unit: "°", centred: true, section: "angle" },
  blur: { kind: "number", label: "Focus falloff", min: 0, max: 1, step: 0.01, hint: "How fast things blur away from the sharp point.", section: "focus" },
  focusX: { kind: "pad", label: "Focus point", section: "focus" },
  focusY: { kind: "pad", label: "Focus point", section: "focus" },
  focusMode: { kind: "enum", label: "Mode", options: [{ value: "point", label: "Point" }, { value: "band", label: "Band" }], section: "focus" },
  focusBand: { kind: "number", label: "Band size", min: 0.05, max: 1, step: 0.01, section: "focus" },
  focusSize: { kind: "number", label: "Focus area", min: 0, max: 1, step: 0.01, hint: "How much stays fully sharp before the blur begins.", section: "focus" },
  blurStyle: { kind: "enum", label: "Blur look", options: [{ value: "soft", label: "Soft" }, { value: "lens", label: "Lens" }], section: "focus" },
  radius: { kind: "number", label: "Corners", min: 0, max: 0.5, step: 0.01, section: "frame" },
  frame: { kind: "enum", label: "Frame", options: FRAME_OPTIONS, chips: true, section: "frame" },
  frameWidth: { kind: "number", label: "Width", min: 0, max: 0.05, step: 0.001, section: "frame" },
  frameOpacity: { kind: "number", label: "Opacity", min: 0, max: 1, step: 0.01, section: "frame" },
  frameColor1: { kind: "color", label: "Start", section: "frame" },
  frameColor2: { kind: "color", label: "End", section: "frame" },
  glow: { kind: "number", label: "Glow", min: 0, max: 1, step: 0.01, section: "frame" },
  glowSpread: { kind: "number", label: "Spread", min: 0, max: 1, step: 0.01, section: "frame" },
  glowInner: { kind: "number", label: "Inner glow", min: 0, max: 1, step: 0.01, hint: "Frame light washing onto the shot itself.", section: "frame" },
  shadow: { kind: "number", label: "Shadow", min: 0, max: 1, step: 0.01, section: "shadow" },
  shadowSoftness: { kind: "number", label: "Softness", min: 0, max: 1, step: 0.01, hint: "Tight and crisp, or a wide soft wash.", section: "shadow" },
  shadowX: { kind: "number", label: "Offset ↔", min: -1, max: 1, step: 0.01, centred: true, section: "shadow" },
  shadowY: { kind: "number", label: "Offset ↕", min: -1, max: 1, step: 0.01, centred: true, section: "shadow" },
  fadeMode: { kind: "enum", label: "Fade", options: FADE_OPTIONS, section: "effects" },
  fadeAngle: { kind: "number", label: "Direction", min: -180, max: 180, step: 45, unit: "°", section: "effects" },
  fadeAmount: { kind: "number", label: "Amount", min: 0, max: 1, step: 0.01, section: "effects" },
  fadeTexture: { kind: "enum", label: "Dissolve", options: FADE_TEXTURE_OPTIONS, hint: "The pattern the fading edge breaks into.", section: "effects" },
  meltColor: { kind: "color", label: "Melt colour", section: "effects" },
  edgeLight: { kind: "number", label: "Edge light", min: 0, max: 1, step: 0.01, hint: "One edge or corner glows outward.", section: "effects" },
  edgeLightAngle: { kind: "number", label: "Edge", min: -180, max: 180, step: 45, unit: "°", section: "effects" },
  edgeLightColor: { kind: "color", label: "Edge colour", section: "effects" },
  edgeLightSpread: { kind: "number", label: "Spread", min: 0, max: 1, step: 0.01, hint: "How far the glow reaches out past the shot.", section: "effects" },
  edgeLightMode: {
    kind: "enum",
    label: "Style",
    options: [
      { value: "behind", label: "Behind" },
      { value: "front", label: "In front" },
    ],
    hint: "Behind is a soft backlight; in front is brighter and spills onto the shot.",
    section: "effects",
  },
  streak: { kind: "number", label: "Streak", min: 0, max: 1, step: 0.01, section: "effects" },
  streakAngle: { kind: "number", label: "Direction", min: -180, max: 180, step: 45, unit: "°", section: "effects" },
  diffuse: { kind: "number", label: "Diffusion", min: 0, max: 1, step: 0.01, hint: "The picture's own light blooms softly past its edges.", section: "effects" },
  brightness: { kind: "number", label: "Brightness", min: 0, max: 2, step: 0.01, centred: true, section: "adjustments" },
  contrast: { kind: "number", label: "Contrast", min: 0, max: 2, step: 0.01, centred: true, section: "adjustments" },
  saturation: { kind: "number", label: "Saturation", min: 0, max: 2, step: 0.01, centred: true, section: "adjustments" },
  warmth: { kind: "number", label: "Warmth", min: -1, max: 1, step: 0.01, centred: true, hint: "Push the picture warmer or cooler.", section: "adjustments" },
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** A fresh, stable id for a shot whose saved record has none. */
function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `shot-${Date.now()}`;
}

/**
 * One value made legal for its meta. Numbers clamp into range, enums and colours
 * fall back when they are strangers, everything else is taken on trust.
 */
function coerceField(meta: Meta, value: unknown, fallback: unknown): unknown {
  switch (meta.kind) {
    case "number":
      return typeof value === "number" && Number.isFinite(value)
        ? Math.min(meta.max, Math.max(meta.min, value))
        : fallback;
    case "enum":
      return typeof value === "string" && meta.options.some((o) => o.value === value) ? value : fallback;
    case "color":
      return typeof value === "string" && HEX.test(value) ? value : fallback;
    case "boolean":
      return typeof value === "boolean" ? value : fallback;
    case "pad":
      // The focus point: 0..1, no min/max on the meta, so clamp by hand.
      return typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
    case "picker":
      return typeof value === "string" ? value : fallback;
    case "hidden":
      // Strings kept as they are; carried numbers (the blob seed) kept if finite.
      if (typeof value !== typeof fallback) return fallback;
      if (typeof value === "number" && !Number.isFinite(value)) return fallback;
      return value;
  }
}

function coerceLayer(raw: unknown): LayerSpec {
  const layer = { ...DEFAULT_LAYER };
  const r = raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};
  // The one-size "glass" style split into light and dark variants.
  if (r.frame === "glass") r.frame = "glassLight";
  for (const key of Object.keys(DEFAULT_LAYER) as (keyof LayerSpec)[]) {
    (layer as Record<string, unknown>)[key] = coerceField(LAYER_META[key], r[key], DEFAULT_LAYER[key]);
  }
  // A missing or empty id gets a fresh one — two shots must never key the same
  // image record.
  layer.id = typeof r.id === "string" && r.id ? r.id : newId();
  return layer;
}

function cloneSpec(spec: Spec): Spec {
  return { ...spec, layers: spec.layers.map((layer) => ({ ...layer })) };
}

/**
 * A valid Spec from anything at all — a saved localStorage blob, a stray object,
 * junk. Used on every load, so it has to be total. Numbers clamp, enums and
 * colours fall back, the shot count is held to 1..3.
 */
export function coerceSpec(input: unknown): Spec {
  if (!input || typeof input !== "object") return cloneSpec(DEFAULT_SPEC);
  const raw = { ...(input as Record<string, unknown>) };
  // "image" used to mean the user's own picture; that mode is now "upload" and
  // "image" is the curated gallery.
  if (raw.background === "image" && typeof raw.backgroundKey === "string" && raw.backgroundKey) {
    raw.background = "upload";
  }
  const spec = cloneSpec(DEFAULT_SPEC);
  for (const key of Object.keys(DEFAULT_SPEC) as (keyof Spec)[]) {
    if (key === "layers") continue;
    const meta = CANVAS_META[key as CanvasKey];
    (spec as unknown as Record<string, unknown>)[key] = coerceField(meta, raw[key], DEFAULT_SPEC[key as CanvasKey]);
  }
  const rawLayers = Array.isArray(raw.layers) ? raw.layers.slice(0, 3) : [];
  spec.layers = rawLayers.length > 0 ? rawLayers.map(coerceLayer) : [coerceLayer(undefined)];
  return spec;
}
