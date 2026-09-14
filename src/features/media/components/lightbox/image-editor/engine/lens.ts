/**
 * Geometric/lens corrections: distortion, chromatic aberration, lens
 * vignetting, defringe and perspective. Extracted from AdjustmentEngine.ts
 * (F13) — pure move, no behavior change.
 */
import { clamp, getLuminance, sampleBilinear } from "./shared";
import { applyVignette } from "./effects";

export interface LensCorrections {
  distortion: number;
  vignetting: number;
  chromaticAberrationRedCyan: number;
  chromaticAberrationBlueYellow: number;
  defringe: number;
}

export function applyLensCorrections(lc: LensCorrections | null, imageData: ImageData): ImageData {
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

export function applyDistortion(distortion: number, imageData: ImageData): ImageData {
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

export function applyChromaticAberration(rc: number, by: number, imageData: ImageData): ImageData {
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

export function applyLensVignetting(vignetting: number, imageData: ImageData): ImageData {
  if (vignetting === 0) return imageData;
  return applyVignette(vignetting, imageData);
}

export function applyDefringe(amount: number, imageData: ImageData): ImageData {
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

export interface Perspective {
  upright: "off" | "auto" | "vertical" | "horizontal" | "full";
  vertical: number;
  horizontal: number;
  rotate: number;
  aspect: number;
  scale: number;
}

export function applyPerspective(p: Perspective | null, imageData: ImageData): ImageData {
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
