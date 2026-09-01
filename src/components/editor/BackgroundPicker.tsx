"use client";

import type { CSSProperties } from "react";
import { BACKDROPS, BG_IMAGES } from "@/engine/backgrounds";
import type { BackgroundMode, Spec } from "@/engine/spec";

export interface BackgroundPickerProps {
  spec: Spec;
  onChange: (patch: Partial<Spec>) => void;
  /** Open the file picker for a background image of your own. */
  onUploadBackground: () => void;
  disabled?: boolean;
}

/** A CSS stand-in for a backdrop, honest enough for a thumbnail. */
function swatch(stops: readonly string[]): CSSProperties {
  return { backgroundImage: `linear-gradient(180deg, ${stops.join(", ")})` };
}

const MODES: { mode: BackgroundMode; label: string }[] = [
  { mode: "preset", label: "Gradient" },
  { mode: "solid", label: "Solid" },
  { mode: "image", label: "Image" },
  { mode: "upload", label: "Upload" },
  { mode: "transparent", label: "None" },
];

export function BackgroundPicker({ spec, onChange, onUploadBackground, disabled }: BackgroundPickerProps) {
  return (
    <div className="space-y-2.5 px-3.5">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map(({ mode, label }) => (
          <button
            key={mode}
            type="button"
            className="scr-chip"
            data-on={spec.background === mode ? "" : undefined}
            aria-pressed={spec.background === mode}
            disabled={disabled}
            onClick={() => {
              // Upload with nothing uploaded yet goes straight to the picker;
              // with a picture already in, the chip just switches back to it.
              if (mode === "upload" && !spec.backgroundKey) onUploadBackground();
              else onChange({ background: mode });
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {spec.background === "preset" ? (
        <div className="scr-grid" data-cols="5">
          {BACKDROPS.map((b) => (
            <button
              key={b.id}
              type="button"
              className="scr-tile"
              aria-pressed={spec.backdropId === b.id}
              aria-label={b.name}
              title={b.name}
              disabled={disabled}
              onClick={() => onChange({ background: "preset", backdropId: b.id })}
            >
              <span className="absolute inset-0" style={swatch(b.stops)} aria-hidden />
              <span className="scr-tile__name">{b.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {spec.background === "image" ? (
        <div className="scr-grid" data-cols="5">
          {BG_IMAGES.map((b) => (
            <button
              key={b.id}
              type="button"
              className="scr-tile"
              aria-pressed={spec.bgImageId === b.id}
              aria-label={b.name}
              title={b.name}
              disabled={disabled}
              onClick={() => onChange({ background: "image", bgImageId: b.id })}
              onContextMenu={(e) => e.preventDefault()}
            >
              {/* Materials work: block the casual right-click-save / drag-off.
                  (The files still sit at public URLs — this is a deterrent, not a lock.) */}
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny same-origin thumbs; next/image buys nothing here */}
              <img
                src={b.src}
                alt=""
                className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
              <span className="scr-tile__name">{b.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      {spec.background === "upload" ? (
        <button type="button" className="scr-chip" disabled={disabled} onClick={onUploadBackground}>
          {spec.backgroundKey ? "Replace image…" : "Choose an image…"}
        </button>
      ) : null}
    </div>
  );
}
