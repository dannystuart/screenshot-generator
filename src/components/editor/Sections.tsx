"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { RATIOS, sizeFor } from "@/engine/ratios";
import { CANVAS_META, DEFAULT_LAYER, LAYER_META, SECTIONS } from "@/engine/spec";
import type { CanvasKey, LayerSpec, Section, Spec } from "@/engine/spec";
import { BackgroundPicker } from "./BackgroundPicker";
import { Control } from "./Control";
import type { ControlValue } from "./Control";
import { DirectionPad } from "./DirectionPad";
import { FocusPad } from "./FocusPad";
import { editedKeys } from "./edited";

export interface SectionsProps {
  spec: Spec;
  baseline: Spec;
  selected: number;
  onChangeCanvas: (patch: Partial<Spec>) => void;
  onChangeLayer: (patch: Partial<LayerSpec>) => void;
  onUploadBackground: () => void;
  onShuffleBlobs: () => void;
  onStraighten: () => void;
  disabled?: boolean;
}

const CANVAS_KEYS = Object.keys(CANVAS_META) as CanvasKey[];
const LAYER_KEYS = Object.keys(LAYER_META) as (keyof LayerSpec)[];

export function Sections({
  spec,
  baseline,
  selected,
  onChangeCanvas,
  onChangeLayer,
  onUploadBackground,
  onShuffleBlobs,
  onStraighten,
  disabled,
}: SectionsProps) {
  // One fold open at a time; the panel is long. The page opens on Canvas.
  const [open, setOpen] = useState<Section | null>("canvas");

  const layer = spec.layers[selected] ?? DEFAULT_LAYER;
  const baseLayer = baseline.layers[Math.min(selected, baseline.layers.length - 1)] ?? DEFAULT_LAYER;
  const isBgPicture = spec.background === "image" || spec.background === "upload";
  const editedCanvas = new Set(editedKeys(spec, baseline, CANVAS_KEYS));
  const editedLayer = new Set(editedKeys(layer, baseLayer, LAYER_KEYS));

  const canvasCtl = (key: CanvasKey) => (
    <Control
      key={`c-${key}`}
      meta={CANVAS_META[key]}
      id={`scr-${key}`}
      value={spec[key] as ControlValue}
      baseline={baseline[key] as ControlValue}
      onChange={(v) => onChangeCanvas({ [key]: v } as Partial<Spec>)}
      disabled={disabled}
    />
  );
  const layerCtl = (key: keyof LayerSpec) => (
    <Control
      key={`l-${key}`}
      meta={LAYER_META[key]}
      id={`scr-l-${key}`}
      value={layer[key] as ControlValue}
      baseline={baseLayer[key] as ControlValue}
      onChange={(v) => onChangeLayer({ [key]: v } as Partial<LayerSpec>)}
      disabled={disabled}
    />
  );

  const dirty = (id: Section) =>
    CANVAS_KEYS.some((k) => CANVAS_META[k].section === id && editedCanvas.has(k)) ||
    LAYER_KEYS.some((k) => LAYER_META[k].section === id && editedLayer.has(k));

  const body: Record<Section, ReactNode> = {
    canvas: (
      <>
        <div className="flex flex-wrap gap-1.5 px-3.5">
          {RATIOS.map((rt) => (
            <button
              key={rt.id}
              type="button"
              className="scr-chip"
              data-on={spec.ratio === rt.id ? "" : undefined}
              aria-pressed={spec.ratio === rt.id}
              disabled={disabled}
              onClick={() => onChangeCanvas({ ratio: rt.id, ...sizeFor(rt.id) })}
            >
              {rt.id}
            </button>
          ))}
          <button
            type="button"
            className="scr-chip"
            data-on={spec.ratio === "custom" ? "" : undefined}
            aria-pressed={spec.ratio === "custom"}
            disabled={disabled}
            onClick={() => onChangeCanvas({ ratio: "custom" })}
          >
            Custom
          </button>
        </div>
        {spec.ratio === "custom" ? (
          <div className="flex items-center gap-2 px-3.5">
            <SizeInput label="W" value={spec.width} onChange={(w) => onChangeCanvas({ width: w })} disabled={disabled} />
            <span className="text-scr-faint">×</span>
            <SizeInput label="H" value={spec.height} onChange={(h) => onChangeCanvas({ height: h })} disabled={disabled} />
          </div>
        ) : null}
      </>
    ),
    background: (
      <>
        <BackgroundPicker spec={spec} onChange={onChangeCanvas} onUploadBackground={onUploadBackground} disabled={disabled} />
        {spec.background === "solid" ? canvasCtl("backdropColor") : null}
        {/* Picture-only: framing and softness. */}
        {isBgPicture ? canvasCtl("bgScale") : null}
        {isBgPicture ? canvasCtl("bgX") : null}
        {isBgPicture ? canvasCtl("bgY") : null}
        {isBgPicture ? canvasCtl("bgBlur") : null}
        {spec.background !== "transparent" ? canvasCtl("bgDim") : null}
        {spec.background !== "transparent" ? canvasCtl("grain") : null}
      </>
    ),
    angle: (
      <>
        <div className="px-3.5 pb-1">
          <button
            type="button"
            className="scr-chip"
            disabled={disabled}
            onClick={onStraighten}
            title="Set every tilt back to flat"
          >
            Straighten
          </button>
        </div>
        {layerCtl("rotX")}
        {layerCtl("rotY")}
        {layerCtl("rotZ")}
        {layerCtl("zoom")}
        {layerCtl("x")}
        {layerCtl("y")}
        {canvasCtl("perspective")}
      </>
    ),
    focus: (
      <>
        {layerCtl("focusMode")}
        {layerCtl("blur")}
        {layer.focusMode === "band" ? layerCtl("focusBand") : layerCtl("focusSize")}
        {layerCtl("blurStyle")}
        <div className="space-y-1.5 px-3.5 pt-1">
          <span className="block text-[12.5px] leading-none text-scr-text">
            {layer.focusMode === "band" ? "Band position" : "Focus point"}
          </span>
          <FocusPad x={layer.focusX} y={layer.focusY} disabled={disabled} onChange={(x, y) => onChangeLayer({ focusX: x, focusY: y })} />
        </div>
      </>
    ),
    adjustments: (
      <>
        {layerCtl("brightness")}
        {layerCtl("contrast")}
        {layerCtl("saturation")}
        {layerCtl("warmth")}
      </>
    ),
    frame: (
      <>
        {layerCtl("radius")}
        {layerCtl("frame")}
        {layer.frame !== "none" ? layerCtl("frameWidth") : null}
        {["line", "border", "neon"].includes(layer.frame) ? layerCtl("frameColor1") : null}
        {layer.frame === "neon" ? layerCtl("frameColor2") : null}
        {layer.frame !== "none" ? layerCtl("frameOpacity") : null}
        {layer.frame === "neon" ? layerCtl("glow") : null}
        {layer.frame === "neon" ? layerCtl("glowSpread") : null}
        {layer.frame === "neon" ? layerCtl("glowInner") : null}
      </>
    ),
    shadow: (
      <>
        {layerCtl("shadow")}
        {layer.shadow > 0 ? layerCtl("shadowSoftness") : null}
        {layer.shadow > 0 ? layerCtl("shadowX") : null}
        {layer.shadow > 0 ? layerCtl("shadowY") : null}
      </>
    ),
    effects: (
      <>
        <SubHead>Fade</SubHead>
        {layerCtl("fadeMode")}
        {layer.fadeMode === "fade" ? (
          <div className="space-y-1.5 px-3.5 pt-1">
            <span className="block text-[12.5px] leading-none text-scr-text">Direction</span>
            <DirectionPad label="Fade direction" value={layer.fadeAngle} disabled={disabled} onChange={(a) => onChangeLayer({ fadeAngle: a })} />
          </div>
        ) : null}
        {layer.fadeMode !== "none" ? layerCtl("fadeAmount") : null}
        {layer.fadeMode === "melt" ? layerCtl("meltColor") : null}
        <Divider />
        <SubHead>Edge light</SubHead>
        {layerCtl("edgeLight")}
        {layer.edgeLight > 0 ? (
          <div className="space-y-1.5 px-3.5 pt-1">
            <span className="block text-[12.5px] leading-none text-scr-text">Lit edge or corner</span>
            <DirectionPad label="Edge light direction" value={layer.edgeLightAngle} disabled={disabled} onChange={(a) => onChangeLayer({ edgeLightAngle: a })} />
          </div>
        ) : null}
        {layer.edgeLight > 0 ? layerCtl("edgeLightMode") : null}
        {layer.edgeLight > 0 ? layerCtl("edgeLightSpread") : null}
        {layer.edgeLight > 0 ? layerCtl("edgeLightColor") : null}
        <Divider />
        {layerCtl("diffuse")}
        <Divider />
        {layerCtl("streak")}
        {layer.streak > 0 ? (
          <div className="space-y-1.5 px-3.5 pt-1">
            <span className="block text-[12.5px] leading-none text-scr-text">Streak direction</span>
            <DirectionPad label="Streak direction" value={layer.streakAngle} disabled={disabled} onChange={(a) => onChangeLayer({ streakAngle: a })} />
          </div>
        ) : null}
        <Divider />
        <SubHead>Blobs</SubHead>
        {canvasCtl("blobs")}
        {spec.blobs > 0 ? canvasCtl("blobSize") : null}
        {spec.blobs > 0 ? canvasCtl("blobColor1") : null}
        {spec.blobs > 0 ? canvasCtl("blobColor2") : null}
        {spec.blobs > 0 ? (
          <div className="px-3.5 pt-1">
            <button type="button" className="scr-chip" disabled={disabled} onClick={onShuffleBlobs} title="A new arrangement of blobs">
              ✦ Shuffle
            </button>
          </div>
        ) : null}
      </>
    ),
  };

  return (
    <div className="pb-2">
      {SECTIONS.map((section) => {
        const isOpen = open === section.id;
        const toggle = () => setOpen(isOpen ? null : section.id);
        return (
          <section key={section.id} className="border-b border-scr-line/70 last:border-b-0">
            <h3>
              <button
                type="button"
                onClick={toggle}
                aria-expanded={isOpen}
                className="flex min-h-11 w-full items-center justify-between px-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/60"
              >
                <span className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.16em] text-scr-muted">
                  {section.title}
                  {dirty(section.id) ? <span aria-label="edited" className="h-1 w-1 rounded-full bg-scr-text/70" /> : null}
                </span>
                <span aria-hidden className={`font-scr-mono text-[11px] text-scr-faint transition-transform duration-200 motion-reduce:transition-none ${isOpen ? "rotate-90" : ""}`}>
                  ›
                </span>
              </button>
            </h3>
            {isOpen ? <div className="space-y-2 pb-3.5 pt-0.5">{body[section.id]}</div> : null}
          </section>
        );
      })}
    </div>
  );
}

/** A quiet label that groups a run of controls inside one section. */
function SubHead({ children }: { children: ReactNode }) {
  return <span className="block px-3.5 pt-1.5 text-[10px] uppercase tracking-[0.14em] text-scr-faint">{children}</span>;
}

/** A hairline between groups inside a section. */
function Divider() {
  return <div className="mx-3.5 my-1.5 border-t border-scr-line/70" />;
}

function SizeInput({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <label className="flex flex-1 items-center gap-1.5">
      <span className="text-[11px] text-scr-faint">{label}</span>
      <input
        type="number"
        min={320}
        max={4096}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(4096, Math.max(320, Math.round(n))));
        }}
        className="w-full rounded-lg bg-scr-raised px-2.5 py-1.5 font-scr-mono text-[12px] text-scr-text shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white/50"
      />
    </label>
  );
}
