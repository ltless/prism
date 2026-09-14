/**
 * Tone adjustments: exposure/contrast/brightness/gamma/temperature/tint,
 * highlights/shadows/whites/blacks, curves and levels.
 * Extracted from AdjustmentEngine.ts (F13) — pure move, no behavior change.
 */
import type { CurvePoint } from "../state/editorState";
import { clamp, getLuminance } from "./shared";

export function applyExposure(stops: number, imageData: ImageData): ImageData {
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

export function applyContrast(value: number, imageData: ImageData): ImageData {
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

export function applyBrightness(value: number, imageData: ImageData): ImageData {
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

export function applyGamma(gamma: number, imageData: ImageData): ImageData {
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

export function applyTemperature(value: number, imageData: ImageData): ImageData {
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

export function applyTint(value: number, imageData: ImageData): ImageData {
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

export function applyHighlights(value: number, imageData: ImageData): ImageData {
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

export function applyShadows(value: number, imageData: ImageData): ImageData {
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

export function applyWhites(value: number, imageData: ImageData): ImageData {
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

export function applyBlacks(value: number, imageData: ImageData): ImageData {
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

// ─── Curves ────────────────────────────────────────────────────────────

/**
 * Catmull-Rom spline interpolation.
 * Given 4 control points (p0..p3), returns a value at t in [0, 1] along the
 * segment between p1 and p2. Centripetal variant ensures smooth curves
 * without overshoot.
 */
export function catmullRom(
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
export function buildCurveLut(points: CurvePoint[]): Uint8Array {
  if (points.length === 0) return new Uint8Array(256).map((_, i) => i); // identity

  // Sort by x and deduplicate x values (keep last y)
  const sorted = points
    .reduce<{ x: number; y: number }[]>((acc, p) => {
      if (Number.isFinite(p.x) && Number.isFinite(p.y)) {
        acc.push({
          x: Math.max(0, Math.min(255, Math.round(p.x))),
          y: Math.max(0, Math.min(255, Math.round(p.y))),
        });
      }
      return acc;
    }, [])
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
export function applyCurve(points: CurvePoint[], imageData: ImageData): ImageData {
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

// ─── Levels ──────────────────────────────────────────────────────────

// ─── Levels ──────────────────────────────────────────────────────────

export interface LevelsParams {
  inBlack: number; inWhite: number; gamma: number; outBlack: number; outWhite: number;
}

export function applyLevels(levels: LevelsParams, imageData: ImageData): ImageData {
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
