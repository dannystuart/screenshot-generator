/**
 * The curated backdrops, as data — no image assets to ship.
 *
 * Two kinds: a dithered multi-stop gradient, or an "aurora" (a gradient base
 * plus a few soft light lobes — blobs, or rings whose glow follows an ellipse
 * outline for the light-arcs look). The shader in shaders/background.ts draws
 * both; these are the starting values, tuned by eye at the checkpoint.
 */
export interface Backdrop {
  id: string;
  name: string;
  kind: "gradient" | "aurora";
  /** Hex, top → bottom. */
  stops: [string, string] | [string, string, string];
  /** Gradient direction in degrees; 90 = straight down. */
  angle: number;
  /** Aurora light shapes, in canvas UV (0,0 bottom-left). A ring glows along an
   *  ellipse outline instead of filling a blob. */
  glow?: { color: string; x: number; y: number; size: number; ring?: boolean }[];
}

// Neutrals lead: the default scene opens on Paper, and the quiet backdrops are
// the ones reached for most.
export const BACKDROPS: Backdrop[] = [
  { id: "paper", name: "Paper", kind: "gradient", stops: ["#f2efe8", "#e4ddd0"], angle: 90 },
  { id: "mist", name: "Mist", kind: "gradient", stops: ["#dfe6ee", "#c3ccd9"], angle: 90 },
  { id: "steel", name: "Steel", kind: "gradient", stops: ["#0c0d10", "#2a2d34"], angle: 90 },
  { id: "noir", name: "Noir", kind: "gradient", stops: ["#050506", "#101014"], angle: 90 },
  { id: "dusk", name: "Dusk", kind: "gradient", stops: ["#10122a", "#33265c", "#c96f4a"], angle: 90 },
  {
    id: "robin",
    name: "Robin",
    kind: "aurora",
    stops: ["#05070f", "#0b1e5b", "#3b6cff"],
    angle: 90,
    glow: [
      { color: "#3f6cff", x: 0.5, y: 0.06, size: 0.72 },
      { color: "#1c3aa4", x: 0.5, y: -0.06, size: 1.15 },
    ],
  },
  {
    id: "dune",
    name: "Dune",
    kind: "aurora",
    stops: ["#d9c4a3", "#b4906b", "#7c5a44"],
    angle: 90,
    // Darker warm glows: additive light on a light base blows straight to white,
    // so the ochres stay low enough to read as warm dune light, not a white sun.
    glow: [
      { color: "#b58954", x: 0.5, y: 0.34, size: 0.52 },
      { color: "#8a5f38", x: 0.33, y: 0.1, size: 0.66 },
    ],
  },
  { id: "iris", name: "Iris", kind: "gradient", stops: ["#1b1030", "#5b2a86", "#e26fd5"], angle: 90 },
  { id: "sea", name: "Sea", kind: "gradient", stops: ["#04121b", "#0a3a4a", "#3ecfcf"], angle: 90 },
  { id: "forest", name: "Forest", kind: "gradient", stops: ["#06130d", "#14402c", "#88c9a1"], angle: 90 },
  { id: "ember", name: "Ember", kind: "gradient", stops: ["#180a08", "#5c1f14", "#ff8a4a"], angle: 90 },
  { id: "lilac", name: "Lilac", kind: "gradient", stops: ["#efe6ff", "#cdb6f0", "#9a7bd4"], angle: 90 },
  { id: "honey", name: "Honey", kind: "gradient", stops: ["#fff3d6", "#ffd98a", "#e8a13c"], angle: 90 },
  { id: "orchid", name: "Orchid", kind: "gradient", stops: ["#fdeef4", "#f6b8d0", "#c76fa8"], angle: 90 },
  {
    id: "halo",
    name: "Halo",
    kind: "aurora",
    stops: ["#04081a", "#0a1230"],
    angle: 90,
    glow: [
      { color: "#3f6cff", x: 0.32, y: 0.12, size: 0.42, ring: true },
      { color: "#5a86ff", x: 0.72, y: 0.06, size: 0.5, ring: true },
    ],
  },
];

/** The backdrop for an id, or the first as a safe fallback for an unknown one. */
export function backdropById(id: string): Backdrop {
  return BACKDROPS.find((b) => b.id === id) ?? BACKDROPS[0];
}

/**
 * The curated background pictures — Danny's own materials renders, bundled in
 * public/backgrounds/. Picked from a grid like the gradients; the file doubles
 * as its own thumbnail.
 */
export interface BackgroundImage {
  id: string;
  name: string;
  /** Public URL, same origin. */
  src: string;
}

export const BG_IMAGES: BackgroundImage[] = [
  { id: "hand", name: "Hand", src: "/backgrounds/hand.webp" },
  { id: "blob", name: "Blob", src: "/backgrounds/blob.webp" },
  { id: "fluid", name: "Fluid", src: "/backgrounds/fluid.webp" },
  { id: "glass", name: "Glass", src: "/backgrounds/glass.webp" },
  { id: "crystal", name: "Crystal", src: "/backgrounds/crystal.webp" },
  { id: "planet", name: "Planet", src: "/backgrounds/planet.webp" },
  { id: "cluster", name: "Cluster", src: "/backgrounds/cluster.webp" },
  { id: "nebula", name: "Nebula", src: "/backgrounds/nebula.webp" },
  { id: "frost", name: "Frost", src: "/backgrounds/frost.webp" },
  { id: "orb", name: "Orb", src: "/backgrounds/orb.webp" },
];

/** The picture for an id, or the first as a safe fallback for an unknown one. */
export function bgImageById(id: string): BackgroundImage {
  return BG_IMAGES.find((b) => b.id === id) ?? BG_IMAGES[0];
}
