/**
 * Effect adjustments: vignette, grain, gaussian/median/motion blur, invert,
 * solarize, posterize, threshold and duo/tri/quadtone mapping.
 * Extracted from AdjustmentEngine.ts (F13) — pure move, no behavior change.
 */
import { clamp, getLuminance, parseHexColor, lerpColor } from "./shared";

export function applyVignette(value: number, imageData: ImageData): ImageData {
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

export function applyGrain(value: number, imageData: ImageData): ImageData {
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
export function applyGaussianBlur(radius: number, imageData: ImageData): ImageData {
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
export function applyMedianFilter(radius: number, imageData: ImageData): ImageData {
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
  
  data.set(result);
  return imageData;
}

// Motion Blur
export function applyMotionBlur(
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

  data.set(result);
  return imageData;
}

export function applyInvert(invert: boolean, imageData: ImageData): ImageData {
  if (!invert) return imageData;
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
  return imageData;
}

export function applySolarize(threshold: number, imageData: ImageData): ImageData {
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

export function applyPosterize(levels: number, imageData: ImageData): ImageData {
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

export function applyThreshold(threshold: number, imageData: ImageData): ImageData {
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

export interface Duotone {
  colorA: string;
  colorB: string;
}

export interface Tritone {
  colorA: string;
  colorB: string;
  colorC: string;
}

export interface Quadtone {
  colorA: string;
  colorB: string;
  colorC: string;
  colorD: string;
}

export function applyDuotone(duotone: Duotone | null, imageData: ImageData): ImageData {
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

export function applyTritone(tritone: Tritone | null, imageData: ImageData): ImageData {
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

export function applyQuadtone(quadtone: Quadtone | null, imageData: ImageData): ImageData {
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
