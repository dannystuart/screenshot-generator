"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { createEngine } from "@/engine/renderer";
import type { Engine } from "@/engine/renderer";
import { fitContain } from "@/engine/fit";
import type { Spec } from "@/engine/spec";

export interface ScreenshotPreviewProps {
  spec: Spec;
  className?: string;
  style?: CSSProperties;
  /** Handed the live engine once it exists, for the editor's stage input and export. */
  onReady?: (engine: Engine) => void;
  /** The engine could not start — usually no WebGL. */
  onError?: (error: Error) => void;
}

/**
 * Mounts the engine into a host div and gets out of the way.
 *
 * Deliberately thin: React owns the host, the engine owns the canvas inside it.
 * A fresh canvas is made on every mount and thrown away on unmount, so a
 * StrictMode double-mount can never hand the engine a canvas whose context the
 * last one already killed.
 */
export function ScreenshotPreview({ spec, className, style, onReady, onError }: ScreenshotPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const fitRef = useRef<(() => void) | null>(null);

  // The latest props, for the mount effect to read without re-running: the
  // editor re-renders on every slider move, and depending on `spec` here would
  // tear the engine down and rebuild it each time.
  const latest = useRef({ spec, onReady, onError });
  useLayoutEffect(() => {
    latest.current = { spec, onReady, onError };
  }, [spec, onReady, onError]);

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const canvas = document.createElement("canvas");
    canvas.style.display = "block";
    // A hairline and a soft drop shadow so the export area reads as a rectangle
    // floating on the ink, even before it has anything in it.
    canvas.style.boxShadow = "0 0 0 1px rgba(255,255,255,0.05), 0 24px 70px -24px rgba(0,0,0,0.65)";
    host.appendChild(canvas);

    let engine: Engine;
    try {
      engine = createEngine(canvas);
    } catch (error) {
      canvas.remove();
      latest.current.onError?.(error as Error);
      return;
    }
    engineRef.current = engine;
    engine.setSpec(latest.current.spec);

    const fit = () => {
      const { width, height } = latest.current.spec;
      // The content box, so the stage's own padding becomes the breathing room
      // around the letterboxed canvas rather than being drawn over.
      const pad = getComputedStyle(host);
      const availW = host.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
      const availH = host.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
      const box = fitContain(Math.max(1, availW), Math.max(1, availH), width, height);
      engine.setSize(box.w, box.h);
    };
    fit();
    fitRef.current = fit;

    const observer = new ResizeObserver(fit);
    observer.observe(host);

    latest.current.onReady?.(engine);

    return () => {
      engineRef.current = null;
      fitRef.current = null;
      observer.disconnect();
      engine.dispose();
      canvas.remove();
    };
  }, []);

  // Every spec change updates the engine, and re-fits in case the ratio moved.
  useEffect(() => {
    engineRef.current?.setSpec(spec);
    fitRef.current?.();
  }, [spec]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", ...style }}
    />
  );
}
