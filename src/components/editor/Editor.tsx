"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { DragEvent, PointerEvent as ReactPointerEvent } from "react";
import { ScreenshotPreview } from "@/components/ScreenshotPreview";
import type { Engine } from "@/engine/renderer";
import { CANVAS_META, DEFAULT_LAYER, DEFAULT_SPEC, LAYER_META, coerceSpec } from "@/engine/spec";
import type { CanvasKey, LayerSpec, Spec } from "@/engine/spec";
import { Drawer } from "./Drawer";
import { DrawerHeader } from "./DrawerHeader";
import { ExportMenu } from "./ExportMenu";
import { LayerTabs } from "./LayerTabs";
import { Sections } from "./Sections";
import { Toast } from "./Toast";
import { fileToBitmap } from "./UploadZone";
import { getImage, imageActions, pruneImages, putImage } from "@/engine/images";
import { bgImageById } from "@/engine/backgrounds";
import { decodeBlobFlipped, decodeUrlFlipped } from "@/engine/decode";
import { fromShareHash } from "./share";

const SPEC_KEY = "ssg.spec";
const DRAWER_KEY = "ssg.drawer";
const PHONE_QUERY = "(max-width: 1023px)";

const CANVAS_KEYS = Object.keys(CANVAS_META) as CanvasKey[];
const LAYER_KEYS = Object.keys(LAYER_META) as (keyof LayerSpec)[];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
/** Clamp into a shot dial's own range, so canvas gestures and sliders agree. */
const clampLayerField = (key: keyof LayerSpec, v: number) => {
  const meta = LAYER_META[key];
  return meta.kind === "number" ? clamp(v, meta.min, meta.max) : v;
};

/** Whether two scenes differ, ignoring the layer ids (which are just keys). */
function specDiffers(a: Spec, b: Spec): boolean {
  if (CANVAS_KEYS.some((k) => a[k] !== b[k])) return true;
  if (a.layers.length !== b.layers.length) return true;
  return a.layers.some((la, i) => LAYER_KEYS.some((k) => k !== "id" && la[k] !== b.layers[i][k]));
}

function newLayerId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `shot-${Date.now()}`;
}

// --- drawer open/shut, remembered across visits -----------------------------
let chosen: boolean | null = null;
const drawerListeners = new Set<() => void>();
const subscribeDrawer = (notify: () => void) => {
  drawerListeners.add(notify);
  return () => drawerListeners.delete(notify);
};
const drawerNow = () => {
  if (chosen === null) {
    const saved = window.localStorage.getItem(DRAWER_KEY);
    if (saved !== null) chosen = saved === "open";
  }
  return chosen ?? !window.matchMedia(PHONE_QUERY).matches;
};
const drawerOnServer = () => true;
const setDrawer = (open: boolean) => {
  chosen = open;
  try {
    window.localStorage.setItem(DRAWER_KEY, open ? "open" : "shut");
  } catch {
    /* private mode */
  }
  drawerListeners.forEach((notify) => notify());
};

const subscribePhone = (notify: () => void) => {
  const media = window.matchMedia(PHONE_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const phoneNow = () => window.matchMedia(PHONE_QUERY).matches;
const phoneOnServer = () => false;

function loadSpec(initialSpec?: Spec): Spec {
  try {
    // A shared template link wins over what this browser remembers. It's spent
    // on arrival — cleared from the address bar so a later save doesn't get
    // stomped by re-reading a stale hash.
    const shared = fromShareHash(window.location.hash);
    if (shared) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      return shared;
    }
    // A specific look the caller asked to open (a `?look=` link on the site,
    // resolved to its spec before mount). It beats this browser's saved work so
    // the gallery always opens the tile that was clicked; a live share hash
    // above still wins, being the more explicit intent.
    if (initialSpec) return initialSpec;
    const raw = window.localStorage.getItem(SPEC_KEY);
    return raw ? coerceSpec(JSON.parse(raw)) : DEFAULT_SPEC;
  } catch {
    return initialSpec ?? DEFAULT_SPEC;
  }
}

export function Editor({ initialSpec }: { initialSpec?: Spec } = {}) {
  const [spec, setSpec] = useState<Spec>(DEFAULT_SPEC);
  const [baseline, setBaseline] = useState<Spec>(DEFAULT_SPEC);
  const [selected, setSelected] = useState(0);
  const specRef = useRef<Spec>(DEFAULT_SPEC);
  const baselineRef = useRef<Spec>(DEFAULT_SPEC);
  const selectedRef = useRef(0);
  useLayoutEffect(() => {
    specRef.current = spec;
    baselineRef.current = baseline;
    selectedRef.current = selected;
  });

  const [bare, setBare] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [noWebgl, setNoWebgl] = useState(false);
  const [hint, setHint] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [engine, setEngine] = useState<Engine | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const isPhone = useSyncExternalStore(subscribePhone, phoneNow, phoneOnServer);
  const open = useSyncExternalStore(subscribeDrawer, drawerNow, drawerOnServer);

  const opening = useRef<Spec | null>(null);
  useLayoutEffect(() => {
    const saved = (opening.current ??= loadSpec(initialSpec));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable on the client.
    setSpec(saved);
    setBaseline(saved);
    // initialSpec is read once, on mount, by contract: a caller that wants a
    // different look mounts a fresh editor (keyed on the look) rather than
    // changing this prop, so re-running on a change would throw away whatever
    // the visitor has dialled in since. The `opening` ref guards it regardless.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- persistence ----------------------------------------------------------
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persist = useCallback((next: Spec) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(SPEC_KEY, JSON.stringify(next));
      } catch {
        /* private mode or full */
      }
    }, 300);
  }, []);

  // A shared template link opened in a tab that's ALREADY on the tool only
  // changes the hash — the browser doesn't reload, so the mount-time load never
  // re-runs. Catch that here so pasting a link into an open tab applies it too.
  useEffect(() => {
    const onHash = () => {
      const shared = fromShareHash(window.location.hash);
      if (!shared) return;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      specRef.current = shared;
      baselineRef.current = shared;
      persist(shared);
      setSpec(shared);
      setBaseline(shared);
      setSelected((s) => Math.min(s, shared.layers.length - 1));
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [persist]);

  // --- undo -----------------------------------------------------------------
  const history = useRef<{ spec: Spec; baseline: Spec }[]>([]);
  const lastRecord = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  const [historySize, setHistorySize] = useState(0);
  const record = useCallback((current: Spec, base: Spec, key: string) => {
    const now = Date.now();
    const drag = key === lastRecord.current.key && now - lastRecord.current.at < 1500;
    lastRecord.current = { key, at: now };
    if (drag) return;
    history.current.push({ spec: current, baseline: base });
    if (history.current.length > 100) history.current.shift();
    setHistorySize(history.current.length);
  }, []);

  const change = useCallback(
    (patch: Partial<Spec>) => {
      const current = specRef.current;
      record(current, baselineRef.current, Object.keys(patch).sort().join(","));
      const next = { ...current, ...patch };
      specRef.current = next;
      persist(next);
      setSpec(next);
    },
    [persist, record],
  );

  const changeLayerAt = useCallback(
    (index: number, patch: Partial<LayerSpec>) => {
      const current = specRef.current;
      record(current, baselineRef.current, `L${index}:${Object.keys(patch).sort().join(",")}`);
      const layers = current.layers.map((l, i) => (i === index ? { ...l, ...patch } : l));
      const next = { ...current, layers };
      specRef.current = next;
      persist(next);
      setSpec(next);
    },
    [persist, record],
  );
  const changeLayer = useCallback((patch: Partial<LayerSpec>) => changeLayerAt(selectedRef.current, patch), [changeLayerAt]);

  const undoEdits = useCallback(() => change(baselineRef.current), [change]);
  const resetAll = useCallback(() => {
    record(specRef.current, baselineRef.current, "reset");
    specRef.current = DEFAULT_SPEC;
    baselineRef.current = DEFAULT_SPEC;
    persist(DEFAULT_SPEC);
    setSpec(DEFAULT_SPEC);
    setBaseline(DEFAULT_SPEC);
    setSelected(0);
  }, [persist, record]);
  const undoLast = useCallback(() => {
    const last = history.current.pop();
    if (!last) return;
    setHistorySize(history.current.length);
    lastRecord.current = { key: "", at: 0 };
    specRef.current = last.spec;
    baselineRef.current = last.baseline;
    setSpec(last.spec);
    setBaseline(last.baseline);
    setSelected((s) => Math.min(s, last.spec.layers.length - 1));
    persist(last.spec);
  }, [persist]);

  // --- shots ----------------------------------------------------------------
  const addLayer = useCallback(() => {
    const current = specRef.current;
    if (current.layers.length >= 3) return;
    const next = {
      ...current,
      layers: [
        ...current.layers,
        // Added shots land flat and centred; only the first shot gets the tilted hero pose.
        { ...DEFAULT_LAYER, id: newLayerId(), rotX: 0, rotY: 0, rotZ: 0, x: 0, y: 0 },
      ],
    };
    record(current, baselineRef.current, "add-shot");
    specRef.current = next;
    persist(next);
    setSpec(next);
    setSelected(next.layers.length - 1);
  }, [persist, record]);
  const removeLayer = useCallback(
    (index: number) => {
      const current = specRef.current;
      if (current.layers.length <= 1) return;
      const next = { ...current, layers: current.layers.filter((_, i) => i !== index) };
      record(current, baselineRef.current, "remove-shot");
      specRef.current = next;
      persist(next);
      setSpec(next);
      setSelected((s) => clamp(s > index ? s - 1 : s, 0, next.layers.length - 1));
    },
    [persist, record],
  );

  const edited = useMemo(() => specDiffers(spec, baseline), [spec, baseline]);
  const changed = useMemo(() => specDiffers(spec, DEFAULT_SPEC), [spec]);

  const onReady = useCallback((engine: Engine) => {
    engineRef.current = engine;
    setEngine(engine);
  }, []);
  const onError = useCallback(() => setNoWebgl(true), []);

  // Keep the engine's shot pictures matched to the scene. onReady can fire
  // before the saved spec has loaded, so this keys off the scene's own image
  // signature rather than reading it once at mount; imageActions then says which
  // shots to load, and — the point of the reconcile — which to clear, so undo,
  // reset and remove drop an uploaded picture instead of stranding it.
  const loadedByLayer = useRef(new Map<string, string>());
  const loadedBg = useRef("");
  const imageSig = useMemo(
    () => `${spec.background}:${spec.backgroundKey}:${spec.bgImageId}|${spec.layers.map((l) => `${l.id}=${l.imageKey}`).join(",")}`,
    [spec],
  );
  useEffect(() => {
    const engineNow = engineRef.current;
    if (!engineNow) return;
    const scene = specRef.current;
    void (async () => {
      let missing = false;
      for (const action of imageActions(loadedByLayer.current, scene.layers)) {
        if (action.kind === "clear") {
          engineNow.setImage(action.id, null);
          loadedByLayer.current.set(action.id, "");
          continue;
        }
        const blob = await getImage(action.key);
        if (!blob) {
          engineNow.setImage(action.id, null);
          loadedByLayer.current.set(action.id, "");
          missing = true;
          continue;
        }
        loadedByLayer.current.set(action.id, action.key);
        try {
          engineNow.setImage(action.id, await decodeBlobFlipped(blob));
        } catch {
          engineNow.setImage(action.id, null);
          loadedByLayer.current.set(action.id, "");
          missing = true;
        }
      }
      // The background picture: an uploaded one comes from IndexedDB (a blob), a
      // curated one straight from its bundle URL. Both decode through the same
      // <img>-based path as the shots, so every browser that can *show* the file
      // can texture with it — WebP curated backgrounds included.
      const wantBg =
        scene.background === "upload" && scene.backgroundKey
          ? `idb:${scene.backgroundKey}`
          : scene.background === "image"
            ? `url:${bgImageById(scene.bgImageId).src}`
            : "";
      if (wantBg && wantBg !== loadedBg.current) {
        try {
          const bitmap =
            scene.background === "upload"
              ? await getImage(scene.backgroundKey).then((blob) => (blob ? decodeBlobFlipped(blob) : null))
              : await decodeUrlFlipped(bgImageById(scene.bgImageId).src);
          if (bitmap) {
            loadedBg.current = wantBg;
            engineNow.setBackgroundImage(bitmap);
          } else {
            missing = true;
          }
        } catch {
          missing = true;
        }
      }
      if (missing) setToast("That image didn't survive the trip — dropped in the demo.");
    })();
  }, [engine, imageSig]);

  // Drop orphaned blobs once, a moment after opening — not on every edit, so undo
  // can still bring a removed shot's picture back within the session.
  useEffect(() => {
    if (!engine) return;
    const timer = setTimeout(() => {
      const keep = new Set<string>();
      specRef.current.layers.forEach((l) => l.imageKey && keep.add(l.imageKey));
      if (specRef.current.backgroundKey) keep.add(specRef.current.backgroundKey);
      void pruneImages(keep);
    }, 1500);
    return () => clearTimeout(timer);
  }, [engine]);

  // --- images ---------------------------------------------------------------
  const replaceSelectedImage = useCallback(
    async (file: File) => {
      try {
        const bitmap = await fileToBitmap(file);
        const key = newLayerId();
        await putImage(key, file);
        const index = selectedRef.current;
        const layer = specRef.current.layers[index];
        engineRef.current?.setImage(layer.id, bitmap);
        loadedByLayer.current.set(layer.id, key); // already on the engine; don't re-decode
        changeLayerAt(index, { imageKey: key });
        setHint(false);
      } catch (err) {
        setToast((err as Error).message);
      }
    },
    [changeLayerAt],
  );

  const shotFileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const onBackgroundFile = useCallback(async (file: File) => {
    try {
      const bitmap = await fileToBitmap(file);
      const key = newLayerId();
      await putImage(key, file);
      engineRef.current?.setBackgroundImage(bitmap);
      loadedBg.current = `idb:${key}`; // already on the engine; don't re-decode
      change({ background: "upload", backgroundKey: key });
    } catch (err) {
      setToast((err as Error).message);
    }
  }, [change]);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((it) => it.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) void replaceSelectedImage(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [replaceSelectedImage]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void replaceSelectedImage(file);
  };

  // --- direct manipulation on the stage -------------------------------------
  const drag = useRef<{ id: number; index: number; startX: number; startY: number; layerX: number; layerY: number } | null>(null);
  const onStagePointerDown = (event: ReactPointerEvent) => {
    // A control floating over the scene (the export menu, the scene chips) owns
    // its own press — don't let the stage grab the pointer and start a drag,
    // which would swallow the button's click when a shot is dragged under it.
    if ((event.target as HTMLElement).closest("[data-stage-ui]")) return;
    if (bare) {
      setBare(false);
      return;
    }
    if (isPhone && open) {
      setDrawer(false);
      return;
    }
    const engine = engineRef.current;
    if (!engine) return;
    const id = engine.pick(event.clientX, event.clientY);
    if (!id) return; // empty space keeps the current shot selected
    const index = specRef.current.layers.findIndex((l) => l.id === id);
    if (index < 0) return;
    setSelected(index);
    const layer = specRef.current.layers[index];
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, index, startX: event.clientX, startY: event.clientY, layerX: layer.x, layerY: layer.y };
    setHint(false);
  };
  const onStagePointerMove = (event: ReactPointerEvent) => {
    const d = drag.current;
    const engine = engineRef.current;
    if (!d || !engine) return;
    const scale = engine.worldPerPx();
    changeLayerAt(d.index, {
      x: clampLayerField("x", d.layerX + (event.clientX - d.startX) * scale),
      y: clampLayerField("y", d.layerY - (event.clientY - d.startY) * scale),
    });
  };
  const onStagePointerUp = (event: ReactPointerEvent) => {
    if (!drag.current) return;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    drag.current = null;
  };

  // Wheel-to-zoom the shot under the pointer. A native, non-passive listener,
  // not React's onWheel: React registers wheel passively, which drops some
  // real wheel events, and a passive listener could not preventDefault the
  // page's own scroll here either.
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      const engine = engineRef.current;
      if (!engine || bare) return;
      const id = engine.pick(event.clientX, event.clientY);
      const index = id ? specRef.current.layers.findIndex((l) => l.id === id) : selectedRef.current;
      if (index < 0) return;
      event.preventDefault();
      const layer = specRef.current.layers[index];
      changeLayerAt(index, { zoom: clampLayerField("zoom", layer.zoom * (1 - event.deltaY * 0.0015)) });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bare, changeLayerAt]);

  // --- H hides the tools ----------------------------------------------------
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (bare) {
        setBare(false);
        return;
      }
      if (event.key === "h" || event.key === "H") setBare(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bare]);

  // The amounts to come back to when a scene chip is switched on again.
  const lastBlobs = useRef(0.5);
  useEffect(() => {
    if (spec.blobs > 0) lastBlobs.current = spec.blobs;
  }, [spec.blobs]);
  const lastBackground = useRef<Spec["background"]>("preset");
  useEffect(() => {
    if (spec.background !== "transparent") lastBackground.current = spec.background;
  }, [spec.background]);

  return (
    <div className="absolute inset-0 flex overflow-hidden bg-scr-ink">
      <div
        ref={stageRef}
        className={`relative min-w-0 flex-1 ${spec.background === "transparent" ? "scr-checker" : ""}`}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        {noWebgl ? (
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-[13px] leading-relaxed text-scr-muted">
            This needs a browser with 3D support. Try Chrome, Safari or Firefox on a desktop.
          </div>
        ) : (
          <ScreenshotPreview spec={spec} onReady={onReady} onError={onError} style={{ position: "absolute", inset: 0, padding: 24 }} />
        )}

        {dragging ? <div className="pointer-events-none absolute inset-3 rounded-2xl border-2 border-dashed border-white/40" aria-hidden /> : null}

        <p
          className="pointer-events-none absolute left-6 top-6 text-[11px] uppercase tracking-[0.16em] text-scr-faint transition-opacity duration-500"
          style={{ opacity: hint && !bare && !noWebgl ? 1 : 0 }}
          aria-hidden
        >
          Drag to move · scroll to zoom · drop an image · H hides the tools
        </p>

        <Toast message={toast} onDone={() => setToast(null)} />

        <div data-stage-ui className="pointer-events-none absolute inset-x-6 bottom-6 flex items-end justify-between gap-4 transition-opacity duration-200 motion-reduce:transition-none" style={{ opacity: bare ? 0 : 1 }}>
          <div className={bare ? "pointer-events-none" : "pointer-events-auto"}>
            <ExportMenu engine={engine} spec={spec} transparentBackdrop={spec.background === "transparent"} onToast={setToast} />
          </div>
          <div className={`flex flex-wrap justify-end gap-1.5 ${bare ? "pointer-events-none" : "pointer-events-auto"}`}>
            <button
              type="button"
              className="scr-chip scr-chip--scene"
              data-on={spec.blobs > 0 ? "" : undefined}
              aria-pressed={spec.blobs > 0}
              onClick={() => change({ blobs: spec.blobs > 0 ? 0 : lastBlobs.current })}
            >
              Blobs
            </button>
            <button
              type="button"
              className="scr-chip scr-chip--scene"
              data-on={spec.background !== "transparent" ? "" : undefined}
              aria-pressed={spec.background !== "transparent"}
              onClick={() => change({ background: spec.background === "transparent" ? lastBackground.current : "transparent" })}
            >
              Backdrop
            </button>
            <button
              type="button"
              className="scr-chip scr-chip--scene"
              onClick={() => changeLayer({ rotX: 0, rotY: 0, rotZ: 0, zoom: 1, x: 0, y: 0 })}
            >
              Reset angle
            </button>
          </div>
        </div>
      </div>

      <input
        ref={shotFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void replaceSelectedImage(file);
          e.target.value = "";
        }}
      />

      <input
        ref={bgFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onBackgroundFile(file);
          e.target.value = "";
        }}
      />

      <Drawer open={open} onOpenChange={setDrawer} hidden={bare} overlay={isPhone}>
        <DrawerHeader
          title="Screenshot"
          edited={edited}
          changed={changed}
          canUndo={historySize > 0}
          onUndo={undoLast}
          onUndoEdits={undoEdits}
          onReset={resetAll}
          onClose={() => setDrawer(false)}
        />
        <div className="shrink-0 space-y-2.5 border-b border-scr-line bg-scr-panel px-4 py-2.5">
          <LayerTabs count={spec.layers.length} selected={selected} onSelect={setSelected} onAdd={addLayer} onRemove={removeLayer} />
          <button
            type="button"
            onClick={() => shotFileRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-scr-line-strong px-3 py-2.5 text-[12px] leading-none text-scr-muted transition-colors hover:border-white/30 hover:bg-white/[0.02] hover:text-scr-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden>
              <path d="M8 10.5V3.2M5 6l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2.8 10.5v1.7c0 .6.5 1.1 1.1 1.1h8.2c.6 0 1.1-.5 1.1-1.1v-1.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {spec.layers[selected]?.imageKey ? "Replace screenshot" : "Upload screenshot"}
            <span className="text-scr-faint">· or drop / paste</span>
          </button>
        </div>
        <div className="scr-scroll scr-scroll-fade relative z-[1] min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-28 pt-3">
          <Sections
            spec={spec}
            baseline={baseline}
            selected={selected}
            onChangeCanvas={change}
            onChangeLayer={changeLayer}
            onUploadBackground={() => bgFileRef.current?.click()}
            onShuffleBlobs={() => change({ blobSeed: spec.blobSeed + 1 })}
            onStraighten={() => changeLayer({ rotX: 0, rotY: 0, rotZ: 0 })}
          />
        </div>
      </Drawer>
    </div>
  );
}
