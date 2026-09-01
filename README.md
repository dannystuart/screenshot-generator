# Screenshot generator

A free screenshot beautifier. Drop in a plain screenshot and tilt it in real 3D
with camera-true focus blur, add neon frames and glows, set it on a curated
background, fade it out or melt it into light, add a chromatic motion streak or
blurry blob overlays — up to three shots on one canvas — then download a
pixel-perfect PNG.

Everything renders through one three.js WebGL engine, and the PNG export comes
from that same engine, so what you see is exactly what you get.

## Run it

```bash
pnpm install
pnpm dev
```

Then open http://localhost:3000.

Other commands:

```bash
pnpm test     # unit tests (vitest)
pnpm lint
pnpm build    # production build
```

## Using it

The tool opens on a demo shot you can restyle straight away. Drop, paste or pick
an image to replace a shot. Drag a shot on the canvas to move it, scroll to zoom
it, and press **H** to hide the tools for a clean look. The right drawer holds
everything else — up to three shots, six sections of controls (canvas, angle,
focus, frame & glow, fade & light, motion & blobs) — and the export menu sits
bottom-left: PNG at 1×/2×/4×, copy to clipboard, and a transparent-background
option.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · three.js ·
vitest. pnpm.

## Later

Ideas out of scope for v1: video export (slow drift/rotate clips) and share
links.

## Licence

MIT — see [LICENSE](LICENSE).
