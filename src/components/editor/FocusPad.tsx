"use client";

import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

export interface FocusPadProps {
  /** The sharp point: 0..1 across (x) and down (y) the shot. */
  x: number;
  y: number;
  disabled?: boolean;
  onChange: (x: number, y: number) => void;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const snap = (v: number) => Math.round(v * 100) / 100;

/**
 * A pad you drag a dot around to place the point that stays sharp. Everything
 * tilting away from it falls out of focus like a macro lens — so where the dot
 * sits is where the eye is meant to land.
 */
export function FocusPad({ x, y, disabled, onChange }: FocusPadProps) {
  const fromPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = clamp01((event.clientX - rect.left) / rect.width);
    const py = clamp01((event.clientY - rect.top) / rect.height);
    onChange(snap(px), snap(py));
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    fromPointer(event);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
    fromPointer(event);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const step = event.shiftKey ? 0.1 : 0.02;
    // Screen coordinates run y-down, so Up is toward the top of the shot.
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    onChange(snap(clamp01(x + move[0])), snap(clamp01(y + move[1])));
  };

  return (
    <div
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Focus point"
      aria-valuetext={`${Math.round(x * 100)} across, ${Math.round(y * 100)} down`}
      aria-valuenow={Math.round(x * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-disabled={disabled || undefined}
      className="scr-pad"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onKeyDown={onKeyDown}
    >
      <span className="scr-pad__dot" style={{ left: `${x * 100}%`, top: `${y * 100}%` }} aria-hidden />
    </div>
  );
}
