"use client";

import type { Meta } from "@/engine/spec";
import { ColourControl } from "./ColourControl";
import { Pill } from "./Pill";
import { Slider } from "./Slider";

export type ControlValue = number | string | boolean;

export interface ControlProps {
  meta: Meta;
  id: string;
  value: ControlValue;
  /** Reset target for a double-click / the reset button. */
  baseline: ControlValue;
  onChange: (value: ControlValue) => void;
  disabled?: boolean;
}

const ON_OFF = [
  { value: "off", label: "Off" },
  { value: "on", label: "On" },
];

/**
 * One dial, drawn as whatever its metadata says it is.
 *
 * Generic over the value so the same row serves a canvas-wide field and a
 * per-shot one — the section decides which spec slice to hand it. Pickers, the
 * focus pad and hidden data are drawn by their sections, not here.
 */
export function Control({ meta, id, value, baseline, onChange, disabled }: ControlProps) {
  const body = (() => {
    if (meta.kind === "number") {
      return (
        <Slider
          id={id}
          label={meta.label}
          value={value as number}
          min={meta.min}
          max={meta.max}
          step={meta.step}
          unit={meta.unit}
          centred={meta.centred}
          baseline={baseline as number}
          disabled={disabled}
          onChange={(v) => onChange(v)}
        />
      );
    }
    if (meta.kind === "boolean") {
      return (
        <div className="flex min-h-[30px] items-center justify-between gap-3">
          <span className="text-[12.5px] leading-none text-scr-text">{meta.label}</span>
          <div className="w-[96px] shrink-0">
            <Pill label={meta.label} options={ON_OFF} value={(value as boolean) ? "on" : "off"} disabled={disabled} onChange={(next) => onChange(next === "on")} />
          </div>
        </div>
      );
    }
    if (meta.kind === "enum") {
      // Many options squeezed into a segmented pill become unreadable; chips
      // wrap onto as many rows as the labels need.
      if (meta.chips) {
        return (
          <div className="space-y-1.5">
            <span className="block text-[12.5px] leading-none text-scr-text">{meta.label}</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={meta.label}>
              {meta.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className="scr-chip"
                  role="radio"
                  aria-checked={value === o.value}
                  data-on={value === o.value ? "" : undefined}
                  disabled={disabled}
                  onClick={() => onChange(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className="space-y-1.5">
          <span className="block text-[12.5px] leading-none text-scr-text">{meta.label}</span>
          <Pill label={meta.label} options={meta.options} value={value as string} disabled={disabled} onChange={(next) => onChange(next)} />
        </div>
      );
    }
    if (meta.kind === "color") {
      return <ColourControl id={id} label={meta.label} value={value as string} baseline={baseline as string} disabled={disabled} onChange={(v) => onChange(v)} />;
    }
    return null;
  })();

  if (!body) return null;
  const hint = "hint" in meta ? meta.hint : undefined;
  return (
    <div className="px-3.5 py-1.5">
      {body}
      {hint ? <p className="mt-1.5 px-0.5 text-[10.5px] leading-snug text-scr-faint">{hint}</p> : null}
    </div>
  );
}
