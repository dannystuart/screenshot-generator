/**
 * A shot: one oversized quad with a do-everything fragment shader.
 *
 * The plane carries a margin (MARGIN× the image) so the glow, shadow, melt and
 * edge light have room to spill outside the picture. The vertex hands the
 * fragment `vLocal` — the image rect is ±uImageHalf, the margin runs past it —
 * and `vViewZ`, the depth the focus blur reads.
 *
 * The fragment builds the shot in premultiplied alpha, back to front: shadow,
 * neon glow, the motion trail, the image with its corners and frame, then a
 * directional fade or melt-into-light and a separate sparkling edge light.
 * Premultiplied output plus an additive blend lets one material do both
 * "over" and "add".
 */
import {
  AddEquation,
  CustomBlending,
  GLSL3,
  Matrix4,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import type { Texture } from "three";
import type { BlurStyle, FadeMode, FadeTexture, FocusMode, FrameStyle, LayerSpec } from "../spec";
import { layerTransform } from "../layers";
import { focusViewZ } from "../focus";

export const MARGIN = 2.2;
const IMAGE_H = 1.15;
const IMAGE_HALF_LOCAL: [number, number] = [0.5 / MARGIN, 0.5 / MARGIN];

const FRAME_INDEX: Record<FrameStyle, number> = {
  none: 0,
  line: 1,
  border: 2,
  glassLight: 3,
  glassDark: 4,
  insetLight: 5,
  insetDark: 6,
  neon: 7,
};
const FADE_INDEX: Record<FadeMode, number> = { none: 0, fade: 1, melt: 2 };
const FADE_TEXTURE_INDEX: Record<FadeTexture, number> = { smooth: 0, grain: 1, dots: 2, ascii: 3, lines: 4, pixels: 5 };
const FOCUS_MODE_INDEX: Record<FocusMode, number> = { point: 0, band: 1 };
const BLUR_STYLE_INDEX: Record<BlurStyle, number> = { soft: 0, lens: 1 };

const DEG = Math.PI / 180;

/** A hex colour as raw sRGB 0..1 — the working space is sRGB throughout. */
function srgb(hex: string): Vector3 {
  return new Vector3(...[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255));
}

const VERTEX = /* glsl */ `
out vec2 vLocal;
out float vViewZ;
uniform vec2 uImageHalf;
void main() {
  vLocal = position.xy * uImageHalf * ${(2 * MARGIN).toFixed(3)};
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const FRAGMENT = /* glsl */ `
precision highp float;
in vec2 vLocal;
in float vViewZ;
out vec4 fragColor;

uniform sampler2D uMap;
uniform vec2 uImageHalf;
uniform float uRadius;
uniform float uAperture;
uniform float uFocusZ;
uniform int uFocusMode;     // 0 point, 1 band
uniform float uBandCentre;  // band centre, local y
uniform float uBandHalf;    // band half-height, local units
uniform float uFocusSize;   // fully-sharp tolerance, 0..1
uniform int uBokeh;         // 0 soft, 1 lens
uniform vec2 uToUv;
uniform float uWorldToPx;
uniform int uFrame;         // 0 none, 1 line, 2 border, 3/4 glass, 5/6 inset, 7 neon
uniform float uFrameWidth;
uniform float uFrameOpacity;
uniform vec3 uFrameColor1;
uniform vec3 uFrameColor2;
uniform float uShadowSoft;
uniform vec2 uShadowOffset;
uniform float uGlow;
uniform float uGlowSpread;
uniform float uGlowInner;
uniform float uShadow;
uniform int uFadeMode;      // 0 none, 1 fade, 2 melt
uniform float uFadeAngle;   // radians
uniform float uFadeAmount;
uniform int uFadeTexture;   // 0 smooth, 1 grain, 2 dots, 3 ascii, 4 lines, 5 pixels
uniform vec3 uMeltColor;
uniform float uEdgeLight;
uniform float uEdgeAngle;   // radians
uniform vec3 uEdgeColor;
uniform float uEdgeSpread;  // how far the glow reaches, 0..1
uniform int uEdgeMode;      // 0 behind the shot, 1 in front (bright, spills onto it)
uniform float uStreak;
uniform float uStreakAngle; // radians
uniform float uDiffuse;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
uniform float uWarmth;

const float GOLDEN = 2.39996323;

float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Pattern value 0..1 for the dissolve styles; the threshold sweeps through it
// as t crosses the fade zone.
float dissolvePattern(vec2 p, int style) {
  if (style == 1) return hash21(floor(p * 220.0));                  // grain
  if (style == 2) {                                                  // halftone dots
    vec2 cell = fract(p * 34.0) - 0.5;
    return 1.0 - smoothstep(0.15, 0.42, length(cell));
  }
  if (style == 3) {                                                  // pseudo-ASCII
    vec2 g = floor(p * 26.0);
    vec2 inCell = fract(p * 26.0);
    // 3x5 sub-blocks toggled per cell — reads as tiny characters
    vec2 seg = floor(inCell * vec2(3.0, 5.0));
    float on = step(0.55, hash21(g + seg * 0.137));
    float pad = step(0.08, inCell.x) * step(inCell.x, 0.92) * step(0.06, inCell.y) * step(inCell.y, 0.94);
    return on * pad;
  }
  if (style == 4) return step(0.5, fract(p.y * 60.0));               // scanlines
  if (style == 5) return hash21(floor(p * 14.0));                    // chunky pixels
  return 0.5;                                                        // smooth
}

float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
             mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
}

// The blur: a golden-angle disc of taps over the pre-blurred mip pyramid
// (built CPU-side — see pyramid.ts). Each tap is already gaussian-soft, so a
// small kernel reads as continuous blur, and rotating the disc per pixel turns
// any leftover kernel structure into imperceptible fine noise instead of the
// ghost-copy banding a fixed sparse kernel produces.
vec3 dofSample(vec2 uv, float coc) {
  if (coc < 0.0006) return texture(uMap, uv).rgb;
  float cocPx = coc * uWorldToPx;
  // The mip whose built-in softness is roughly half the blur radius; the
  // taps supply the rest. Lens gets twice the taps: its bright-point
  // weighting amplifies the rotating kernel's variance into visible grain,
  // and sample count is the honest way to buy that back.
  float lod = max(log2(max(cocPx, 1.0)) - 1.0, 0.0);
  float ang = hash21(gl_FragCoord.xy) * 6.28318;
  int taps = (uBokeh == 1) ? 24 : 12;
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < 24; i++) {
    if (i >= taps) break;
    float f = (float(i) + 0.5) / float(taps);
    float a = ang + float(i) * GOLDEN;
    vec2 off = vec2(cos(a), sin(a)) * (sqrt(f) * coc) * uToUv;
    vec3 c = textureLod(uMap, uv + off, lod).rgb;
    // soft: gaussian falloff with radius; lens: flat disc, bright points win
    float w = (uBokeh == 1) ? 1.0 + pow(max(max(c.r, c.g), c.b), 4.0) * 4.0
                            : exp(-2.2 * f);
    acc += c * w;
    wsum += w;
  }
  return acc / wsum;
}

void main() {
  float r = uRadius * min(uImageHalf.x, uImageHalf.y) * 2.0;
  float d = sdRoundRect(vLocal, uImageHalf, r);
  // 1.5× the pixel footprint: one-pixel AA reads as stair-steps on the
  // near-horizontal edges a tilted card always has.
  float aa = fwidth(d) * 1.5 + 1e-5;

  // Distance to the quad's own boundary — everything painted in the margin must
  // die out before this hits zero, or the quad shows as a faint rectangle.
  vec2 quadHalf = uImageHalf * ${MARGIN.toFixed(3)};
  vec2 toEdge = quadHalf - abs(vLocal);
  float edgeWindow = smoothstep(0.0, 0.35, min(toEdge.x, toEdge.y));
  float imageA = 1.0 - smoothstep(-aa, aa, d);
  vec2 uv = vLocal / (2.0 * uImageHalf) + 0.5;

  // Directional parameter for fade / melt: t runs 0→1 toward the fading edge.
  // Melt always pours downward; only fade keeps its direction dial.
  // (-sin: screen y runs down, so fadeAngle 90 = fades downward = dir (0,-1).)
  vec2 fadeDir = (uFadeMode == 2) ? vec2(0.0, -1.0)
                                  : vec2(cos(uFadeAngle), -sin(uFadeAngle));
  float span = dot(uImageHalf, abs(fadeDir));
  float t = clamp(dot(vLocal, fadeDir) / (2.0 * span) + 0.5, 0.0, 1.4);
  float amt = max(uFadeAmount, 0.001);

  float coc;
  if (uFocusMode == 1) {
    // Tilt-shift: sharp strip in the shot's own plane, blur ramping either side.
    float dy = max(abs(vLocal.y - uBandCentre) - uBandHalf, 0.0);
    coc = uAperture * dy * 2.2;
  } else {
    // Point: depth of field, with an adjustable fully-sharp tolerance.
    float tol = uFocusSize * 0.35;
    coc = uAperture * max(abs(vViewZ - uFocusZ) - tol, 0.0);
  }
  // Melt blurs harder near the dissolve zone; detail softens before it goes.
  if (uFadeMode == 2) coc += smoothstep(1.0 - amt * 1.3, 1.0, t) * uFadeAmount * 0.5;
  vec3 image = dofSample(uv, coc);
  // Colour grading, all neutral at 1/1/1/0: contrast pivots on mid-grey,
  // brightness scales, saturation lerps toward luma, warmth pushes R vs B.
  image = (image - 0.5) * uContrast + 0.5;
  image *= uBrightness;
  float luma = dot(image, vec3(0.2126, 0.7152, 0.0722));
  image = mix(vec3(luma), image, uSaturation);
  image += vec3(uWarmth, uWarmth * 0.12, -uWarmth) * 0.18;
  image = clamp(image, 0.0, 1.0);
  // Melt drives the picture into brightness before its alpha drops — the
  // whitening leads the dissolve so content goes molten before it breaks up.
  if (uFadeMode == 2) image = mix(image, uMeltColor, smoothstep(1.0 - amt * 1.35, 1.0, t) * 0.95);

  float two = clamp(0.5 + 0.5 * (vLocal.x + vLocal.y) / (uImageHalf.x + uImageHalf.y), 0.0, 1.0);
  vec3 twoColour = mix(uFrameColor1, uFrameColor2, two);

  // Frame: a band OUTSIDE the image edge (d in 0..fw) with a bright highlight
  // hugging its outer rim. One silhouette covers image + band together and a
  // mask splits the colour — two separately-AA'd coverages meeting at d=0 left
  // a half-transparent groove the background bled through.
  float fw = uFrameWidth;
  float px = fwidth(d) + 1e-6;
  float colorMask = 0.0;
  float hairline = 0.0;
  float bevel = 0.5;
  float across = 0.0;
  if (uFrame > 0) {
    colorMask = smoothstep(-aa, aa, d);
    // A slim rim highlight scaling with the band, floored at ~1px.
    float hairW = max(fw * 0.12, 1.25 * px);
    hairline = 1.0 - smoothstep(0.35 * hairW, hairW, abs(d - (fw - hairW * 0.6)));
    // Which way this bit of frame faces on screen (the SDF's gradient), for
    // bevel lighting: 1 = facing the light above, 0 = facing away.
    vec2 nrm = normalize(vec2(dFdx(d), dFdy(d)) + vec2(1e-6));
    bevel = clamp(0.5 + 0.5 * nrm.y, 0.0, 1.0);
    across = clamp(d / max(fw, 1e-4), 0.0, 1.0);   // 0 inner rim -> 1 outer rim
  }
  float outerHalf = (uFrame > 0) ? fw : 0.0;
  float outerA = 1.0 - smoothstep(outerHalf - aa, outerHalf + aa, d);

  vec3 bandCol = uFrameColor1;
  float bandOpacity = 1.0;
  if (uFrame == 7) {                       // neon: two-colour gradient, rim glows brighter
    bandCol = twoColour * (1.0 + hairline * 0.35);
    bandOpacity = 0.92 + hairline * 0.08;
  } else if (uFrame == 2) {                // border: solid, thin keyline for definition
    float innerLine = 1.0 - smoothstep(0.5 * aa, 2.0 * aa, abs(d));
    bandCol = uFrameColor1 * (1.0 - 0.22 * innerLine);
  } else if (uFrame == 3 || uFrame == 4) { // glass: blurred image continues under a tint
    vec3 backing = textureLod(uMap, clamp(uv, 0.0, 1.0), 5.0).rgb;
    vec3 tint = (uFrame == 3) ? vec3(1.0) : vec3(0.055, 0.06, 0.075);
    float tintAmt = (uFrame == 3) ? 0.58 : 0.62;
    bandCol = mix(backing, tint, tintAmt);
    // light catches the top rim, falls away on the shaded side
    float rimGlint = hairline * (0.25 + 0.75 * bevel);
    bandCol += vec3((uFrame == 3) ? 0.35 : 0.22) * rimGlint;
    bandOpacity = (uFrame == 3) ? 0.90 : 0.94;
  } else if (uFrame == 5 || uFrame == 6) { // inset: carved-in bevel, top edge shadowed
    vec3 base = (uFrame == 5) ? vec3(0.90, 0.905, 0.925) : vec3(0.115, 0.12, 0.135);
    float carve = 1.0 - bevel;             // inset flips the light
    bandCol = base * mix(0.74, 1.18, carve) * mix(0.92, 1.06, across);
    bandCol += vec3(1.0) * hairline * 0.18 * carve;
  }                                        // line: flat colour, nothing else

  vec3 cardCol = mix(image, bandCol, colorMask);
  // Frame opacity thins only the band region (colorMask), so a low value lets
  // the scene show through the frame while the picture stays solid.
  float bandA = clamp(bandOpacity, 0.0, 1.0) * uFrameOpacity;
  float cardA = outerA * mix(1.0, bandA, colorMask);
  if (uFrame == 3) {
    float topWash = smoothstep(0.0, uImageHalf.y, vLocal.y) * 0.08 * imageA;
    cardCol = mix(cardCol, vec3(1.0), topWash);
  }

  // Soft shadow: offset and softness are theirs to dial; the exponential tail
  // keeps it a shadow rather than a grey rim traced around the silhouette.
  float dShadow = sdRoundRect(vLocal - uShadowOffset, uImageHalf, r);
  float shadowSpread = 0.03 + uShadowSoft * 0.5;
  float shadowA = exp(-max(dShadow, 0.0) / shadowSpread) * uShadow * 0.42;
  shadowA *= edgeWindow;

  // Neon glow.
  float onNeon = (uFrame == 7) ? 1.0 : 0.0;
  float glowAmt = pow(uGlow, 0.6);                 // perceptual: satisfying early travel
  float spread = uGlowSpread * 0.3 + 0.02;
  float dOut = max(d - fw, 0.0);
  float outer = exp(-dOut / spread);
  float inner = exp(-max(-d, 0.0) / spread);

  // Directional dissolve. Fade cuts a clean gradient; melt wobbles the dissolve
  // edge with value noise so the boundary reads fluid, not ruled.
  float ramp = (uFadeMode == 1) ? smoothstep(1.0 - amt, 1.0, t) : 0.0;   // 0 solid -> 1 gone
  float dirFade = 1.0;
  if (uFadeMode == 1) dirFade = 1.0 - ramp;
  if (uFadeMode == 2) {
    float wobble = (vnoise(vec2(vLocal.x * 9.0, t * 4.0)) - 0.5) * 0.18 * amt;
    dirFade = 1.0 - smoothstep(1.0 - amt, 1.0, t + wobble);
  }

  // dirFade: smooth directional fade for shadow/glow/emissives.
  // cardFade: what the card itself (image + frame) fades by — patterned when a
  // dissolve style is set, so the picture breaks apart while its light dies smoothly.
  float cardFade = dirFade;
  if (uFadeMode == 1 && uFadeTexture != 0) {
    float rampT = mix(-0.08, 1.08, ramp);
    if (uFadeTexture == 5) {
      // Pixels: each cell shrinks away on its own random cue — a designed
      // pixel dissolve, not a hard mosaic of on/off squares.
      vec2 g = vLocal / min(uImageHalf.x, uImageHalf.y) * 30.0;
      vec2 cell = floor(g);
      vec2 inC = fract(g) - 0.5;
      float cue = hash21(cell);
      float life = 1.0 - smoothstep(cue - 0.22, cue + 0.03, rampT);
      // 0.62 > half a cell: fully-alive cells tile seamlessly; the shrink
      // only becomes visible once a cell starts to go.
      float hs = 0.62 * life;
      vec2 e = fwidth(g) * 0.7 + 1e-4;
      cardFade = (1.0 - smoothstep(hs - e.x, hs + e.x, abs(inC.x)))
               * (1.0 - smoothstep(hs - e.y, hs + e.y, abs(inC.y)));
    } else {
      float pat = dissolvePattern(vLocal / min(uImageHalf.x, uImageHalf.y), uFadeTexture);
      // the pattern survives longest where it is strongest; soft 10% feather
      cardFade = 1.0 - smoothstep(pat - 0.05, pat + 0.05, rampT);
    }
  }

  // Edge / corner light (the zadriel look), independent of fade. The direction
  // snaps to the nearest of eight: four edges and four corners.
  vec2 rawEdge = vec2(cos(uEdgeAngle), -sin(uEdgeAngle));
  float snap = radians(45.0);
  float ea = floor(atan(rawEdge.y, rawEdge.x) / snap + 0.5) * snap;
  vec2 dir8 = vec2(cos(ea), sin(ea));
  float sx = abs(dir8.x) > 0.3 ? sign(dir8.x) : 0.0;
  float sy = abs(dir8.y) > 0.3 ? sign(dir8.y) : 0.0;
  // Inward distance from the lit edge on each active axis (0 at the edge, grows
  // inward, negative out in the margin so the glow spills past the edge).
  float ex = (sx != 0.0) ? (uImageHalf.x - sx * vLocal.x) : 1e9;
  float ey = (sy != 0.0) ? (uImageHalf.y - sy * vLocal.y) : 1e9;
  // The glow falls off with distance from the edge/corner in BOTH directions
  // (abs, not a clamp) so Spread genuinely governs the reach — from a whisper at
  // 0 to a wide wash near 1. A clamp here let the outward margin sit at full
  // brightness whatever the dial said, which is why Spread looked dead.
  float reach = 0.015 + uEdgeSpread * 0.4;
  float core;
  float halo;
  if (sx != 0.0 && sy != 0.0) {
    // Corner: trace the shot's own rounded outline (|its SDF|) so the glow
    // follows the corner radius and runs along both adjacent edges, gated by
    // distance from the corner so it stays gathered there and fades along the
    // sides. Following the outline is what stops it reading as a cross — there
    // are no arms shooting off the edge planes into empty space.
    float dOutline = abs(d);
    float fromCorner = length(vLocal - vec2(sx * uImageHalf.x, sy * uImageHalf.y));
    float gate = exp(-fromCorner / (reach * 3.0));
    core = exp(-dOutline / (reach * 0.3)) * gate;
    halo = exp(-dOutline / reach) * gate;
  } else {
    // Edge: distance to the edge plane, gathered toward the middle of the edge.
    float dEdge = (sx != 0.0) ? abs(ex) : abs(ey);
    float along = (sx != 0.0) ? (vLocal.y / uImageHalf.y) : (vLocal.x / uImageHalf.x);
    float lim = 1.0 - smoothstep(0.35, 1.0, abs(along));
    core = exp(-dEdge / (reach * 0.3)) * lim;
    halo = exp(-dEdge / reach) * lim;
  }
  vec3 edgeRGB = uEdgeColor * uEdgeLight * (core * 1.3 + halo * 0.8) * edgeWindow;

  // Motion trail: ghost copies of the card sliding out behind it. Each ghost is
  // the card displaced along -dir; the channels displace unequally so the trail
  // fringes red/blue. The sharp image is composited OVER this, untouched.
  vec3 trailRGB = vec3(0.0);
  float trailA = 0.0;
  if (uStreak > 0.001) {
    vec2 dir = vec2(cos(uStreakAngle), -sin(uStreakAngle));
    float len = uStreak * 0.9 * min(uImageHalf.x, uImageHalf.y);
    for (int k = 1; k <= 6; k++) {
      float f = float(k) / 6.0;
      float w = pow(1.0 - f, 1.7) * 0.5;
      vec2 off = dir * len * f;
      // silhouette of the displaced card
      float gd = sdRoundRect(vLocal + off, uImageHalf, r);
      float ga = (1.0 - smoothstep(-aa, aa, gd)) * w;
      // sample the picture where the ghost's pixels come from, channels split
      vec2 guv = (vLocal + off) / (2.0 * uImageHalf) + 0.5;
      vec2 cs = dir * len * 0.12 / (2.0 * uImageHalf);
      vec3 gc = vec3(
        texture(uMap, guv + cs).r,
        texture(uMap, guv).g,
        texture(uMap, guv - cs).b
      );
      // "under" accumulate: earlier (nearer) ghosts win
      trailRGB += gc * ga * (1.0 - trailA);
      trailA += ga * (1.0 - trailA);
    }
  }

  // Diffusion: the picture's own light, heavily blurred, blooming out past the
  // edges. Each channel samples at a slightly different scale so the halo
  // fringes spectrally at the rim — diffused light, not a tidy drop glow.
  vec3 diffRGB = vec3(0.0);
  float diffA = 0.0;
  if (uDiffuse > 0.001) {
    float reach = (0.1 + uDiffuse * 0.5) * min(uImageHalf.x, uImageHalf.y);
    float fall = exp(-max(d, 0.0) / reach);
    float lod = 3.5 + uDiffuse * 2.5;
    vec2 c = clamp(uv, 0.0, 1.0) - 0.5;
    vec3 bloom = vec3(
      textureLod(uMap, c * 0.96 + 0.5, lod).r,
      textureLod(uMap, c * 0.90 + 0.5, lod).g,
      textureLod(uMap, c * 0.84 + 0.5, lod).b
    );
    float aD = uDiffuse * fall * edgeWindow * dirFade;
    diffRGB = bloom * aD;
    // Alpha trails the light a little, so the halo brightens what's behind it
    // instead of only replacing it.
    diffA = aD * 0.7;
  }

  // --- composite, premultiplied, back to front ---
  vec4 acc = vec4(0.0, 0.0, 0.0, shadowA * dirFade);
  acc.rgb = diffRGB + acc.rgb * (1.0 - diffA);
  acc.a = min(diffA + acc.a * (1.0 - diffA), 1.0);
  float gOut = glowAmt * outer * onNeon * dirFade * edgeWindow;
  acc += vec4(twoColour * gOut, gOut);
  acc.a = min(acc.a, 1.0);
  // Edge / corner light. Behind mode composites it here, before the card, so the
  // shot occludes the inner half and only the halo spilling past the edge shows —
  // a backlight. Front mode instead adds it over the card lower down, bright and
  // spilling onto the shot itself.
  vec3 edgeLit = edgeRGB * dirFade;
  if (uEdgeMode == 0) {
    float edgeA = clamp(max(edgeLit.r, max(edgeLit.g, edgeLit.b)), 0.0, 1.0);
    acc.rgb = edgeLit + acc.rgb * (1.0 - edgeA);
    acc.a = min(edgeA + acc.a * (1.0 - edgeA), 1.0);
  }
  float ta = trailA * cardFade;
  acc.rgb = trailRGB * cardFade + acc.rgb * (1.0 - ta);
  acc.a = ta + acc.a * (1.0 - ta);
  float ca = cardA * cardFade;
  acc.rgb = cardCol * ca + acc.rgb * (1.0 - ca);
  acc.a = ca + acc.a * (1.0 - ca);

  // Emissive, on top of the card.
  vec3 emis = twoColour * (glowAmt * inner * uGlowInner * onNeon * imageA) * dirFade;
  // Front mode: the edge light spills over the shot, brighter, for the vibrant look.
  if (uEdgeMode == 1) emis += edgeLit * 1.4;
  if (uFadeMode == 2) {
    // Molten pour: a column of light below the shot that falls off with depth,
    // hugs the card's width, and shimmers with layered noise.
    float below = -(vLocal.y + uImageHalf.y);      // 0 at the bottom edge, grows downward
    if (below > -0.16) {
      float xN = vLocal.x / uImageHalf.x;          // -1..1 across the card
      float side = 1.0 - smoothstep(0.7, 1.25, abs(xN));
      float reach = (0.45 + amt * 1.5) * uImageHalf.y;
      float fall = exp(-max(below, 0.0) / max(reach * 0.5, 1e-3));
      // A hot, tight core hugging the dissolve edge, decaying into the wide wash.
      float hot = exp(-max(below, 0.0) / max(reach * 0.15, 1e-3));
      // Bloom out from under the dissolving edge — no hard switch-on line.
      float onset = smoothstep(-0.14, 0.04, below);
      // layered waviness so it reads as molten light, not a flat gradient
      float wave = 0.62 + 0.38 * vnoise(vec2(xN * 3.0 + below * 1.5, below * 5.0));
      float pour = side * (fall * 0.55 + hot * 0.95) * wave * onset * amt;
      vec3 pourCol = mix(uMeltColor, vec3(1.0), clamp(hot * 1.2, 0.0, 1.0));
      emis += pourCol * pour * 1.8 * edgeWindow;
    }
  }
  acc.rgb += emis;
  // Lift alpha to the brightest channel of the *result*, so an emissive over a
  // faded region can never leave premultiplied rgb above its alpha (which would
  // read back over-bright on a transparent export).
  acc.a = max(acc.a, clamp(max(acc.rgb.r, max(acc.rgb.g, acc.rgb.b)), 0.0, 1.0));

  fragColor = clamp(acc, 0.0, 1.0);
}
`;

export interface CardLayer {
  mesh: Mesh;
  setTexture(texture: Texture): void;
  update(layer: LayerSpec, index: number, cameraMatrixWorldInverse: Matrix4): void;
  dispose(): void;
}

export function createCardLayer(demo: Texture): CardLayer {
  const material = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: CustomBlending,
    blendEquation: AddEquation,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
    uniforms: {
      uMap: { value: demo },
      uImageHalf: { value: new Vector2(0.5, 0.5) },
      uRadius: { value: 0.06 },
      uAperture: { value: 0 },
      uFocusZ: { value: 1 },
      uFocusMode: { value: 0 },
      uBandCentre: { value: 0 },
      uBandHalf: { value: 0.125 },
      uFocusSize: { value: 0 },
      uBokeh: { value: 0 },
      uToUv: { value: new Vector2(1, 1) },
      uWorldToPx: { value: 1 },
      uFrame: { value: 0 },
      uFrameWidth: { value: 0.006 },
      uFrameOpacity: { value: 1 },
      uFrameColor1: { value: new Vector3(1, 1, 1) },
      uFrameColor2: { value: new Vector3(1, 1, 1) },
      uShadowSoft: { value: 0.45 },
      uShadowOffset: { value: new Vector2(0, -0.1) },
      uGlow: { value: 0 },
      uGlowSpread: { value: 0.4 },
      uGlowInner: { value: 0.25 },
      uShadow: { value: 0 },
      uFadeMode: { value: 0 },
      uFadeAngle: { value: Math.PI / 2 },
      uFadeAmount: { value: 0.4 },
      uFadeTexture: { value: 0 },
      uMeltColor: { value: new Vector3(1, 1, 1) },
      uEdgeLight: { value: 0 },
      uEdgeAngle: { value: -Math.PI / 2 },
      uEdgeColor: { value: new Vector3(1, 1, 1) },
      uEdgeSpread: { value: 0.4 },
      uEdgeMode: { value: 0 },
      uStreak: { value: 0 },
      uStreakAngle: { value: 0 },
      uDiffuse: { value: 0 },
      uBrightness: { value: 1 },
      uContrast: { value: 1 },
      uSaturation: { value: 1 },
      uWarmth: { value: 0 },
    },
  });

  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.frustumCulled = false;

  let texture = demo;
  const u = material.uniforms;

  function imageSize(): { aspect: number; texW: number } {
    const img = texture.image as { width?: number; height?: number } | undefined;
    const w = img?.width ?? 1;
    const h = img?.height ?? 1;
    return { aspect: h > 0 ? w / h : 1, texW: w };
  }

  return {
    mesh,
    setTexture(tex) {
      texture = tex;
      u.uMap.value = tex;
    },
    update(layer, index, cameraMatrixWorldInverse) {
      const { aspect: a, texW } = imageSize();
      (u.uImageHalf.value as Vector2).set(0.5 * a, 0.5);
      u.uRadius.value = layer.radius;

      const t = layerTransform(layer, index);
      mesh.position.set(t.position[0], t.position[1], t.position[2]);
      mesh.rotation.set(t.rotation[0], t.rotation[1], t.rotation[2]);
      const boxH = IMAGE_H * t.scale * MARGIN;
      mesh.scale.set(boxH * a, boxH, 1);
      mesh.renderOrder = index;
      mesh.updateMatrixWorld(true);

      const imgWorldW = IMAGE_H * t.scale * a;
      const imgWorldH = IMAGE_H * t.scale;
      u.uAperture.value = layer.blur * 0.45;
      u.uFocusZ.value = focusViewZ(mesh.matrixWorld, cameraMatrixWorldInverse, layer.focusX, layer.focusY, IMAGE_HALF_LOCAL);
      u.uFocusMode.value = FOCUS_MODE_INDEX[layer.focusMode];
      u.uBandCentre.value = (1 - 2 * layer.focusY) * 0.5; // pad y (0..1, down) -> local y (+0.5..-0.5)
      u.uBandHalf.value = layer.focusBand * 0.5;
      u.uFocusSize.value = layer.focusSize;
      u.uBokeh.value = BLUR_STYLE_INDEX[layer.blurStyle];
      (u.uToUv.value as Vector2).set(1 / imgWorldW, 1 / imgWorldH);
      u.uWorldToPx.value = texW / imgWorldW;

      u.uFrame.value = FRAME_INDEX[layer.frame];
      u.uFrameWidth.value = layer.frameWidth;
      u.uFrameOpacity.value = layer.frameOpacity;
      (u.uFrameColor1.value as Vector3).copy(srgb(layer.frameColor1));
      (u.uFrameColor2.value as Vector3).copy(srgb(layer.frameColor2));
      u.uGlow.value = layer.glow;
      u.uGlowSpread.value = layer.glowSpread;
      u.uGlowInner.value = layer.glowInner;
      u.uShadow.value = layer.shadow;
      u.uShadowSoft.value = layer.shadowSoftness;
      // Spec y is "down the canvas"; local y runs up, so the offset negates.
      (u.uShadowOffset.value as Vector2).set(layer.shadowX * 0.3, -layer.shadowY * 0.3);

      u.uFadeMode.value = FADE_INDEX[layer.fadeMode];
      u.uFadeAngle.value = layer.fadeAngle * DEG;
      u.uFadeAmount.value = layer.fadeAmount;
      u.uFadeTexture.value = FADE_TEXTURE_INDEX[layer.fadeTexture];
      (u.uMeltColor.value as Vector3).copy(srgb(layer.meltColor));
      u.uEdgeLight.value = layer.edgeLight;
      u.uEdgeAngle.value = layer.edgeLightAngle * DEG;
      (u.uEdgeColor.value as Vector3).copy(srgb(layer.edgeLightColor));
      u.uEdgeSpread.value = layer.edgeLightSpread;
      u.uEdgeMode.value = layer.edgeLightMode === "front" ? 1 : 0;
      u.uStreak.value = layer.streak;
      u.uStreakAngle.value = layer.streakAngle * DEG;
      u.uDiffuse.value = layer.diffuse;
      u.uBrightness.value = layer.brightness;
      u.uContrast.value = layer.contrast;
      u.uSaturation.value = layer.saturation;
      u.uWarmth.value = layer.warmth;
    },
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
    },
  };
}
