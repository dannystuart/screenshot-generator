/**
 * The background: one full-screen quad behind everything.
 *
 * Draws a dithered gradient, an aurora (gradient + soft light lobes), a solid
 * colour, or a cover-fitted image blurred through its mip chain. Colour is kept
 * in sRGB end to end — the hex values are written straight out and the image is
 * sampled as raw bytes — so what shows is what exports, with no linear round
 * trip to wash a screenshot's colours out.
 */
import { DataTexture, GLSL3, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from "three";
import type { Texture } from "three";
import type { Spec } from "../spec";
import { backdropById } from "../backgrounds";
import { coverUv } from "../fit";

/** A hex colour as raw sRGB 0..1 — the working space here is sRGB throughout. */
function srgb(hex: string): Vector3 {
  return new Vector3(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));
}

const VERTEX = /* glsl */ `
out vec2 vUv;
void main() {
  // The quad is [-1,1]; drive clip space straight from it so it always fills
  // the frame at the far plane, behind every shot, whatever the camera does.
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform int uMode;            // 0 gradient, 1 aurora, 2 image, 3 solid
uniform vec3 uStops[3];
uniform int uStopCount;
uniform float uAngle;         // radians
uniform vec3 uGlowColor[4];
uniform vec2 uGlowPos[4];
uniform float uGlowSize[4];
uniform float uGlowRing[4];   // 0 blob, 1 ring
uniform int uGlowCount;
uniform vec3 uSolid;
uniform sampler2D uMap;
uniform vec2 uCoverScale;
uniform vec2 uCoverOffset;
uniform float uBgBlur;
uniform float uImgScale;      // background picture zoom
uniform vec2 uImgOffset;      // background picture pan, UV fractions
uniform float uImgH;          // image pixel height, for picking the blur level
uniform float uDim;
uniform float uGrain;
uniform float uAspect;        // width / height, so glows stay circular

float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  return float(n) * (1.0 / 4294967295.0);
}

// Softness: a golden-angle disc of taps over the pre-blurred mip pyramid,
// rotated per pixel. Riding the raw lod chain alone magnified the tiny deep
// levels into giant bilinear diamonds — this reads as smooth blur instead.
vec3 bgBlurSample(vec2 base, float radius) {
  float radiusPx = radius * uCoverScale.y * uImgH;
  float lod = max(log2(max(radiusPx, 1.0)) - 1.0, 0.0);
  float ang = hash(gl_FragCoord.xy + 7.0) * 6.28318;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 12; i++) {
    float f = (float(i) + 0.5) / 12.0;
    float a = ang + float(i) * 2.39996323;
    vec2 off = vec2(cos(a) / uAspect, sin(a)) * (sqrt(f) * radius);
    vec2 uv = (base + off) * uCoverScale + uCoverOffset;
    float w = exp(-2.2 * f);
    acc += textureLod(uMap, uv, lod).rgb * w;
    wsum += w;
  }
  return acc / wsum;
}

void main() {
  vec3 col;

  if (uMode == 3) {
    col = uSolid;
  } else if (uMode == 2) {
    // Reposition: zoom around the centre and pan, before the cover-fit maps
    // the framed region onto the image.
    vec2 iuv = (vUv - 0.5 - uImgOffset) / uImgScale + 0.5;
    // Perceptual curve: the dial's early travel stays subtle.
    float radius = uBgBlur * uBgBlur * 0.2;
    if (radius < 0.0005) {
      col = texture(uMap, iuv * uCoverScale + uCoverOffset).rgb;
    } else {
      col = bgBlurSample(iuv, radius);
    }
  } else {
    // Gradient base. dir points the way t increases; angle 90 = top → bottom,
    // so stop 0 sits at the top.
    vec2 dir = vec2(cos(uAngle), -sin(uAngle));
    float t = clamp(dot(vUv - 0.5, dir) + 0.5, 0.0, 1.0);
    if (uStopCount == 3) {
      col = t < 0.5 ? mix(uStops[0], uStops[1], t * 2.0)
                    : mix(uStops[1], uStops[2], (t - 0.5) * 2.0);
    } else {
      col = mix(uStops[0], uStops[1], t);
    }
    // Dither before the light lobes: an undithered dark gradient bands badly.
    float dn = hash(gl_FragCoord.xy) + hash(gl_FragCoord.xy + 17.0) - 1.0; // triangular -1..1
    col += dn / 96.0;

    if (uMode == 1) {
      for (int i = 0; i < 4; i++) {
        if (i >= uGlowCount) break;
        vec2 p = vUv - uGlowPos[i];
        p.x *= uAspect;
        float s = uGlowSize[i];
        float g;
        if (uGlowRing[i] > 0.5) {
          float d = length(p / s) - 1.0;
          g = exp(-(d * d) / (0.18 * 0.18));
        } else {
          g = exp(-dot(p, p) / (s * s));
        }
        col += uGlowColor[i] * g;
      }
    }
  }

  // Full range: 0 leaves the background untouched, 1 takes it all the way to black.
  col = mix(col, vec3(0.0), uDim);
  float gn = hash(gl_FragCoord.xy + 31.0) + hash(gl_FragCoord.xy + 47.0) - 1.0;
  col += gn * uGrain * 0.05;
  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export interface BackgroundLayer {
  mesh: Mesh;
  /** Update every uniform from the spec; aspect keeps glows and cover-fit true. */
  update(spec: Spec, canvasW: number, canvasH: number): void;
  /** The user's background image, or null for a preset/solid/transparent. */
  setImage(texture: Texture | null): void;
  /** False in transparent mode, when the quad is not drawn at all. */
  visible(): boolean;
  dispose(): void;
}

const MODE = { gradient: 0, aurora: 1, image: 2, solid: 3 } as const;

export function createBackgroundLayer(): BackgroundLayer {
  // A 1×1 stand-in keeps the sampler bound when there is no image, so the
  // driver never warns about an unset texture.
  const blank = new DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  blank.needsUpdate = true;

  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uMode: { value: MODE.gradient },
      uStops: { value: [new Vector3(), new Vector3(), new Vector3()] },
      uStopCount: { value: 2 },
      uAngle: { value: Math.PI / 2 },
      uGlowColor: { value: [new Vector3(), new Vector3(), new Vector3(), new Vector3()] },
      uGlowPos: { value: [new Vector2(), new Vector2(), new Vector2(), new Vector2()] },
      uGlowSize: { value: [0, 0, 0, 0] },
      uGlowRing: { value: [0, 0, 0, 0] },
      uGlowCount: { value: 0 },
      uSolid: { value: new Vector3() },
      uMap: { value: blank },
      uCoverScale: { value: new Vector2(1, 1) },
      uCoverOffset: { value: new Vector2(0, 0) },
      uBgBlur: { value: 0 },
      uImgScale: { value: 1 },
      uImgOffset: { value: new Vector2(0, 0) },
      uImgH: { value: 1 },
      uDim: { value: 0 },
      uGrain: { value: 0 },
      uAspect: { value: 1 },
    },
  });

  const mesh = new Mesh(new PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;

  let image: Texture | null = null;
  let visibleNow = true;

  const u = material.uniforms;

  return {
    mesh,
    setImage(texture) {
      image = texture;
      u.uMap.value = texture ?? blank;
      if (texture?.image) {
        const img = texture.image as { width: number; height: number };
        u.uImgH.value = Math.max(1, img.height);
      }
    },
    update(spec, canvasW, canvasH) {
      const aspect = canvasW / canvasH;
      u.uAspect.value = aspect;
      u.uDim.value = spec.bgDim;
      u.uGrain.value = spec.grain;
      visibleNow = spec.background !== "transparent";
      mesh.visible = visibleNow;

      if (spec.background === "solid") {
        u.uMode.value = MODE.solid;
        (u.uSolid.value as Vector3).copy(srgb(spec.backdropColor));
        return;
      }

      if (spec.background === "image" || spec.background === "upload") {
        u.uMode.value = MODE.image;
        u.uBgBlur.value = spec.bgBlur;
        u.uImgScale.value = spec.bgScale;
        // Screen y runs down but the sampled texture's v runs up, so the
        // vertical pan negates to move the picture the way the dial points.
        (u.uImgOffset.value as Vector2).set(spec.bgX * 0.5, -spec.bgY * 0.5);
        if (image?.image) {
          const img = image.image as { width: number; height: number };
          const cover = coverUv(img.width, img.height, canvasW, canvasH);
          (u.uCoverScale.value as Vector2).set(cover.scale[0], cover.scale[1]);
          (u.uCoverOffset.value as Vector2).set(cover.offset[0], cover.offset[1]);
        }
        return;
      }

      // preset — gradient or aurora
      const backdrop = backdropById(spec.backdropId);
      u.uMode.value = MODE[backdrop.kind];
      u.uAngle.value = (backdrop.angle * Math.PI) / 180;
      const stops = u.uStops.value as Vector3[];
      backdrop.stops.forEach((hex, i) => stops[i].copy(srgb(hex)));
      u.uStopCount.value = backdrop.stops.length;

      const glow = backdrop.glow ?? [];
      u.uGlowCount.value = Math.min(4, glow.length);
      const colors = u.uGlowColor.value as Vector3[];
      const pos = u.uGlowPos.value as Vector2[];
      const size = u.uGlowSize.value as number[];
      const ring = u.uGlowRing.value as number[];
      for (let i = 0; i < 4; i++) {
        const g = glow[i];
        if (g) {
          colors[i].copy(srgb(g.color));
          pos[i].set(g.x, g.y);
          size[i] = g.size;
          ring[i] = g.ring ? 1 : 0;
        } else {
          size[i] = 0;
          ring[i] = 0;
        }
      }
    },
    visible() {
      return visibleNow;
    },
    dispose() {
      blank.dispose();
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
