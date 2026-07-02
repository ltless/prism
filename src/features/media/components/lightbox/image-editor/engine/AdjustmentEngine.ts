import type { AdjustmentState, CurvePoint, HSLAdjustment, PhotoFilter, ChannelMixer, SelectiveColorAdjustment, SplitToning, GradientMap, Levels } from "../state/editorState";

/**
 * Adjustment engine: pure pixel pipeline. applyAdjustments(state, imageData)
 * runs each adjustment in a fixed order, mutates imageData.data in place,
 * returns the same imageData for chaining.
 *
 * Composition order matters (Photoshop-style):
 *   1. Exposure / brightness / contrast (basic light)
 *   2. Highlights / shadows / whites / blacks (tone targeting)
 *   3. Temperature / tint / hue / saturation / vibrance (color)
 *   4. Clarity / texture / dehaze (local/tone)
 *   5. Sharpen / noise reduction / blur (detail)
 *   6. Vignette / grain (effects — applied last on top of everything)
 *
 * Neutral defaults short-circuit and skip the work. No-op = free.
 */

function isNeutralLevels(l: Levels): boolean {
  return l.inBlack === 0 && l.inWhite === 255 && l.gamma === 1
    && l.outBlack === 0 && l.outWhite === 255;
}

export function hasActiveAdjustments(state: AdjustmentState): boolean {
  if (state.exposure !== 0) return true;
  if (state.contrast !== 0) return true;
  if (state.brightness !== 0) return true;
  if (state.gamma !== 1) return true;
  if (state.temperature !== 0) return true;
  if (state.tint !== 0) return true;
  if (state.hue !== 0) return true;
  if (state.saturation !== 0) return true;
  if (state.vibrance !== 0) return true;
  if (state.highlights !== 0) return true;
  if (state.shadows !== 0) return true;
  if (state.whites !== 0) return true;
  if (state.blacks !== 0) return true;
  if (state.clarity !== 0) return true;
  if (state.texture !== 0) return true;
  if (state.dehaze !== 0) return true;
  if (state.sharpening !== 0) return true;
  if (state.noiseReduction !== 0) return true;
  if (state.vignette !== 0) return true;
  if (state.grain !== 0) return true;
  if (state.curvePoints?.length) return true;
  if (state.levels && !isNeutralLevels(state.levels)) return true;
  if (state.posterize !== 0) return true;
  if (state.threshold !== 0) return true;
  if (state.invert) return true;
  if (state.solarize !== 0) return true;
  if (state.duotone) return true;
  if (state.tritone) return true;
  if (state.quadtone) return true;
  if (state.lensCorrections) return true;
  if (state.perspective) return true;
  for (const color of Object.values(state.hsl ?? {})) {
    if (color && (color.hue !== 0 || color.saturation !== 0 || color.luminance !== 0)) return true;
  }
  return false;
}

export function applyAdjustments(
  state: AdjustmentState,
  imageData: ImageData,
  isDragging?: boolean
): ImageData {
  if (!hasActiveAdjustments(state)) return imageData;
  let current = imageData;

  // Per-channel basics composed into a single LUT.
  // exposure/contrast/brightness/gamma/temperature/tint are each pure functions
  // of their channel's input value, so we compose them into a 256-entry table
  // per channel (built on an identity ramp, reusing the exact per-op math →
  // bit-identical output) and apply in one pass instead of six.
  const prefixLut = buildPrefixLut(state);
  if (prefixLut) {
    applyPrefixLut(current.data, prefixLut);
  }

  // Hue / Saturation / Vibrance each do an rgbToHsl↔hslToRgb round trip per
  // pixel. Composing them into one pass collapses 3 HSL conversions → 1.
  current = applyHslAdjustments(state, current);

  current = applyHSL(state.hsl, current);
  current = applySplitToning(state.splitToning, current);
  current = applyPhotoFilter(state.photoFilter, current);
  current = applyChannelMixer(state.channelMixer, current);
  current = applySelectiveColor(state.selectiveColor, current);
  current = applyGradientMap(state.gradientMap, current);

  // Tone targeting
  current = applyHighlights(state.highlights, current);
  current = applyShadows(state.shadows, current);
  current = applyWhites(state.whites, current);
  current = applyBlacks(state.blacks, current);

  // Local/tone adjustments
  current = applyClarity(state.clarity, current);
  if (!isDragging) {
    current = applyTexture(state.texture, current);
    current = applyDehaze(state.dehaze, current);
  }

  // Detail
  if (!isDragging) {
    current = applySharpening(
      state.sharpening,
      state.sharpeningRadius,
      state.sharpeningDetail,
      state.sharpeningMasking,
      current
    );
    current = applyNoiseReduction(
      state.noiseReduction,
      state.noiseReductionDetail,
      current
    );
  }


  // Effects
  current = applyVignette(state.vignette, current);
  current = applyGrain(state.grain, current);

  // Blur (Gaussian, Median, Motion)
  if (!isDragging) {
    if (state.gaussianBlur) {
      current = applyGaussianBlur(state.gaussianBlur, current);
    }
    if (state.medianFilter) {
      current = applyMedianFilter(state.medianFilter, current);
    }
    if (state.motionBlur && state.motionBlur.distance > 0) {
      current = applyMotionBlur(state.motionBlur.angle, state.motionBlur.distance, current);
    }
  }

  // Advanced
  if (state.curvePoints && state.curvePoints.length > 0) {
    current = applyCurve(state.curvePoints, current);
  }

  if (state.levels) {
    current = applyLevels(state.levels, current);
  }
  current = applyPosterize(state.posterize, current);
  current = applyThreshold(state.threshold, current);
  current = applyDuotone(state.duotone, current);
  current = applyTritone(state.tritone, current);
  current = applyQuadtone(state.quadtone, current);
  current = applyInvert(state.invert, current);
  current = applySolarize(state.solarize, current);
  if (state.lensCorrections) {
    current = applyLensCorrections(state.lensCorrections, current);
  }
  if (state.perspective) {
    current = applyPerspective(state.perspective, current);
  }

  return current;
}

// ---------------------------------------------------------------------------
// Composed fast paths. Collapse multiple per-pixel passes into one where the
// math allows it. Output stays bit-identical for single-op cases (what the
// test suite covers).
// ---------------------------------------------------------------------------

/**
 * Build a per-channel LUT composing the basic per-channel adjustments:
 * exposure, contrast, brightness, gamma, temperature, tint.
 *
 * Trick: run the EXISTING per-op functions on a 256×1 identity ramp
 * (pixel i = (i,i,i,255)). Because each op is a pure function of its channel's
 * input value (temperature/tint differ per-channel but each channel's output
 * still depends only on that channel's input), the ramp's R/G/B columns after
 * running the ops ARE the composed lookup table. This reuses the exact per-op
 * math — including Uint8ClampedArray rounding — so output is bit-identical to
 * running the ops individually on the full image.
 *
 * Returns {lutR, lutG, lutB} (each 256 entries) or null when none of the
 * prefix ops are active.
 */
function buildPrefixLut(state: AdjustmentState): {
  lutR: Uint8ClampedArray;
  lutG: Uint8ClampedArray;
  lutB: Uint8ClampedArray;
} | null {
  if (
    state.exposure === 0 &&
    state.contrast === 0 &&
    state.brightness === 0 &&
    state.gamma === 1 &&
    state.temperature === 0 &&
    state.tint === 0
  ) {
    return null;
  }

  // 256×1 RGBA identity ramp: pixel i = (i, i, i, 255)
  const rampData = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    rampData[i * 4] = i;
    rampData[i * 4 + 1] = i;
    rampData[i * 4 + 2] = i;
    rampData[i * 4 + 3] = 255;
  }
  const ramp = new ImageData(rampData, 256, 1);

  // Run the per-op functions in pipeline order. They mutate the ramp in place
  // (returning the same ImageData), so we don't need to capture the result.
  // Neutral ops short-circuit.
  applyExposure(state.exposure, ramp);
  applyContrast(state.contrast, ramp);
  applyBrightness(state.brightness, ramp);
  applyGamma(state.gamma, ramp);
  applyTemperature(state.temperature, ramp);
  applyTint(state.tint, ramp);

  // Split into three 256-entry channel tables (avoids a multiply per lookup).
  const lutR = new Uint8ClampedArray(256);
  const lutG = new Uint8ClampedArray(256);
  const lutB = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lutR[i] = rampData[i * 4];
    lutG[i] = rampData[i * 4 + 1];
    lutB[i] = rampData[i * 4 + 2];
  }
  return { lutR, lutG, lutB };
}

/** Apply a per-channel LUT (3×256) to an RGBA pixel buffer in one pass. */
function applyPrefixLut(
  data: Uint8ClampedArray,
  lut: { lutR: Uint8ClampedArray; lutG: Uint8ClampedArray; lutB: Uint8ClampedArray }
): void {
  const { lutR, lutG, lutB } = lut;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lutR[data[i]];
    data[i + 1] = lutG[data[i + 1]];
    data[i + 2] = lutB[data[i + 2]];
  }
}

/**
 * Composed Hue + Saturation + Vibrance in a single rgbToHsl↔hslToRgb pass.
 *
 * The original pipeline ran three separate functions, each doing a full
 * rgbToHsl + hslToRgb per pixel — the most expensive per-pixel work in the
 * engine (HSL conversion is ~35 ops vs ~3 for a multiply). Composing collapses
 * 3 conversions → 1.
 *
 * Order preserved: hue → saturation → vibrance (matches the original call
 * order). For single-op cases (only one of the three non-default), output is
 * bit-identical to the original standalone function. For multi-op cases, the
 * composed version skips intermediate RGB rounding and may differ by ≤1 per
 * channel — visually imperceptible and more accurate.
 */
function applyHslAdjustments(state: AdjustmentState, imageData: ImageData): ImageData {
  const hasHue = state.hue !== 0;
  const hasSat = state.saturation !== 0;
  const hasVib = state.vibrance !== 0;
  if (!hasHue && !hasSat && !hasVib) return imageData;

  const data = imageData.data;
  const hueShift = state.hue / 360; // normalized [0,1)
  const satFactor = 1 + state.saturation / 100;
  const v = state.vibrance / 100; // -1..+1

  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);

    let newH = h;
    let newS = s;

    if (hasHue) {
      newH = (h + hueShift + 1) % 1; // wrap to [0,1)
    }
    if (hasSat) {
      newS = Math.max(0, Math.min(1, s * satFactor));
    }
    if (hasVib) {
      // Skin tone protection uses the (possibly hue-rotated) hue, matching the
      // original pipeline order: hue → saturation → vibrance.
      const hueDeg = newH * 360;
      const isSkinTone = hueDeg >= 0 && hueDeg <= 50;
      const skinProtection = isSkinTone ? 0.5 : 1.0;
      if (v > 0) {
        newS = newS + (1 - newS) * v * skinProtection;
      } else {
        newS = newS * (1 + v);
      }
      newS = Math.max(0, Math.min(1, newS));
    }

    const [r, g, b] = hslToRgb(newH, newS, l);
    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  return imageData;
}

// ---------------------------------------------------------------------------
// Individual adjustment functions
// ---------------------------------------------------------------------------

// Clamp helper — reused by every adjustment that needs to bound output
// to the [0, 255] byte range. Math.max/Math.min are V8 intrinsics so this
// is effectively free compared to a branchy if/else.
function clamp(v: number, min = 0, max = 255): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

// Luminance helper — ITU-R BT.601 (same as Photoshop's luminance channel).
// Used by tone control to build luminance-based masks.
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// ─── RGB ↔ HSL conversion utilities ──────────────────────────────────────
// Used by Hue, Saturation, Vibrance adjustments.
// All values normalized: RGB in [0,255], HSL in [0,1] (hue wraps at 1).

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);

    switch (max) {
      case rn:
        h = (gn - bn) / delta + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / delta + 2;
        break;
      case bn:
        h = (rn - gn) / delta + 4;
        break;
    }
    h /= 6;
  }

  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    // Achromatic (gray)
    const v = l * 255;
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return [
    hue2rgb(p, q, h + 1 / 3) * 255,
    hue2rgb(p, q, h) * 255,
    hue2rgb(p, q, h - 1 / 3) * 255,
  ];
}

function applyExposure(stops: number, imageData: ImageData): ImageData {
  if (stops === 0) return imageData;

  // Photoshop-style: each +1 stop = 2× brightness, -1 stop = ½ brightness.
  // multiplier = 2^stops works for both positive and negative stops.
  const multiplier = Math.pow(2, stops);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Touch R, G, B. Alpha (i+3) is left alone — all adjustments preserve
    // transparency, and off-by-one errors here silently corrupt images.
    data[i] = data[i] * multiplier;
    data[i + 1] = data[i + 1] * multiplier;
    data[i + 2] = data[i + 2] * multiplier;
  }

  return imageData;
}

function applyContrast(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Linear stretch around midpoint (128).
  // - value=0: factor=1 (identity)
  // - value=+100: factor=2 (max contrast — extremes clamp to 0 or 255)
  // - value=-100: factor=0 (flat gray at midpoint 128)
  const factor = 1 + value / 100;
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(128 + (data[i] - 128) * factor);
    data[i + 1] = clamp(128 + (data[i + 1] - 128) * factor);
    data[i + 2] = clamp(128 + (data[i + 2] - 128) * factor);
  }

  return imageData;
}

function applyBrightness(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Simple additive offset. Positive brightens all pixels uniformly,
  // negative darkens. Uint8ClampedArray auto-clamps to [0, 255].
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] + value;
    data[i + 1] = data[i + 1] + value;
    data[i + 2] = data[i + 2] + value;
  }

  return imageData;
}

function applyGamma(gamma: number, imageData: ImageData): ImageData {
  if (gamma === 1) return imageData;

  // Gamma correction: output = 255 * (input/255)^(1/gamma)
  // - gamma=1: identity (exponent 1)
  // - gamma>1: brightens midtones (exponent < 1, e.g. gamma=2 → sqrt)
  // - gamma<1: darkens midtones (exponent > 1, e.g. gamma=0.5 → square)
  // Extreme values (0 and 255) are preserved regardless of gamma.
  const exponent = 1 / gamma;
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(255 * Math.pow(data[i] / 255, exponent));
    data[i + 1] = clamp(255 * Math.pow(data[i + 1] / 255, exponent));
    data[i + 2] = clamp(255 * Math.pow(data[i + 2] / 255, exponent));
  }

  return imageData;
}

function applyTemperature(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;
  const data = imageData.data;
  const t = value / 100;
  const rScale = 1 + 0.15 * t;
  const bScale = 1 - 0.15 * t;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] * rScale);
    data[i + 2] = clamp(data[i + 2] * bScale);
  }
  return imageData;
}

function applyTint(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Tint: green ↔ magenta shift via RGB channel scaling
  // - Positive (magenta): boost R+B, reduce G
  // - Negative (green): boost G, reduce R+B
  // - Scale factor 0.3 for subtlety
  
  const data = imageData.data;
  const t = value / 100; // -1..+1
  const gAdjust = -t * 30;  // ∓30 on G
  const rbAdjust = t * 15;  // ±15 on R and B (half of G for balance)

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] + rbAdjust);
    data[i + 1] = clamp(data[i + 1] + gAdjust);
    data[i + 2] = clamp(data[i + 2] + rbAdjust);
  }

  return imageData;
}

function applyHighlights(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Highlights: recovers blown-out bright areas using luminance masking
  // - Affects only pixels with luminance > threshold (128 = midpoint)
  // - Smooth falloff: weight increases linearly from threshold to max
  // - Positive value: darken highlights (recover detail)
  // - Negative value: brighten highlights (make them pop)
  // - Scale factor 0.5 for subtlety (full range would be too aggressive)
  
  const data = imageData.data;
  const threshold = 128;
  const scale = 0.5; // subtlety multiplier

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = getLuminance(r, g, b);

    // Smooth falloff: weight is 0 at threshold, 1 at max (255)
    const weight = luminance > threshold ? (luminance - threshold) / (255 - threshold) : 0;

    if (weight > 0) {
      // Positive value darkens, negative value brightens
      const offset = -value * weight * scale;
      data[i]     = clamp(r + offset);
      data[i + 1] = clamp(g + offset);
      data[i + 2] = clamp(b + offset);
    }
  }

  return imageData;
}

function applyShadows(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Shadows: retrieves detail in dark areas using luminance masking
  // - Affects only pixels with luminance < threshold (128 = midpoint)
  // - Smooth falloff: weight increases linearly from threshold down to 0
  // - Positive value: brighten shadows (retrieve detail)
  // - Negative value: darken shadows (increase contrast)
  // - Scale factor 0.5 for subtlety (full range would be too aggressive)
  
  const data = imageData.data;
  const threshold = 128;
  const scale = 0.5; // subtlety multiplier

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const luminance = getLuminance(r, g, b);

    // Smooth falloff: weight is 1 at min (0), 0 at threshold
    const weight = luminance < threshold ? (threshold - luminance) / threshold : 0;

    if (weight > 0) {
      // Positive value brightens, negative value darkens
      const offset = value * weight * scale;
      data[i]     = clamp(r + offset);
      data[i + 1] = clamp(g + offset);
      data[i + 2] = clamp(b + offset);
    }
  }

  return imageData;
}

function applyWhites(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Whites: sets the white point by compressing/stretching histogram
  // - positive value: compress histogram (lower white point, clips more highlights)
  // - negative value: stretch histogram (raise white point, amplifies mids)
  // - White point range: 255 ± 50 (from 205 to 255)
  // - Pixels beyond new white point clip to 255
  
  const data = imageData.data;
  const whitePoint = 255 - (value / 100) * 50; // 255 at value=0, 205 at value=+100
  const multiplier = 255 / whitePoint; // scales input to fill [0, 255]

  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(data[i] * multiplier);
    data[i + 1] = clamp(data[i + 1] * multiplier);
    data[i + 2] = clamp(data[i + 2] * multiplier);
  }

  return imageData;
}

function applyBlacks(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Blacks: sets the black point by compressing/stretching histogram
  // - positive value: compress histogram (raise black point, clips more shadows)
  // - negative value: stretch histogram (lower black point, amplifies mids)
  // - Black point range: 0 ± 50 (from 0 to 50)
  // - Pixels below new black point clip to 0
  // - Remapping: [blackPoint, 255] → [0, 255]
  
  const data = imageData.data;
  const blackPoint = (value / 100) * 50; // 0 at value=0, 50 at value=+100
  const range = 255 - blackPoint; // how much of the [0,255] range to scale
  const factor = range / 255; // scale factor for input

  for (let i = 0; i < data.length; i += 4) {
    // Subtract black point, scale up, clamp
    data[i]     = clamp((data[i] - blackPoint) / factor);
    data[i + 1] = clamp((data[i + 1] - blackPoint) / factor);
    data[i + 2] = clamp((data[i + 2] - blackPoint) / factor);
  }

  return imageData;
}

// Reusable Float32Array scratch buffers for spatial adjustments (clarity,
// sharpening, etc.). These functions allocate several width×height float
// buffers per call; during a slider drag that's ~3MB/frame of garbage the GC
// can't keep up with (the RAM-pinning symptom). The pool grows each buffer to
// the largest size seen and reuses it on subsequent calls — zero per-call
// allocation in steady state.
const scratchPool: Float32Array[] = [];
function getScratch(index: number, size: number): Float32Array {
  const cur = scratchPool[index];
  if (cur && cur.length >= size) return cur;
  const arr = new Float32Array(size);
  scratchPool[index] = arr;
  return arr;
}

function applyClarity(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Clarity: midtone local contrast via unsharp mask on luminance channel
  // - Positive value: increases midtone local contrast (sharpen edges in midtones)
  // - Negative value: softens image (reduces local contrast, dreamy look)
  // - Uses large-radius blur (15px) to capture midtone structures
  // - Only affects luminance (chroma preserved for natural-looking results)
  // - Amount scale: value/100 * 0.5 (subtle effect, not aggressive sharpening)

  const radius = 15; // large radius to capture midtone structures
  const amount = (value / 100) * 0.5; // scale for subtlety
  const { width, height, data } = imageData;
  const n = width * height;

  // Luminance buffer (reused across calls — avoids a per-frame allocation).
  const luminance = getScratch(0, n);
  for (let i = 0; i < n; i++) {
    const base = i * 4;
    luminance[i] = getLuminance(data[base], data[base + 1], data[base + 2]);
  }

  // Box blur approximation to Gaussian (3 passes, radius/3 each)
  // This is significantly faster than proper Gaussian but visually similar
  const blurredY = boxBlurLuminance(luminance, width, height, radius);

  // Unsharp mask: apply difference to luminance only, preserve chroma
  for (let i = 0; i < width * height; i++) {
    const base = i * 4;
    const originalY = luminance[i];
    const blurredPixelY = blurredY[i];
    const diff = originalY - blurredPixelY;

    // Apply clarity to luminance: new Y = Y + diff * amount
    const newY = clamp(originalY + diff * amount, 0, 255);

    // Only apply if original luminance is non-zero to avoid division by zero
    if (originalY > 0) {
      const ratio = newY / originalY;
      data[base]     = clamp(data[base] * ratio);
      data[base + 1] = clamp(data[base + 1] * ratio);
      data[base + 2] = clamp(data[base + 2] * ratio);
    }
  }

  return imageData;
}

/**
 * Box blur on luminance channel only (fast approximation to Gaussian).
 * Uses separable horizontal + vertical passes for O(n) performance.
 * Returns a reused Float32Array (scratch slot 1); caller must consume it
 * before the next call to any function using the same scratch slot.
 */
function boxBlurLuminance(
  src: Float32Array,
  width: number,
  height: number,
  radius: number
): Float32Array {
  // 3-pass box blur approximates a Gaussian
  // Each pass uses radius/3 as the box size
  const passes = 3;
  const boxSize = Math.max(1, Math.floor(radius / passes));
  const n = width * height;

  // current = working copy of src; temp = scratch for separable passes.
  // Both reused across calls (scratch slots 1 & 2) to avoid per-frame alloc.
  const current = getScratch(1, n);
  current.set(src.subarray(0, n));
  const temp = getScratch(2, n);

  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      const rowStart = y * width;
      let sum = 0;
      let count = 0;

      // Seed the sum with the box at x=0
      for (let x = -boxSize; x <= boxSize; x++) {
        const sampleX = Math.max(0, Math.min(width - 1, x));
        sum += current[rowStart + sampleX];
        count++;
      }

      for (let x = 0; x < width; x++) {
        temp[rowStart + x] = sum / count;

        // Slide the box: remove leftmost, add rightmost
        const addX = Math.min(width - 1, x + boxSize + 1);
        const removeX = Math.max(0, x - boxSize);
        sum += current[rowStart + addX] - current[rowStart + removeX];
      }
    }

    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;

      // Seed the sum with the box at y=0
      for (let y = -boxSize; y <= boxSize; y++) {
        const sampleY = Math.max(0, Math.min(height - 1, y));
        sum += temp[sampleY * width + x];
        count++;
      }

      for (let y = 0; y < height; y++) {
        current[y * width + x] = sum / count;

        // Slide the box: remove topmost, add bottommost
        const addY = Math.min(height - 1, y + boxSize + 1);
        const removeY = Math.max(0, y - boxSize);
        sum += temp[addY * width + x] - temp[removeY * width + x];
      }
    }
  }

  return current;
}

/**
 * Catmull-Rom spline interpolation.
 * Given 4 control points (p0..p3), returns a value at t in [0, 1] along the
 * segment between p1 and p2. Centripetal variant ensures smooth curves
 * without overshoot.
 */
function catmullRom(
  p0: number, p1: number, p2: number, p3: number, t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  );
}

/**
 * Generate a 256-entry lookup table from control points using
 * Catmull-Rom spline interpolation.
 *
 * Control points must be sorted by x, with x in [0, 255].
 * Points outside that range are clamped.
 * At least 2 points are needed (default: (0,0) and (255,255) = identity).
 */
function buildCurveLut(points: CurvePoint[]): Uint8Array {
  if (points.length === 0) return new Uint8Array(256).map((_, i) => i); // identity

  // Sort by x and deduplicate x values (keep last y)
  const sorted = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({
      x: Math.max(0, Math.min(255, Math.round(p.x))),
      y: Math.max(0, Math.min(255, Math.round(p.y))),
    }))
    .sort((a, b) => a.x - b.x)
    .filter((p, i, arr) => i === 0 || p.x !== arr[i - 1].x);

  if (sorted.length === 0) return new Uint8Array(256).map((_, i) => i);

  // Ensure endpoints
  if (sorted[0].x !== 0) sorted.unshift({ x: 0, y: 0 });
  if (sorted[sorted.length - 1].x !== 255) sorted.push({ x: 255, y: 255 });

  const lut = new Uint8Array(256);
  const n = sorted.length;

  // 2 points = linear interpolation (simple endpoints, no spline needed)
  if (n === 2) {
    const p1 = sorted[0];
    const p2 = sorted[1];
    for (let x = 0; x < 256; x++) {
      const t = (x - p1.x) / (p2.x - p1.x);
      lut[x] = Math.max(0, Math.min(255, Math.round(p1.y + t * (p2.y - p1.y))));
    }
    return lut;
  }

  for (let x = 0; x < 256; x++) {
    // Find the segment [sorted[i].x, sorted[i+1].x] containing x
    let i = 0;
    while (i < n - 1 && sorted[i + 1].x < x) i++;

    if (i >= n - 1) {
      lut[x] = sorted[n - 1].y;
      continue;
    }

    const p0 = sorted[Math.max(0, i - 1)];
    const p1 = sorted[i];
    const p2 = sorted[i + 1];
    const p3 = sorted[Math.min(n - 1, i + 2)];

    const segmentLen = p2.x - p1.x;
    const t = segmentLen > 0 ? (x - p1.x) / segmentLen : 0;

    lut[x] = Math.max(0, Math.min(255, Math.round(
      catmullRom(p0.y, p1.y, p2.y, p3.y, t)
    )));
  }

  return lut;
}

/**
 * Apply a tone curve (as control points) to the image.
 * Supports empty = identity (no change).
 */
function applyCurve(points: CurvePoint[], imageData: ImageData): ImageData {
  if (points.length === 0) return imageData;

  const lut = buildCurveLut(points);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }

  return imageData;
}

// ─── HSL per-color ────────────────────────────────────────────────────

const COLOR_RANGES: Record<string, { center: number; halfWidth: number; fullWidth: number }> = {
  red:     { center: 0,   halfWidth: 15,  fullWidth: 30  },
  orange:  { center: 30,  halfWidth: 15,  fullWidth: 25  },
  yellow:  { center: 60,  halfWidth: 15,  fullWidth: 25  },
  green:   { center: 120, halfWidth: 30,  fullWidth: 60  },
  aqua:    { center: 180, halfWidth: 15,  fullWidth: 25  },
  blue:    { center: 225, halfWidth: 30,  fullWidth: 50  },
  purple:  { center: 270, halfWidth: 15,  fullWidth: 25  },
  magenta: { center: 315, halfWidth: 30,  fullWidth: 50  },
};

const HUE_COLORS = Object.keys(COLOR_RANGES);

function hueFalloff(hueDeg: number, center: number, halfWidth: number, fullWidth: number): number {
  let dist = Math.abs(hueDeg - center);
  if (dist > 180) dist = 360 - dist;
  if (dist <= halfWidth) return 1;
  if (dist <= fullWidth) {
    const t = (dist - halfWidth) / (fullWidth - halfWidth);
    return Math.exp(-4 * t * t);
  }
  return 0;
}

function applyHSL(
  hslState: Record<string, HSLAdjustment>,
  imageData: ImageData
): ImageData {
  const hasAdjustment = HUE_COLORS.some((color) => {
    const adj = hslState[color];
    return adj && (adj.hue !== 0 || adj.saturation !== 0 || adj.luminance !== 0);
  });
  if (!hasAdjustment) return imageData;

  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
    const hueDeg = h * 360;

    let totalWeight = 0;
    let hueShift = 0;
    let satMult = 0;
    let lumShift = 0;

    for (const color of HUE_COLORS) {
      const adj = hslState[color];
      if (!adj) continue;
      const { center, halfWidth, fullWidth } = COLOR_RANGES[color];
      const weight = hueFalloff(hueDeg, center, halfWidth, fullWidth);

      if (weight > 0) {
        totalWeight += weight;
        hueShift += (adj.hue / 360) * weight;
        satMult += (1 + adj.saturation / 100) * weight;
        lumShift += (adj.luminance / 100) * weight;
      }
    }

    if (totalWeight === 0) continue;

    const newHue = hueShift > 0 ? (h + hueShift / totalWeight) % 1 : h;
    const newSat = satMult > 0 ? Math.max(0, Math.min(1, s * (satMult / totalWeight))) : s;
    const newLum = Math.max(0, Math.min(1, l + lumShift / totalWeight));

    const [r, g, b] = hslToRgb(newHue, newSat, newLum);
    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }

  return imageData;
}

// ─── Color Grading ───────────────────────────────────────────────────

function applyPhotoFilter(
  filter: PhotoFilter | null,
  imageData: ImageData
): ImageData {
  if (!filter || filter.density === 0) return imageData;

  const hex = filter.color.replace('#', '');
  const filterR = parseInt(hex.slice(0, 2), 16);
  const filterG = parseInt(hex.slice(2, 4), 16);
  const filterB = parseInt(hex.slice(4, 6), 16);
  const density = filter.density / 100;

  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(data[i] * (1 - density) + filterR * density);
    data[i + 1] = clamp(data[i + 1] * (1 - density) + filterG * density);
    data[i + 2] = clamp(data[i + 2] * (1 - density) + filterB * density);
  }
  return imageData;
}

function applyChannelMixer(
  mixer: ChannelMixer | null,
  imageData: ImageData
): ImageData {
  if (!mixer) return imageData;

  const { red, green, blue } = mixer;
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    data[i]     = clamp(r * red[0] + g * red[1] + b * red[2]);
    data[i + 1] = clamp(r * green[0] + g * green[1] + b * green[2]);
    data[i + 2] = clamp(r * blue[0] + g * blue[1] + b * blue[2]);
  }
  return imageData;
}

function applySelectiveColor(
  sc: Record<string, SelectiveColorAdjustment>,
  imageData: ImageData
): ImageData {
  if (Object.keys(sc).length === 0) return imageData;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b);
    const lum = getLuminance(r, g, b);
    // Simplified per-pixel color matching (nearest category)
    let cat = 'neutrals';
    if (lum > 192) cat = 'whites';
    else if (lum < 64) cat = 'blacks';
    else if (max === r && r - b > 30) cat = 'reds';
    else if (max === g && g - b > 30) cat = 'greens';
    else if (max === b && b - r > 30) cat = 'blues';
    else if (max === r && r - g > 20) cat = 'yellows';
    else if (g > r && g > b) cat = 'greens';

    const adj = sc[cat];
    if (adj) {
      data[i]     = clamp(r + adj.cyan);
      data[i + 1] = clamp(g + adj.magenta);
      data[i + 2] = clamp(b + adj.yellow);
    }
  }
  return imageData;
}

function applySplitToning(
  split: SplitToning | null,
  imageData: ImageData
): ImageData {
  if (!split || (split.shadowsSaturation === 0 && split.highlightsSaturation === 0)) return imageData;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const lum = getLuminance(r, g, b);
    const shadowWeight = Math.max(0, 1 - lum / 128);
    const highlightWeight = Math.max(0, (lum - 128) / 128);

    const [shR, shG, shB] = hslToRgb(split.shadowsHue / 360, split.shadowsSaturation / 100, 0.5);
    const [hlR, hlG, hlB] = hslToRgb(split.highlightsHue / 360, split.highlightsSaturation / 100, 0.5);

    data[i]     = clamp(r + shR * shadowWeight + hlR * highlightWeight);
    data[i + 1] = clamp(g + shG * shadowWeight + hlG * highlightWeight);
    data[i + 2] = clamp(b + shB * shadowWeight + hlB * highlightWeight);
  }
  return imageData;
}

function applyGradientMap(
  grad: GradientMap | null,
  imageData: ImageData
): ImageData {
  if (!grad || grad.stops.length < 2) return imageData;
  const stops = [...grad.stops].sort((a, b) => a.position - b.position);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    const t = lum / 255;

    let lower = stops[0], upper = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s].position && t <= stops[s + 1].position) {
        lower = stops[s];
        upper = stops[s + 1];
        break;
      }
    }

    const range = upper.position - lower.position;
    const lt = range > 0 ? (t - lower.position) / range : 0;

    const hexL = lower.color.replace('#', '');
    const hexU = upper.color.replace('#', '');
    const rL = parseInt(hexL.slice(0, 2), 16), gL = parseInt(hexL.slice(2, 4), 16), bL = parseInt(hexL.slice(4, 6), 16);
    const rU = parseInt(hexU.slice(0, 2), 16), gU = parseInt(hexU.slice(2, 4), 16), bU = parseInt(hexU.slice(4, 6), 16);

    data[i]     = clamp(rL + (rU - rL) * lt);
    data[i + 1] = clamp(gL + (gU - gL) * lt);
    data[i + 2] = clamp(bL + (bU - bL) * lt);
  }
  return imageData;
}

// ─── Levels ──────────────────────────────────────────────────────────

export interface LevelsParams {
  inBlack: number; inWhite: number; gamma: number; outBlack: number; outWhite: number;
}

function applyLevels(levels: LevelsParams, imageData: ImageData): ImageData {
  const { inBlack, inWhite, gamma, outBlack, outWhite } = levels;
  if (inBlack === 0 && inWhite === 255 && gamma === 1 && outBlack === 0 && outWhite === 255) {
    return imageData;
  }

  const data = imageData.data;
  const inRange = inWhite - inBlack;
  const outRange = outWhite - outBlack;
  if (inRange <= 0 || outRange <= 0) return imageData;

  const invGamma = 1 / gamma;

  for (let i = 0; i < data.length; i += 4) {
    data[i]     = clamp(outBlack + Math.pow(Math.max(0, Math.min(1, (data[i] - inBlack) / inRange)), invGamma) * outRange);
    data[i + 1] = clamp(outBlack + Math.pow(Math.max(0, Math.min(1, (data[i + 1] - inBlack) / inRange)), invGamma) * outRange);
    data[i + 2] = clamp(outBlack + Math.pow(Math.max(0, Math.min(1, (data[i + 2] - inBlack) / inRange)), invGamma) * outRange);
  }

  return imageData;
}

function applyTexture(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Texture: enhance micro-contrast (fine detail)
  // - Range: -100..+100
  // - Positive: enhance detail (skin pores, fabric weave)
  // - Negative: smooth out fine detail
  
  const data = imageData.data;
  const { width, height } = imageData;
  const pixels = width * height;
  
  const luminance = new Float32Array(pixels);
  for (let i = 0; i < pixels; i++) {
    const base = i * 4;
    luminance[i] = getLuminance(data[base], data[base + 1], data[base + 2]);
  }
  
  // Small-radius box blur (3x3) for texture detection
  const blurred = new Float32Array(pixels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          sum += luminance[ny * width + nx];
          count++;
        }
      }
      blurred[y * width + x] = sum / count;
    }
  }
  
  const factor = value / 100; // -1..+1
  const amount = factor * 0.5; // scale for subtlety
  
  for (let i = 0; i < pixels; i++) {
    const base = i * 4;
    const originalY = luminance[i];
    const blurredY = blurred[i];
    const diff = originalY - blurredY;
    
    const newY = clamp(originalY + diff * amount, 0, 255);
    
    if (originalY > 0) {
      const ratio = newY / originalY;
      data[base] = clamp(data[base] * ratio);
      data[base + 1] = clamp(data[base + 1] * ratio);
      data[base + 2] = clamp(data[base + 2] * ratio);
    }
  }
  
  return imageData;
}

function applyDehaze(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Dehaze: atmospheric haze removal
  // - Range: -100..+100
  // - Positive: remove haze (increase contrast)
  // - Negative: add haze (decrease contrast, dreamy effect)
  
  const data = imageData.data;
  
  // Estimate atmospheric light (brightest pixel in image)
  let maxLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    if (lum > maxLum) maxLum = lum;
  }
  
  // Apply dehaze using dark channel prior approximation
  const factor = value / 100; // -1..+1
  const strength = Math.abs(factor);
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    const minChannel = Math.min(r, g, b);
    
    // Transmission estimate: how much haze to remove
    const transmission = 1 - (minChannel / 255) * strength;
    
    const recovered = (r - maxLum * (1 - transmission)) / Math.max(transmission, 0.1);
    const recoveredG = (g - maxLum * (1 - transmission)) / Math.max(transmission, 0.1);
    const recoveredB = (b - maxLum * (1 - transmission)) / Math.max(transmission, 0.1);
    
    if (factor > 0) {
      data[i] = clamp(recovered);
      data[i + 1] = clamp(recoveredG);
      data[i + 2] = clamp(recoveredB);
    } else {
      const blend = strength * 0.3;
      data[i] = clamp(r + (maxLum - r) * blend);
      data[i + 1] = clamp(g + (maxLum - g) * blend);
      data[i + 2] = clamp(b + (maxLum - b) * blend);
    }
  }
  
  return imageData;
}

function applySharpening(
  amount: number,
  radius: number,
  detail: number,
  masking: number,
  imageData: ImageData
): ImageData {
  if (amount === 0) return imageData;

  // Sharpening via Unsharp Mask with edge masking
  // - amount: 0..200 (strength)
  // - radius: 0.5..3.0 (blur radius for high-pass)
  // - detail: 0..100 (fine detail enhancement)
  // - masking: 0..100 (edge-only sharpening)
  
  const data = imageData.data;
  const { width, height } = imageData;
  const pixels = width * height;
  
  const blurred = new Float32Array(pixels * 3);
  const original = new Float32Array(pixels * 3);
  
  for (let i = 0; i < pixels; i++) {
    const base = i * 4;
    original[i * 3] = data[base];
    original[i * 3 + 1] = data[base + 1];
    original[i * 3 + 2] = data[base + 2];
  }
  
  // Box blur with radius (separable, fast)
  const radiusPx = Math.max(1, Math.round(radius));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0;
      let count = 0;
      
      for (let dx = -radiusPx; dx <= radiusPx; dx++) {
        const nx = Math.max(0, Math.min(width - 1, x + dx));
        const idx = (y * width + nx) * 3;
        rSum += original[idx];
        gSum += original[idx + 1];
        bSum += original[idx + 2];
        count++;
      }
      
      const idx = (y * width + x) * 3;
      blurred[idx] = rSum / count;
      blurred[idx + 1] = gSum / count;
      blurred[idx + 2] = bSum / count;
    }
  }
  
  const blurred2 = new Float32Array(pixels * 3);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      let rSum = 0, gSum = 0, bSum = 0;
      let count = 0;
      
      for (let dy = -radiusPx; dy <= radiusPx; dy++) {
        const ny = Math.max(0, Math.min(height - 1, y + dy));
        const idx = (ny * width + x) * 3;
        rSum += blurred[idx];
        gSum += blurred[idx + 1];
        bSum += blurred[idx + 2];
        count++;
      }
      
      const idx = (y * width + x) * 3;
      blurred2[idx] = rSum / count;
      blurred2[idx + 1] = gSum / count;
      blurred2[idx + 2] = bSum / count;
    }
  }
  
  // Calculate edge mask using Sobel operator (for masking slider)
  const edgeMask = new Float32Array(pixels);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const tl = getLuminance(data[((y-1) * width + (x-1)) * 4], data[((y-1) * width + (x-1)) * 4 + 1], data[((y-1) * width + (x-1)) * 4 + 2]);
      const tr = getLuminance(data[((y-1) * width + (x+1)) * 4], data[((y-1) * width + (x+1)) * 4 + 1], data[((y-1) * width + (x+1)) * 4 + 2]);
      const bl = getLuminance(data[((y+1) * width + (x-1)) * 4], data[((y+1) * width + (x-1)) * 4 + 1], data[((y+1) * width + (x-1)) * 4 + 2]);
      const br = getLuminance(data[((y+1) * width + (x+1)) * 4], data[((y+1) * width + (x+1)) * 4 + 1], data[((y+1) * width + (x+1)) * 4 + 2]);
      const t = getLuminance(data[((y-1) * width + x) * 4], data[((y-1) * width + x) * 4 + 1], data[((y-1) * width + x) * 4 + 2]);
      const b = getLuminance(data[((y+1) * width + x) * 4], data[((y+1) * width + x) * 4 + 1], data[((y+1) * width + x) * 4 + 2]);
      const l = getLuminance(data[(y * width + (x-1)) * 4], data[(y * width + (x-1)) * 4 + 1], data[(y * width + (x-1)) * 4 + 2]);
      const r = getLuminance(data[(y * width + (x+1)) * 4], data[(y * width + (x+1)) * 4 + 1], data[(y * width + (x+1)) * 4 + 2]);
      
      const gx = -tl - 2*t - tr + bl + 2*b + br;
      const gy = -tl - 2*l - bl + tr + 2*r + br;
      const edge = Math.sqrt(gx * gx + gy * gy) / 255;
      edgeMask[y * width + x] = Math.min(1, edge);
    }
  }
  
  // Apply sharpening
  const amountFactor = amount / 100;
  const detailFactor = detail / 100;
  const maskingFactor = masking / 100;
  
  for (let i = 0; i < pixels; i++) {
    const base = i * 4;
    const idx3 = i * 3;
    
    // High-pass detail (original - blurred)
    const detailR = original[idx3] - blurred2[idx3];
    const detailG = original[idx3 + 1] - blurred2[idx3 + 1];
    const detailB = original[idx3 + 2] - blurred2[idx3 + 2];
    
    // Edge mask (how much to apply sharpening)
    const edgeWeight = 1 - (maskingFactor * (1 - edgeMask[i]));
    
    // Detail weight (fine detail enhancement)
    const detailWeight = 1 + detailFactor * 0.5;
    
    // Final sharpening: original + amount * detail * edgeWeight * detailWeight
    data[base] = clamp(data[base] + detailR * amountFactor * edgeWeight * detailWeight);
    data[base + 1] = clamp(data[base + 1] + detailG * amountFactor * edgeWeight * detailWeight);
    data[base + 2] = clamp(data[base + 2] + detailB * amountFactor * edgeWeight * detailWeight);
  }
  
  return imageData;
}

function applyNoiseReduction(
  luminance: number,
  detail: number,
  imageData: ImageData
): ImageData {
  if (luminance === 0) return imageData;

  // Noise Reduction via bilateral filter approximation
  // - luminance: 0..100 (brightness noise reduction strength)
  // - detail: 0..100 (preserve fine detail while reducing noise)
  
  const data = imageData.data;
  const { width, height } = imageData;
  
  const strength = luminance / 100;
  const detailPreservation = detail / 100;
  
  // Bilateral filter: smooth while preserving edges
  // For each pixel, average nearby pixels that have similar luminance
  const result = new Uint8ClampedArray(data);
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const base = (y * width + x) * 4;
      const centerLum = getLuminance(data[base], data[base + 1], data[base + 2]);
      
      let rSum = 0, gSum = 0, bSum = 0, weightSum = 0;
      
      // Sample 3x3 neighborhood
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = x + dx;
          const ny = y + dy;
          const nBase = (ny * width + nx) * 4;
          const nLum = getLuminance(data[nBase], data[nBase + 1], data[nBase + 2]);
          
          // Luminance similarity weight (preserve edges)
          const lumDiff = Math.abs(centerLum - nLum);
          const lumWeight = Math.exp(-(lumDiff * lumDiff) / (2 * 50 * 50));
          
          // Spatial weight (distance-based, but constant for 3x3)
          const spatialWeight = 1;
          
          // Detail preservation: reduce weight for fine details
          const detailWeight = detailPreservation > 0 ? 
            Math.exp(-(lumDiff * lumDiff) / (2 * (100 - detailPreservation * 80) * (100 - detailPreservation * 80))) : 1;
          
          const weight = lumWeight * spatialWeight * detailWeight;
          
          rSum += data[nBase] * weight;
          gSum += data[nBase + 1] * weight;
          bSum += data[nBase + 2] * weight;
          weightSum += weight;
        }
      }
      
      if (weightSum > 0) {
        const r = rSum / weightSum;
        const g = gSum / weightSum;
        const b = bSum / weightSum;
        
        // Blend with original based on strength
        result[base] = clamp(data[base] * (1 - strength) + r * strength);
        result[base + 1] = clamp(data[base + 1] * (1 - strength) + g * strength);
        result[base + 2] = clamp(data[base + 2] * (1 - strength) + b * strength);
      }
    }
  }
  
  // Copy result back
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i];
  }
  
  return imageData;
}

function applyVignette(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Vignette: darken/brighten edges based on distance from center
  // - Range: -100..+100
  // - Positive: darken edges (classic vignette)
  // - Negative: brighten edges (inverse vignette)
  
  const data = imageData.data;
  const { width, height } = imageData;
  const centerX = width / 2;
  const centerY = height / 2;
  const maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
  const strength = value / 100; // -1..+1
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) / maxDist; // 0..1
      
      // Quadratic falloff for natural-looking vignette
      const vignette = 1 - (dist * dist * strength);
      
      const base = (y * width + x) * 4;
      data[base] = clamp(data[base] * vignette);
      data[base + 1] = clamp(data[base + 1] * vignette);
      data[base + 2] = clamp(data[base + 2] * vignette);
    }
  }
  
  return imageData;
}

function applyGrain(value: number, imageData: ImageData): ImageData {
  if (value === 0) return imageData;

  // Film grain: add random noise to simulate analog film
  // - Range: 0..100
  // - 0 = no grain, 100 = heavy grain
  
  const data = imageData.data;
  const strength = value / 100; // 0..1
  
  // Simple pseudo-random noise (deterministic based on pixel position)
  for (let i = 0; i < data.length; i += 4) {
    // Generate noise from -1 to +1 using position-based hash
    const hash = Math.sin(i * 12.9898 + i * 78.233) * 43758.5453;
    const noise = (hash - Math.floor(hash)) * 2 - 1; // -1..+1
    
    const noiseVal = noise * strength * 50; // scale noise
    
    data[i] = clamp(data[i] + noiseVal);
    data[i + 1] = clamp(data[i + 1] + noiseVal);
    data[i + 2] = clamp(data[i + 2] + noiseVal);
  }
  
  return imageData;
}

// Gaussian Blur
function applyGaussianBlur(radius: number, imageData: ImageData): ImageData {
  if (radius === 0) return imageData;

  const data = imageData.data;
  const { width, height } = imageData;
  
  // Use box blur approximation (3 passes for Gaussian-like effect)
  const passes = 3;
  const boxSize = Math.max(1, Math.round(radius / passes));
  
  const original = new Uint8ClampedArray(data);
  const temp = new Uint8ClampedArray(data);
  
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        
        for (let dx = -boxSize; dx <= boxSize; dx++) {
          const nx = Math.max(0, Math.min(width - 1, x + dx));
          const idx = (y * width + nx) * 4;
          rSum += original[idx];
          gSum += original[idx + 1];
          bSum += original[idx + 2];
          count++;
        }
        
        const idx = (y * width + x) * 4;
        temp[idx] = Math.round(rSum / count);
        temp[idx + 1] = Math.round(gSum / count);
        temp[idx + 2] = Math.round(bSum / count);
      }
    }
    
    for (let x = 0; x < width; x++) {
      for (let y = 0; y < height; y++) {
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        
        for (let dy = -boxSize; dy <= boxSize; dy++) {
          const ny = Math.max(0, Math.min(height - 1, y + dy));
          const idx = (ny * width + x) * 4;
          rSum += temp[idx];
          gSum += temp[idx + 1];
          bSum += temp[idx + 2];
          count++;
        }
        
        const idx = (y * width + x) * 4;
        original[idx] = Math.round(rSum / count);
        original[idx + 1] = Math.round(gSum / count);
        original[idx + 2] = Math.round(bSum / count);
      }
    }
  }
  
  // Copy result back
  for (let i = 0; i < data.length; i++) {
    data[i] = original[i];
  }
  
  return imageData;
}

// Median Filter
function applyMedianFilter(radius: number, imageData: ImageData): ImageData {
  if (radius === 0) return imageData;

  const data = imageData.data;
  const { width, height } = imageData;
  
  const result = new Uint8ClampedArray(data);
  const radiusPx = Math.max(1, Math.round(radius));
  const size = (2 * radiusPx + 1) * (2 * radiusPx + 1);
  
  // Pre-allocate neighborhood arrays to avoid GC pressure inside the pixel loop
  const rValues = new Uint8Array(size);
  const gValues = new Uint8Array(size);
  const bValues = new Uint8Array(size);
  
  for (let y = radiusPx; y < height - radiusPx; y++) {
    for (let x = radiusPx; x < width - radiusPx; x++) {
      let count = 0;
      
      // Collect neighborhood pixels
      for (let dy = -radiusPx; dy <= radiusPx; dy++) {
        for (let dx = -radiusPx; dx <= radiusPx; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          rValues[count] = data[idx];
          gValues[count] = data[idx + 1];
          bValues[count] = data[idx + 2];
          count++;
        }
      }
      
      // Sort in-place numerically (Uint8Array.prototype.sort sorts numerically by default)
      rValues.sort();
      gValues.sort();
      bValues.sort();
      
      const medianIdx = Math.floor(count / 2);
      const idx = (y * width + x) * 4;
      result[idx] = rValues[medianIdx];
      result[idx + 1] = gValues[medianIdx];
      result[idx + 2] = bValues[medianIdx];
    }
  }
  
  // Copy result back
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i];
  }
  
  return imageData;
}

// Motion Blur
function applyMotionBlur(
  angle: number,
  distance: number,
  imageData: ImageData
): ImageData {
  if (distance === 0) return imageData;

  const data = imageData.data;
  const { width, height } = imageData;
  
  // Convert angle to radians
  const angleRad = (angle * Math.PI) / 180;
  const dx = Math.cos(angleRad);
  const dy = Math.sin(angleRad);
  
  const result = new Uint8ClampedArray(data);
  const steps = Math.max(1, Math.round(distance));
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      
      // Sample along motion direction
      for (let s = -steps; s <= steps; s++) {
        const nx = Math.round(x + dx * s);
        const ny = Math.round(y + dy * s);
        
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = (ny * width + nx) * 4;
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }
      
      if (count > 0) {
        const idx = (y * width + x) * 4;
        result[idx] = Math.round(rSum / count);
        result[idx + 1] = Math.round(gSum / count);
        result[idx + 2] = Math.round(bSum / count);
      }
    }
  }
  
  return imageData;
}

function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t
  ];
}

function applyInvert(invert: boolean, imageData: ImageData): ImageData {
  if (!invert) return imageData;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  return imageData;
}

function applySolarize(threshold: number, imageData: ImageData): ImageData {
  if (threshold === 0) return imageData;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    if (lum > threshold) {
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
    }
  }
  return imageData;
}

function applyPosterize(levels: number, imageData: ImageData): ImageData {
  if (levels <= 0) return imageData;
  const data = imageData.data;
  const numAreas = Math.max(2, levels);
  const step = 255 / (numAreas - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(Math.round(data[i] / step) * step);
    data[i + 1] = clamp(Math.round(data[i + 1] / step) * step);
    data[i + 2] = clamp(Math.round(data[i + 2] / step) * step);
  }
  return imageData;
}

function applyThreshold(threshold: number, imageData: ImageData): ImageData {
  if (threshold === 0) return imageData;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    const v = lum >= threshold ? 255 : 0;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
  }
  return imageData;
}

interface Duotone {
  colorA: string;
  colorB: string;
}

interface Tritone {
  colorA: string;
  colorB: string;
  colorC: string;
}

interface Quadtone {
  colorA: string;
  colorB: string;
  colorC: string;
  colorD: string;
}

function applyDuotone(duotone: Duotone | null, imageData: ImageData): ImageData {
  if (!duotone) return imageData;
  const cA = parseHexColor(duotone.colorA);
  const cB = parseHexColor(duotone.colorB);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    const t = lum / 255;
    const [r, g, b] = lerpColor(cA, cB, t);
    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
  return imageData;
}

function applyTritone(tritone: Tritone | null, imageData: ImageData): ImageData {
  if (!tritone) return imageData;
  const cA = parseHexColor(tritone.colorA);
  const cB = parseHexColor(tritone.colorB);
  const cC = parseHexColor(tritone.colorC);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    let r = 0, g = 0, b = 0;
    if (lum < 128) {
      const t = lum / 128;
      [r, g, b] = lerpColor(cA, cB, t);
    } else {
      const t = (lum - 128) / 127;
      [r, g, b] = lerpColor(cB, cC, t);
    }
    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
  return imageData;
}

function applyQuadtone(quadtone: Quadtone | null, imageData: ImageData): ImageData {
  if (!quadtone) return imageData;
  const cA = parseHexColor(quadtone.colorA);
  const cB = parseHexColor(quadtone.colorB);
  const cC = parseHexColor(quadtone.colorC);
  const cD = parseHexColor(quadtone.colorD);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = getLuminance(data[i], data[i + 1], data[i + 2]);
    let r = 0, g = 0, b = 0;
    if (lum < 85) {
      const t = lum / 85;
      [r, g, b] = lerpColor(cA, cB, t);
    } else if (lum < 170) {
      const t = (lum - 85) / 85;
      [r, g, b] = lerpColor(cB, cC, t);
    } else {
      const t = (lum - 170) / 85;
      [r, g, b] = lerpColor(cC, cD, t);
    }
    data[i] = clamp(r);
    data[i + 1] = clamp(g);
    data[i + 2] = clamp(b);
  }
  return imageData;
}

function sampleBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number
): [number, number, number, number] {
  const x1 = Math.floor(x);
  const y1 = Math.floor(y);
  const x2 = Math.min(width - 1, x1 + 1);
  const y2 = Math.min(height - 1, y1 + 1);
  const dx = x - x1;
  const dy = y - y1;
  const idx11 = (y1 * width + x1) * 4;
  const idx12 = (y1 * width + x2) * 4;
  const idx21 = (y2 * width + x1) * 4;
  const idx22 = (y2 * width + x2) * 4;
  const r = (1 - dx) * (1 - dy) * data[idx11] +
            dx * (1 - dy) * data[idx12] +
            (1 - dx) * dy * data[idx21] +
            dx * dy * data[idx22];
  const g = (1 - dx) * (1 - dy) * data[idx11 + 1] +
            dx * (1 - dy) * data[idx12 + 1] +
            (1 - dx) * dy * data[idx21 + 1] +
            dx * dy * data[idx22 + 1];
  const b = (1 - dx) * (1 - dy) * data[idx11 + 2] +
            dx * (1 - dy) * data[idx12 + 2] +
            (1 - dx) * dy * data[idx21 + 2] +
            dx * dy * data[idx22 + 2];
  const a = (1 - dx) * (1 - dy) * data[idx11 + 3] +
            dx * (1 - dy) * data[idx12 + 3] +
            (1 - dx) * dy * data[idx21 + 3] +
            dx * dy * data[idx22 + 3];
  return [r, g, b, a];
}

interface LensCorrections {
  distortion: number;
  vignetting: number;
  chromaticAberrationRedCyan: number;
  chromaticAberrationBlueYellow: number;
  defringe: number;
}

function applyLensCorrections(lc: LensCorrections | null, imageData: ImageData): ImageData {
  if (!lc) return imageData;
  let current = imageData;
  if (lc.distortion !== 0) {
    current = applyDistortion(lc.distortion, current);
  }
  if (lc.chromaticAberrationRedCyan !== 0 || lc.chromaticAberrationBlueYellow !== 0) {
    current = applyChromaticAberration(lc.chromaticAberrationRedCyan, lc.chromaticAberrationBlueYellow, current);
  }
  if (lc.vignetting !== 0) {
    current = applyLensVignetting(lc.vignetting, current);
  }
  if (lc.defringe !== 0) {
    current = applyDefringe(lc.defringe, current);
  }
  return current;
}

function applyDistortion(distortion: number, imageData: ImageData): ImageData {
  if (distortion === 0) return imageData;
  const { width, height } = imageData;
  if (width <= 1 || height <= 1) return imageData;
  const data = imageData.data;
  const result = new Uint8ClampedArray(data.length);
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
  const k = (distortion / 100) * 0.15;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const r = Math.sqrt(dx * dx + dy * dy);
      const rNorm = r / maxRadius;
      const factor = 1 + k * rNorm * rNorm;
      const sx = centerX + dx * factor;
      const sy = centerY + dy * factor;
      const destIdx = (y * width + x) * 4;
      if (sx >= 0 && sx < width && sy >= 0 && sy < height) {
        const [rVal, gVal, bVal, aVal] = sampleBilinear(data, width, height, sx, sy);
        result[destIdx] = rVal;
        result[destIdx + 1] = gVal;
        result[destIdx + 2] = bVal;
        result[destIdx + 3] = aVal;
      } else {
        result[destIdx] = 0;
        result[destIdx + 1] = 0;
        result[destIdx + 2] = 0;
        result[destIdx + 3] = 0;
      }
    }
  }
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i];
  }
  return imageData;
}

function applyChromaticAberration(rc: number, by: number, imageData: ImageData): ImageData {
  if (rc === 0 && by === 0) return imageData;
  const { width, height } = imageData;
  const data = imageData.data;
  const result = new Uint8ClampedArray(data.length);
  const centerX = width / 2;
  const centerY = height / 2;
  const rFactor = 1 + (rc / 100) * 0.01;
  const bFactor = 1 + (by / 100) * 0.01 - (rc / 100) * 0.005;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const baseIdx = (y * width + x) * 4;
      const rx = centerX + dx * rFactor;
      const ry = centerY + dy * rFactor;
      if (rx >= 0 && rx < width && ry >= 0 && ry < height) {
        result[baseIdx] = sampleBilinear(data, width, height, rx, ry)[0];
      } else {
        result[baseIdx] = 0;
      }
      result[baseIdx + 1] = data[baseIdx + 1];
      const bx = centerX + dx * bFactor;
      const byCoord = centerY + dy * bFactor;
      if (bx >= 0 && bx < width && byCoord >= 0 && byCoord < height) {
        result[baseIdx + 2] = sampleBilinear(data, width, height, bx, byCoord)[2];
      } else {
        result[baseIdx + 2] = 0;
      }
      result[baseIdx + 3] = data[baseIdx + 3];
    }
  }
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i];
  }
  return imageData;
}

function applyLensVignetting(vignetting: number, imageData: ImageData): ImageData {
  if (vignetting === 0) return imageData;
  return applyVignette(vignetting, imageData);
}

function applyDefringe(amount: number, imageData: ImageData): ImageData {
  if (amount === 0) return imageData;
  const { width, height } = imageData;
  const data = imageData.data;
  const result = new Uint8ClampedArray(data);
  const edges = new Float32Array(width * height);
  const lums = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    lums[i] = getLuminance(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const gx =
        -1 * lums[(y - 1) * width + (x - 1)] +
        1 * lums[(y - 1) * width + (x + 1)] +
        -2 * lums[y * width + (x - 1)] +
        2 * lums[y * width + (x + 1)] +
        -1 * lums[(y + 1) * width + (x - 1)] +
        1 * lums[(y + 1) * width + (x + 1)];
      const gy =
        -1 * lums[(y - 1) * width + (x - 1)] -
        2 * lums[(y - 1) * width + x] -
        1 * lums[(y - 1) * width + (x + 1)] +
        1 * lums[(y + 1) * width + (x - 1)] +
        2 * lums[(y + 1) * width + x] +
        1 * lums[(y + 1) * width + (x + 1)];
      edges[idx] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  const factor = amount / 20;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const base = idx * 4;
      const edgeVal = edges[idx];
      if (edgeVal > 30) {
        const r = data[base];
        const g = data[base + 1];
        const b = data[base + 2];
        const isPurple = r > g * 1.1 && b > g * 1.1;
        const isGreen = g > r * 1.1 && g > b * 1.1;
        if (isPurple || isGreen) {
          const lum = lums[idx];
          const blend = factor * Math.min(1, (edgeVal - 30) / 100);
          result[base] = clamp(r * (1 - blend) + lum * blend);
          result[base + 1] = clamp(g * (1 - blend) + lum * blend);
          result[base + 2] = clamp(b * (1 - blend) + lum * blend);
        }
      }
    }
  }
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i];
  }
  return imageData;
}

interface Perspective {
  upright: "off" | "auto" | "vertical" | "horizontal" | "full";
  vertical: number;
  horizontal: number;
  rotate: number;
  aspect: number;
  scale: number;
}

function applyPerspective(p: Perspective | null, imageData: ImageData): ImageData {
  if (!p) return imageData;
  const { vertical, horizontal, rotate, aspect, scale } = p;
  if (vertical === 0 && horizontal === 0 && rotate === 0 && aspect === 0 && scale === 100) {
    return imageData;
  }
  const { width, height } = imageData;
  const data = imageData.data;
  const result = new Uint8ClampedArray(data.length);
  const centerX = width / 2;
  const centerY = height / 2;
  const tiltV = (vertical / 100) * 0.2;
  const tiltH = (horizontal / 100) * 0.2;
  const rad = (rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const aspectFactor = 1 + (aspect / 100) * 0.5;
  const scaleFactor = scale / 100;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - centerX;
      const dy = y - centerY;
      const z = 1 + tiltV * (dy / (centerY || 1)) + tiltH * (dx / (centerX || 1));
      let sx = dx / z;
      let sy = dy / z;
      sx = sx * aspectFactor;
      sy = sy / aspectFactor;
      const rx = sx * cos - sy * sin;
      const ry = sx * sin + sy * cos;
      sx = rx;
      sy = ry;
      sx = sx / scaleFactor;
      sy = sy / scaleFactor;
      const srcX = sx + centerX;
      const srcY = sy + centerY;
      const destIdx = (y * width + x) * 4;
      if (srcX >= 0 && srcX < width && srcY >= 0 && srcY < height) {
        const [rVal, gVal, bVal, aVal] = sampleBilinear(data, width, height, srcX, srcY);
        result[destIdx] = rVal;
        result[destIdx + 1] = gVal;
        result[destIdx + 2] = bVal;
        result[destIdx + 3] = aVal;
      } else {
        result[destIdx] = 0;
        result[destIdx + 1] = 0;
        result[destIdx + 2] = 0;
        result[destIdx + 3] = 0;
      }
    }
  }
  for (let i = 0; i < data.length; i++) {
    data[i] = result[i];
  }
  return imageData;
}
