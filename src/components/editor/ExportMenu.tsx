"use client";

import { Fragment, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { Engine } from "@/engine/renderer";
import type { Spec } from "@/engine/spec";
import { copy } from "./clipboard";
import { download } from "./download";
import { toShareUrl } from "./share";

type RowId = "png" | "copy" | "link";
type Scale = 1 | 2 | 4;
type Phase = "shut" | "opening" | "open" | "closing";

const SCALES: Scale[] = [1, 2, 4];
const CONFIRM_MS = 1400;

const ImageGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="m3.5 11.5 3-3.2 2.2 2.2 1.6-1.6 2.4 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="10.4" cy="6.2" r="1" fill="currentColor" />
  </svg>
);
const CopyGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <rect x="5.4" y="5.4" width="8.2" height="8.2" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M10.6 5.4V4a1.6 1.6 0 0 0-1.6-1.6H4A1.6 1.6 0 0 0 2.4 4v5a1.6 1.6 0 0 0 1.6 1.6h1.4" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);
const Tick = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path d="m3.4 8.4 3 3 6.2-6.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const LinkGlyph = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
    <path d="M6.6 9.4a2.4 2.4 0 0 0 3.4 0l2-2a2.4 2.4 0 1 0-3.4-3.4l-.9.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M9.4 6.6a2.4 2.4 0 0 0-3.4 0l-2 2a2.4 2.4 0 1 0 3.4 3.4l.9-.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export interface ExportMenuProps {
  engine: Engine | null;
  /** The current scene, for the shareable "save as template" link. */
  spec: Spec;
  /** The backdrop is None, so the PNG is transparent whatever the Clear toggle says. */
  transparentBackdrop: boolean;
  onToast?: (message: string) => void;
}

/**
 * The thing you leave with. What it exports is exactly what the preview is
 * running — the same engine renders the PNG, just at export resolution, so the
 * file matches the picture.
 */
export function ExportMenu({ engine, spec, transparentBackdrop, onToast }: ExportMenuProps) {
  const [phase, setPhase] = useState<Phase>("shut");
  const [done, setDone] = useState<RowId | null>(null);
  const [failed, setFailed] = useState<RowId | null>(null);
  const [busy, setBusy] = useState<RowId | null>(null);
  const [scale, setScale] = useState<Scale>(2);
  const [clear, setClear] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const mounted = phase !== "shut";
  const open = phase === "opening" || phase === "open";

  // The page's own address with the whole scene folded into the hash; rebuilt
  // off the render path so a slider drag doesn't re-encode it every frame.
  const settled = useDeferredValue(spec);
  const link = useMemo(() => (typeof window === "undefined" ? "" : toShareUrl(settled, window.location.href)), [settled]);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);
  useEffect(() => clearTimers, [clearTimers]);

  const shut = useCallback(() => setPhase((c) => (c === "shut" || c === "closing" ? c : "closing")), []);

  useEffect(() => {
    if (phase === "shut" || phase === "open") return;
    const timer = setTimeout(() => setPhase((c) => (c === "opening" ? "open" : c === "closing" ? "shut" : c)), phase === "opening" ? 400 : 260);
    return () => clearTimeout(timer);
  }, [phase]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      shut();
      trigger.current?.focus();
    };
    const onOutside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) shut();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open, shut]);

  const finish = useCallback(
    (id: RowId, ok: boolean) => {
      setBusy(null);
      if (ok) setDone(id);
      else setFailed(id);
      timers.current.push(
        setTimeout(() => {
          setDone(null);
          setFailed(null);
        }, CONFIRM_MS),
        setTimeout(shut, CONFIRM_MS + 200),
      );
    },
    [shut],
  );

  const doPng = useCallback(async () => {
    if (!engine || busy) return; // one heavy render at a time — don't pile up WebGL contexts
    clearTimers();
    setDone(null);
    setFailed(null);
    setBusy("png");
    const transparent = clear || transparentBackdrop;
    try {
      const blob = await engine.toPng(scale, transparent);
      download(blob, `screenshot${transparent ? "-transparent" : ""}@${scale}x.png`);
      finish("png", true);
    } catch (e) {
      onToast?.((e as Error).message);
      finish("png", false);
    }
  }, [engine, busy, clear, transparentBackdrop, scale, clearTimers, finish, onToast]);

  const doCopy = useCallback(async () => {
    if (!engine || busy) return;
    clearTimers();
    setDone(null);
    setFailed(null);
    setBusy("copy");
    try {
      if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) throw new Error("no-clipboard");
      // Promise-form, so Safari accepts the write inside the click.
      await navigator.clipboard.write([new ClipboardItem({ "image/png": engine.toPng(2, false) })]);
      finish("copy", true);
    } catch {
      try {
        download(await engine.toPng(2, false), "screenshot@2x.png");
        onToast?.("Copy isn't available here — saved a file instead.");
        finish("copy", true);
      } catch (e) {
        onToast?.((e as Error).message);
        finish("copy", false);
      }
    }
  }, [engine, busy, clearTimers, finish, onToast]);

  const doLink = useCallback(async () => {
    if (busy) return;
    clearTimers();
    setDone(null);
    setFailed(null);
    setBusy("link");
    const ok = await copy(link);
    if (!ok) onToast?.("Couldn't copy the link here.");
    finish("link", ok);
  }, [busy, link, clearTimers, finish, onToast]);

  const rows = [
    { id: "png" as RowId, group: "Download", label: "PNG", sub: undefined as string | undefined, verb: "Download", Glyph: ImageGlyph },
    { id: "copy" as RowId, group: "Copy", label: "Copy image", sub: "2×", verb: "Copy", Glyph: CopyGlyph },
    { id: "link" as RowId, group: "Copy", label: "Copy link", sub: "Template", verb: "Copy", Glyph: LinkGlyph },
  ];

  return (
    <div className="relative" ref={root}>
      {mounted ? (
        <div
          role="menu"
          aria-label="Export"
          data-phase={phase}
          className="scr-export__menu"
          onAnimationEnd={(event) => {
            if (event.target !== event.currentTarget) return;
            setPhase((c) => (c === "opening" ? "open" : c === "closing" ? "shut" : c));
          }}
        >
          {rows.map((row, i) => {
            const confirmed = done === row.id;
            const missed = failed === row.id;
            const first = i === 0 || rows[i - 1].group !== row.group;
            const action = confirmed ? (row.group === "Copy" ? "Copied" : "Saved") : missed ? "Failed" : busy === row.id ? "Working…" : row.verb;
            return (
              <Fragment key={row.id}>
                {first ? (
                  <span role="presentation" className="scr-export__group" style={{ ["--i" as string]: i }}>
                    {row.group}
                  </span>
                ) : null}
                <button type="button" role="menuitem" onClick={() => (row.id === "png" ? doPng() : row.id === "link" ? doLink() : doCopy())} style={{ ["--i" as string]: i }} data-taken={confirmed || undefined} className="scr-export__row">
                  <span className="scr-export__sweep" aria-hidden />
                  <span className="scr-export__glyph" data-done={confirmed || undefined}>
                    <span className="scr-export__glyph-off">
                      <row.Glyph />
                    </span>
                    <span className="scr-export__glyph-on">
                      <Tick />
                    </span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
                    <span className="truncate text-[12.5px] leading-none text-scr-text">{row.label}</span>
                    {row.sub ? <span className="truncate font-scr-mono text-[10px] leading-none text-scr-muted">{row.sub}</span> : null}
                  </span>

                  {row.id === "png" && !confirmed ? (
                    <span className="flex shrink-0 gap-0.5" onClick={(e) => e.stopPropagation()} role="presentation">
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label="Clear backdrop"
                        aria-pressed={clear || transparentBackdrop}
                        data-on={clear || transparentBackdrop ? "" : undefined}
                        title={transparentBackdrop ? "The backdrop is already None" : "Leave the backdrop out of the file"}
                        className="scr-chip mr-1 px-1.5 text-[10px]"
                        onClick={() => setClear((c) => !c)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setClear((c) => !c);
                        }}
                      >
                        Clear
                      </span>
                      {SCALES.map((s) => (
                        <span
                          key={s}
                          role="button"
                          tabIndex={0}
                          aria-label={`${s}×`}
                          aria-pressed={scale === s}
                          data-on={scale === s ? "" : undefined}
                          className="scr-chip px-1.5 font-scr-mono text-[10px]"
                          onClick={() => setScale(s)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") setScale(s);
                          }}
                        >
                          {s}×
                        </span>
                      ))}
                    </span>
                  ) : null}

                  <span className="scr-export__action" data-done={confirmed || undefined} aria-hidden>
                    {action}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      ) : null}

      <button
        ref={trigger}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          clearTimers();
          setDone(null);
          setFailed(null);
          if (open) shut();
          else setPhase("opening");
        }}
        className="scr-export__trigger"
      >
        Export
        <svg viewBox="0 0 16 16" width="10" height="10" fill="none" aria-hidden className={`transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
          <path d="M4 9.8 8 6l4 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
