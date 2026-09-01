/**
 * The canvas shapes people pick from, and the pixels each one exports at.
 *
 * The base sizes the *longer* side, so every preset comes out at the same 1920px
 * on its long edge whichever way up it is — a landscape and its portrait twin
 * carry the same detail, just turned.
 */
export interface Ratio {
  id: string;
  w: number;
  h: number;
  label: string;
}

export const RATIOS: Ratio[] = [
  { id: "1:1", w: 1, h: 1, label: "Square" },
  { id: "4:3", w: 4, h: 3, label: "Standard" },
  { id: "3:2", w: 3, h: 2, label: "Photo" },
  { id: "16:9", w: 16, h: 9, label: "Wide" },
  { id: "9:16", w: 9, h: 16, label: "Story" },
  { id: "4:5", w: 4, h: 5, label: "Portrait" },
];

/** Pixel size for a ratio id, the long side pinned to `base`. Unknown → square. */
export function sizeFor(ratioId: string, base = 1920): { width: number; height: number } {
  const ratio = RATIOS.find((r) => r.id === ratioId);
  if (!ratio) return { width: base, height: base };
  return ratio.w >= ratio.h
    ? { width: base, height: Math.round((base * ratio.h) / ratio.w) }
    : { width: Math.round((base * ratio.w) / ratio.h), height: base };
}
