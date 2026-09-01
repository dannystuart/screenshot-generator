"use client";

import { ResetButton } from "./ResetButton";

export interface ColourControlProps {
  id: string;
  label: string;
  value: string;
  baseline: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * A label and a swatch. The swatch is the OS colour picker hiding under a
 * square, so the dialog people already know does the work.
 */
export function ColourControl({ id, label, value, baseline, disabled, onChange }: ColourControlProps) {
  const edited = value !== baseline;
  return (
    <div className="flex min-h-[30px] items-center justify-between gap-3">
      <label htmlFor={id} className="text-[12.5px] leading-none text-scr-text">
        {label}
      </label>
      <div className="flex items-center gap-2">
        {edited ? <ResetButton what={label} onReset={() => onChange(baseline)} /> : null}
        <span className="scr-colour" style={{ background: value }}>
          <input id={id} type="color" value={value} disabled={disabled} onInput={(e) => onChange((e.target as HTMLInputElement).value)} onChange={(e) => onChange(e.target.value)} />
        </span>
      </div>
    </div>
  );
}
