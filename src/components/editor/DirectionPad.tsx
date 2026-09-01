"use client";

import type { KeyboardEvent } from "react";

/** The eight directions, clockwise from the right; screen y runs down. */
const DIRS = [
  { angle: 0, label: "Right" },
  { angle: 45, label: "Down and right" },
  { angle: 90, label: "Down" },
  { angle: 135, label: "Down and left" },
  { angle: 180, label: "Left" },
  { angle: -135, label: "Up and left" },
  { angle: -90, label: "Up" },
  { angle: -45, label: "Up and right" },
];

export interface DirectionPadProps {
  label: string;
  value: number;
  onChange: (angle: number) => void;
  disabled?: boolean;
}

/** The index of the ring direction nearest the given angle. */
function nearestIndex(value: number): number {
  let best = 0;
  let bestDiff = Infinity;
  DIRS.forEach((d, i) => {
    const diff = Math.abs(((d.angle - value + 540) % 360) - 180);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}

/**
 * A ring of eight dots you pick a direction from — the competitor's dot-grid,
 * used for the fade, the melt, the streak and the edge light. Arrow keys walk
 * around the ring.
 */
export function DirectionPad({ label, value, onChange, disabled }: DirectionPadProps) {
  const current = nearestIndex(value);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) return;
    event.preventDefault();
    onChange(DIRS[(current + step + DIRS.length) % DIRS.length].angle);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={onKeyDown}
      className="relative h-[86px] w-[86px] rounded-xl bg-scr-raised shadow-[inset_0_0_0_1px_rgba(255,255,255,0.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
    >
      <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/20" aria-hidden />
      {DIRS.map((d, i) => {
        const active = i === current;
        const rad = (d.angle * Math.PI) / 180;
        return (
          <button
            key={d.angle}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={d.label}
            disabled={disabled}
            onClick={() => onChange(d.angle)}
            className="absolute grid h-6 w-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
            style={{ left: `${50 + 34 * Math.cos(rad)}%`, top: `${50 + 34 * Math.sin(rad)}%` }}
          >
            <span
              className={`rounded-full transition-all ${active ? "h-2.5 w-2.5 bg-scr-text" : "h-1.5 w-1.5 bg-white/28"}`}
            />
          </button>
        );
      })}
    </div>
  );
}
