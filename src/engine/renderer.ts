/**
 * The engine. One WebGLRenderer draws the whole scene — a background, up to
 * three shots, a blob overlay — and will export the same pixels it shows.
 *
 * Nothing here imports React: the preview mounts it and the export reads from
 * it, so the picture on screen and the picture on disk can never drift apart.
 * This file grows task by task; for now it owns the renderer, the camera and an
 * on-demand loop, and clears to the ink the rest of the page is painted on.
 */
import {
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Raycaster,
  SRGBColorSpace,
  Scene,
  Texture,
  TextureLoader,
  Vector2,
  WebGLRenderer,
} from "three";
import type { Spec } from "./spec";
import { createBackgroundLayer } from "./shaders/background";
import { bitmapToLevelCanvas, buildBlurPyramid } from "./pyramid";
import { createBlobLayer } from "./shaders/blobs";
import { createCardLayer, MARGIN } from "./shaders/card";
import type { CardLayer } from "./shaders/card";

/**
 * The distance that keeps a 2-unit-tall world exactly filling the frame at a
 * given vertical FOV: `halfHeight = d · tan(fov/2)` set to 1. So the Perspective
 * dial changes how steep the perspective is, never how big the shot lands.
 */
export function cameraDistance(fovDeg: number): number {
  return 1 / Math.tan(((fovDeg / 2) * Math.PI) / 180);
}

/** Anything three can upload as a texture and our pyramid can downsample. */
export type ImageSource = ImageBitmap | HTMLCanvasElement | HTMLImageElement;

export interface Engine {
  /** Diff-and-update from a new spec; cheap to call every frame. */
  setSpec(spec: Spec): void;
  /** Give a shot its picture, or null to fall back to the demo. */
  setImage(layerId: string, bitmap: ImageSource | null): void;
  /** The background image, or null for a preset/solid backdrop. */
  setBackgroundImage(bitmap: ImageSource | null): void;
  /** CSS pixels of the fitted canvas. */
  setSize(w: number, h: number): void;
  /** The id of the shot under a pointer, or null. */
  pick(clientX: number, clientY: number): string | null;
  /** World units per CSS pixel, so a drag in pixels becomes a move in the spec. */
  worldPerPx(): number;
  /** The scene as a PNG at 1×/2×/4×, optionally with no background. */
  toPng(scale: 1 | 2 | 4, transparent: boolean): Promise<Blob>;
  dispose(): void;
}

/** The image is the inner 1/MARGIN of the card plane (MARGIN lives in card.ts). */
const IMAGE_HALF_PLANE = 0.5 / MARGIN;

/** The near-black the whole instrument panel is painted on. */
const INK = 0x08090b;

export function createEngine(canvas: HTMLCanvasElement): Engine {
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
  } catch {
    throw new Error("no-webgl");
  }
  if (renderer.getContext().isContextLost()) {
    renderer.dispose();
    throw new Error("no-webgl");
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(INK, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(30, 1, 0.01, 100);
  const background = createBackgroundLayer();
  scene.add(background.mesh);
  const blobs = createBlobLayer();
  scene.add(blobs.mesh);
  const raycaster = new Raycaster();
  const ndc = new Vector2();

  let spec: Spec | null = null;
  let bgTexture: Texture | null = null;
  let width = 1;
  let height = 1;
  let raf = 0;
  let disposed = false;

  // The bundled demos: a full app for the first shot, a smaller detail card for
  // any shot behind or in front of it, so a two-shot composition reads on its
  // own. They load async; when they land the cards re-fit and redraw.
  const loader = new TextureLoader();
  const redraw = () => {
    if (spec) syncCards(spec);
    invalidate();
  };
  // Every shot/background texture gets a hand-built blur pyramid: each mip is
  // gaussian-softened, so the focus and softness dials sample true smooth blur
  // instead of the GPU's blocky auto mips (which banded and ghosted).
  function applyPyramid(tex: Texture, image: ImageSource) {
    // Bitmaps go through a flipped canvas first, or the blurred levels come
    // out upside down relative to the sharp one (see pyramid.ts).
    const source = image instanceof ImageBitmap ? bitmapToLevelCanvas(image) : image;
    if (!source) return;
    // The sharp level must ride the same canvas upload path as the blurred
    // ones: browsers disagree on whether a bitmap's baked flip survives a
    // direct GPU upload, and a level-0 that disagrees with its own mips shows
    // as a background that flips as the softness dial moves.
    if (image instanceof ImageBitmap) tex.image = source;
    const levels = buildBlurPyramid(source);
    if (levels.length > 1) {
      // three's mipmap typing only names canvases, but any TexImageSource
      // uploads fine; the head of the chain can be a bitmap or an <img>.
      tex.mipmaps = levels as unknown as HTMLCanvasElement[];
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
    }
  }
  function configureDemo(tex: Texture) {
    tex.colorSpace = LinearSRGBColorSpace;
    tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.magFilter = LinearFilter;
  }
  const demoTexture = loader.load("/demo/shot.png", (tex) => {
    applyPyramid(tex, tex.image as HTMLImageElement);
    redraw();
  });
  configureDemo(demoTexture);
  const detailTexture = loader.load("/demo/detail.png", (tex) => {
    applyPyramid(tex, tex.image as HTMLImageElement);
    redraw();
  });
  configureDemo(detailTexture);

  // Uploaded shot pictures, keyed by the layer id that owns them.
  const layerTextures = new Map<string, Texture>();

  // One card mesh per shot, kept in step with spec.layers.
  const cards: CardLayer[] = [];
  function syncCards(next: Spec) {
    while (cards.length < next.layers.length) {
      const card = createCardLayer(demoTexture);
      cards.push(card);
      scene.add(card.mesh);
    }
    while (cards.length > next.layers.length) {
      const card = cards.pop()!;
      scene.remove(card.mesh);
      card.dispose();
    }
    next.layers.forEach((layer, i) => {
      const fallback = i === 0 ? demoTexture : detailTexture;
      cards[i].setTexture(layerTextures.get(layer.id) ?? fallback);
      cards[i].update(layer, i, camera.matrixWorldInverse);
    });
  }

  // The world is 2 units tall; the camera sits back far enough that those two
  // units fill the frame, and lookAt keeps the shot centred.
  function placeCamera(fov: number) {
    camera.fov = fov;
    camera.position.set(0, 0, cameraDistance(fov));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    // The cards need the view matrix now, before the render computes it, to work
    // out each shot's focus depth.
    camera.updateMatrixWorld(true);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  }

  // On-demand: nothing here moves on its own, so a frame is only drawn when a
  // setter asks for one. A continuous loop would burn the GPU on a still image.
  function invalidate() {
    if (!raf && !disposed) raf = requestAnimationFrame(frame);
  }
  function frame() {
    raf = 0;
    if (!disposed) draw();
  }
  function draw() {
    renderer.render(scene, camera);
  }

  placeCamera(30);
  invalidate();

  return {
    setSpec(next) {
      spec = next;
      placeCamera(next.perspective);
      background.update(next, width, height);
      syncCards(next);
      blobs.update(next, width, height);
      // Transparent mode hides the quad; clear with no alpha so the checker
      // stage shows through the preview and the export carries real alpha.
      renderer.setClearColor(INK, background.visible() ? 1 : 0);
      invalidate();
    },
    setImage(layerId, bitmap) {
      const previous = layerTextures.get(layerId);
      if (previous) previous.dispose();
      if (bitmap) {
        const tex = new Texture(bitmap);
        tex.colorSpace = LinearSRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
        tex.flipY = false; // the bitmap is decoded already flipped (see UploadZone)
        tex.needsUpdate = true;
        applyPyramid(tex, bitmap);
        layerTextures.set(layerId, tex);
      } else {
        layerTextures.delete(layerId);
      }
      if (spec) syncCards(spec);
      invalidate();
    },
    setBackgroundImage(bitmap) {
      bgTexture?.dispose();
      if (bitmap) {
        const tex = new Texture(bitmap);
        // Raw sRGB bytes (the sRGB pipeline), mipped so the softness dial can
        // blur it through textureLod without banding.
        tex.colorSpace = LinearSRGBColorSpace;
        tex.generateMipmaps = true;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.magFilter = LinearFilter;
        tex.flipY = false; // the bitmap is decoded already flipped (see UploadZone)
        tex.needsUpdate = true;
        applyPyramid(tex, bitmap);
        bgTexture = tex;
        background.setImage(tex);
      } else {
        bgTexture = null;
        background.setImage(null);
      }
      if (spec) background.update(spec, width, height);
      invalidate();
    },
    setSize(w, h) {
      const nextW = Math.max(1, Math.round(w));
      const nextH = Math.max(1, Math.round(h));
      if (nextW === width && nextH === height) return;
      width = nextW;
      height = nextH;
      renderer.setSize(nextW, nextH);
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      if (spec) {
        background.update(spec, width, height);
        blobs.update(spec, width, height);
      }
      // Drawn now, not next frame: resizing the buffer wipes the canvas, and a
      // frame queued for later would leave it blank until it lands.
      draw();
    },
    pick(clientX, clientY) {
      if (!spec) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return null;
      ndc.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -(((clientY - rect.top) / rect.height) * 2 - 1),
      );
      raycaster.setFromCamera(ndc, camera);
      // Front to back: a later shot sits over an earlier one.
      for (let i = cards.length - 1; i >= 0; i--) {
        const hits = raycaster.intersectObject(cards[i].mesh, false);
        if (hits.length === 0) continue;
        const local = cards[i].mesh.worldToLocal(hits[0].point.clone());
        // Only the picture counts as the shot, not its glow/shadow margin.
        if (Math.abs(local.x) <= IMAGE_HALF_PLANE + 0.01 && Math.abs(local.y) <= IMAGE_HALF_PLANE + 0.01) {
          return spec.layers[i]?.id ?? null;
        }
      }
      return null;
    },
    worldPerPx() {
      // The world is 2 units tall and the canvas is `height` CSS pixels tall.
      return 2 / height;
    },
    async toPng(scale, transparent) {
      if (!spec) throw new Error("Nothing to export yet.");
      // Render into a throwaway renderer at the export resolution, so the live
      // canvas never resizes or flickers. The scene, camera and textures are
      // shared; three just re-uploads them into this one-shot context.
      const cap = 16384; // the GPU's largest buffer, roughly
      let w = Math.round(spec.width * scale);
      let h = Math.round(spec.height * scale);
      if (w > cap || h > cap) {
        const f = cap / Math.max(w, h);
        w = Math.round(w * f);
        h = Math.round(h * f);
      }
      const offCanvas = document.createElement("canvas");
      const off = new WebGLRenderer({ canvas: offCanvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true });
      off.setPixelRatio(1);
      off.outputColorSpace = SRGBColorSpace;
      off.setSize(w, h, false);

      const wantTransparent = transparent || !background.visible();
      off.setClearColor(INK, wantTransparent ? 0 : 1);
      const bgWasVisible = background.mesh.visible;
      if (wantTransparent) background.mesh.visible = false;

      const prevAspect = camera.aspect;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      off.render(scene, camera);
      camera.aspect = prevAspect;
      camera.updateProjectionMatrix();
      if (wantTransparent) background.mesh.visible = bgWasVisible;

      try {
        return await new Promise<Blob>((resolve, reject) => {
          offCanvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Export failed."))), "image/png");
        });
      } finally {
        off.dispose();
        off.forceContextLoss();
      }
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      for (const card of cards) card.dispose();
      for (const tex of layerTextures.values()) tex.dispose();
      layerTextures.clear();
      background.dispose();
      blobs.dispose();
      bgTexture?.dispose();
      demoTexture.dispose();
      detailTexture.dispose();
      // Deferred: the preview hands each mount a fresh canvas, but a context
      // lost synchronously in cleanup can still be the one a StrictMode remount
      // reaches for.
      setTimeout(() => {
        renderer.dispose();
        renderer.forceContextLoss();
      }, 0);
    },
  };
}
