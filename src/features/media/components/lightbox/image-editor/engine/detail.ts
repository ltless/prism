/**
 * Detail/local adjustments: clarity, texture, dehaze, sharpening, noise
 * reduction. Extracted from AdjustmentEngine.ts (F13) — pure move, no
 * behavior change.
 */
import { clamp, getLuminance, getScratch } from "./shared";

export function applyClarity(value: number, imageData: ImageData): ImageData {
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
export function boxBlurLuminance(
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

export function applyTexture(value: number, imageData: ImageData): ImageData {
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

export function applyDehaze(value: number, imageData: ImageData): ImageData {
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

export function applySharpening(
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

export function applyNoiseReduction(
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
