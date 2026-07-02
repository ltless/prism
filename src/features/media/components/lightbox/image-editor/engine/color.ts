/**
 * Color adjustments: per-color HSL ranges, color grading (photo filter,
 * channel mixer, selective color, split toning, gradient map).
 * Extracted from AdjustmentEngine.ts (F13) — pure move, no behavior change.
 */
import type { HSLAdjustment, PhotoFilter, ChannelMixer, SelectiveColorAdjustment, SplitToning, GradientMap } from "../state/editorState";
import { clamp, getLuminance, rgbToHsl, hslToRgb } from "./shared";

// ─── HSL per-color ────────────────────────────────────────────────────

export const COLOR_RANGES: Record<string, { center: number; halfWidth: number; fullWidth: number }> = {
  red:     { center: 0,   halfWidth: 15,  fullWidth: 30  },
  orange:  { center: 30,  halfWidth: 15,  fullWidth: 25  },
  yellow:  { center: 60,  halfWidth: 15,  fullWidth: 25  },
  green:   { center: 120, halfWidth: 30,  fullWidth: 60  },
  aqua:    { center: 180, halfWidth: 15,  fullWidth: 25  },
  blue:    { center: 225, halfWidth: 30,  fullWidth: 50  },
  purple:  { center: 270, halfWidth: 15,  fullWidth: 25  },
  magenta: { center: 315, halfWidth: 30,  fullWidth: 50  },
};

export const HUE_COLORS = Object.keys(COLOR_RANGES);

export function hueFalloff(hueDeg: number, center: number, halfWidth: number, fullWidth: number): number {
  let dist = Math.abs(hueDeg - center);
  if (dist > 180) dist = 360 - dist;
  if (dist <= halfWidth) return 1;
  if (dist <= fullWidth) {
    const t = (dist - halfWidth) / (fullWidth - halfWidth);
    return Math.exp(-4 * t * t);
  }
  return 0;
}

export function applyHSL(
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

export function applyPhotoFilter(
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

export function applyChannelMixer(
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

export function applySelectiveColor(
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

export function applySplitToning(
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

export function applyGradientMap(
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
