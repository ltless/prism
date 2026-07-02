/**
 * Shared low-level helpers for the adjustment engine: byte clamping,
 * luminance, RGB↔HSL conversion, the Float32 scratch pool, bilinear sampling
 * and hex color parsing. Extracted from AdjustmentEngine.ts (F13) — pure
 * moves, no behavior change.
 */

// Clamp helper — reused by every adjustment that needs to bound output
// to the [0, 255] byte range. Math.max/Math.min are V8 intrinsics so this
// is effectively free compared to a branchy if/else.
export function clamp(v: number, min = 0, max = 255): number {
  if (v < min) return min;
  if (v > max) return max;
  return v;
}
// Luminance helper — ITU-R BT.601 (same as Photoshop's luminance channel).
// Luminance helper — ITU-R BT.601 (same as Photoshop's luminance channel).
// Used by tone control to build luminance-based masks.
export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
// ─── RGB ↔ HSL conversion utilities ──────────────────────────────────────
// ─── RGB ↔ HSL conversion utilities ──────────────────────────────────────
// Used by Hue, Saturation, Vibrance adjustments.
// All values normalized: RGB in [0,255], HSL in [0,1] (hue wraps at 1).

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
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

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
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

// Reusable Float32Array scratch buffers for spatial adjustments (clarity,
// sharpening, etc.). These functions allocate several width×height float
// buffers per call; during a slider drag that's ~3MB/frame of garbage the GC
// can't keep up with (the RAM-pinning symptom). The pool grows each buffer to
// the largest size seen and reuses it on subsequent calls — zero per-call
// allocation in steady state.
const scratchPool: Float32Array[] = [];
export function getScratch(index: number, size: number): Float32Array {
  const cur = scratchPool[index];
  if (cur && cur.length >= size) return cur;
  const arr = new Float32Array(size);
  scratchPool[index] = arr;
  return arr;
}

export function parseHexColor(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

export function lerpColor(c1: [number, number, number], c2: [number, number, number], t: number): [number, number, number] {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t
  ];
}

export function sampleBilinear(
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
