/**
 * The blob overlay: one full-screen quad drawn after every shot.
 *
 * A handful of soft gaussian orbs, screen-blended so where they overlap they
 * bloom rather than just stack — bokeh floating in front of the lens. Their
 * arrangement is a single seed through mulberry32, so the shuffle button is
 * just the next seed and the same seed always draws the same orbs.
 */
import {
  AddEquation,
  CustomBlending,
  GLSL3,
  Mesh,
  OneFactor,
  OneMinusDstAlphaFactor,
  OneMinusDstColorFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import type { Spec } from "../spec";
import { mulberry32 } from "../rng";

const MAX_BLOBS = 8;
/** blobs dial 1 → this many orbs. */
const FULL_COUNT = 6;

function srgb(hex: string): Vector3 {
  return new Vector3(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));
}

const VERTEX = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform vec2 uPos[${MAX_BLOBS}];
uniform float uRadius[${MAX_BLOBS}];
uniform vec3 uColor[${MAX_BLOBS}];
uniform int uCount;
uniform float uAspect;

void main() {
  vec3 col = vec3(0.0);
  float cov = 0.0;
  for (int i = 0; i < ${MAX_BLOBS}; i++) {
    if (i >= uCount) break;
    vec2 p = vUv - uPos[i];
    p.x *= uAspect;               // circular in screen space
    float r = uRadius[i];
    float g = exp(-dot(p, p) / (r * r)) * 0.55;
    col += uColor[i] * g;
    cov += g;
  }
  fragColor = vec4(col, clamp(cov, 0.0, 1.0));
}
`;

export interface BlobLayer {
  mesh: Mesh;
  update(spec: Spec, canvasW: number, canvasH: number): void;
  dispose(): void;
}

export function createBlobLayer(): BlobLayer {
  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    // Screen blend: src·(1−dst) + dst, so overlapping orbs bloom toward white
    // instead of clipping.
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneMinusDstColorFactor,
    blendDst: OneFactor,
    blendSrcAlpha: OneMinusDstAlphaFactor,
    blendDstAlpha: OneFactor,
    uniforms: {
      uPos: { value: Array.from({ length: MAX_BLOBS }, () => new Vector2()) },
      uRadius: { value: new Array(MAX_BLOBS).fill(0.2) },
      uColor: { value: Array.from({ length: MAX_BLOBS }, () => new Vector3()) },
      uCount: { value: 0 },
      uAspect: { value: 1 },
    },
  });

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 100; // after every shot

  const u = material.uniforms;

  return {
    mesh,
    update(spec, canvasW, canvasH) {
      u.uAspect.value = canvasW / canvasH;
      const count = Math.round(spec.blobs * FULL_COUNT);
      u.uCount.value = count;
      mesh.visible = count > 0;
      if (count === 0) return;

      const rng = mulberry32(spec.blobSeed);
      const pos = u.uPos.value as Vector2[];
      const radius = u.uRadius.value as number[];
      const color = u.uColor.value as Vector3[];
      for (let i = 0; i < MAX_BLOBS; i++) {
        pos[i].set(rng(), rng());
        radius[i] = (0.12 + rng() * 0.22) * (0.5 + spec.blobSize);
        color[i].copy(srgb(i % 2 === 0 ? spec.blobColor1 : spec.blobColor2));
      }
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
