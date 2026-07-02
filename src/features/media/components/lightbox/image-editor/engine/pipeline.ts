/**
 * The public pipeline entry points: hasActiveAdjustments + applyAdjustments,
 * plus the composed fast paths (prefix LUT, single-pass HSL ops).
 * Extracted from AdjustmentEngine.ts (F13) — pure move, no behavior change.
 */
import type { AdjustmentState, Levels } from "../state/editorState";
import { clamp, rgbToHsl, hslToRgb } from "./shared";
import {
  applyExposure, applyContrast, applyBrightness, applyGamma, applyTemperature, applyTint,
  applyHighlights, applyShadows, applyWhites, applyBlacks,
  applyCurve, applyLevels,
} from "./tone";
import {
  applyHSL, applyPhotoFilter, applyChannelMixer, applySelectiveColor,
  applySplitToning, applyGradientMap,
} from "./color";
import { applyClarity, applyTexture, applyDehaze, applySharpening, applyNoiseReduction } from "./detail";
import {
  applyVignette, applyGrain, applyGaussianBlur, applyMedianFilter, applyMotionBlur,
  applyPosterize, applyThreshold, applyDuotone, applyTritone, applyQuadtone,
  applyInvert, applySolarize,
} from "./effects";
import { applyLensCorrections, applyPerspective } from "./lens";

export function isNeutralLevels(l: Levels): boolean {
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
export function buildPrefixLut(state: AdjustmentState): {
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
export function applyPrefixLut(
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
export function applyHslAdjustments(state: AdjustmentState, imageData: ImageData): ImageData {
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
