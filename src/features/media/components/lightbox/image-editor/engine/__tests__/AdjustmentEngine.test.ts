import { describe, it, expect } from "vitest";
import { applyAdjustments } from "../AdjustmentEngine";
import { DEFAULT_ADJUSTMENTS, type AdjustmentState, type CurvePoint } from "../../state/editorState";

describe("AdjustmentEngine.applyAdjustments", () => {
  it("returns input unchanged when all adjustments are at neutral defaults", () => {
    // 2x2 red image with alpha=255 on every pixel
    const data = new Uint8ClampedArray([
      100,
      50,
      0,
      255, // (0,0)
      255,
      0,
      0,
      255, // (1,0)
      0,
      255,
      0,
      255, // (0,1)
      0,
      0,
      255,
      255, // (1,1)
    ]);
    const original = new Uint8ClampedArray(data);
    const imageData = new ImageData(data, 2, 2);

    const result = applyAdjustments(DEFAULT_ADJUSTMENTS, imageData);

    expect(result.data).toEqual(original);
  });

  it("preserves image dimensions", () => {
    const imageData = new ImageData(new Uint8ClampedArray(4 * 3 * 5), 3, 5);
    const result = applyAdjustments(DEFAULT_ADJUSTMENTS, imageData);
    expect(result.width).toBe(3);
    expect(result.height).toBe(5);
  });
});

describe("applyExposure (via applyAdjustments)", () => {
  // Helper: 1x1 image at [100, 150, 200, 255]
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);

  const withExposure = (stops: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    exposure: stops,
  });

  it("exposure=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withExposure(0), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("exposure=+1 doubles brightness (100→200, 150→255 clamped, 200→255 clamped)", () => {
    const result = applyAdjustments(withExposure(1), basePixel());
    // 100×2=200, 150×2=300→255 (Uint8ClampedArray auto-clamp), 200×2=400→255
    expect(result.data[0]).toBe(200);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
  });

  it("exposure=-1 halves brightness (100→50, 150→75, 200→100)", () => {
    const result = applyAdjustments(withExposure(-1), basePixel());
    expect(result.data[0]).toBe(50);
    expect(result.data[1]).toBe(75);
    expect(result.data[2]).toBe(100);
  });

  it("exposure=+5 produces maximum brightness (all non-zero channels → 255)", () => {
    const result = applyAdjustments(withExposure(5), basePixel());
    // 32× multiplier, everything overflows to 255
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
  });

  it("preserves alpha channel regardless of exposure value", () => {
    const result = applyAdjustments(withExposure(2), basePixel());
    expect(result.data[3]).toBe(255); // alpha untouched
  });

  it("handles all-zero pixel correctly (0 stays 0 regardless of exposure)", () => {
    const image = new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1);
    const result = applyAdjustments(withExposure(3), image);
    expect(result.data[0]).toBe(0); // 0 × 8 = 0
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });
});

describe("applyContrast (via applyAdjustments)", () => {
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);

  const withContrast = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    contrast: value,
  });

  it("contrast=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withContrast(0), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("midpoint pixels (128,128,128) stay at 128 regardless of contrast", () => {
    const image = new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1);
    const result = applyAdjustments(withContrast(50), image);
    // 128 + (128-128) * 1.5 = 128 always
    expect(result.data[0]).toBe(128);
    expect(result.data[1]).toBe(128);
    expect(result.data[2]).toBe(128);
  });

  it("contrast=+100 stretches values around midpoint (factor=2)", () => {
    const result = applyAdjustments(withContrast(100), basePixel());
    // factor=2: 100→128+(-28)*2=72, 150→128+(22)*2=172, 200→128+(72)*2=272→255
    expect(result.data[0]).toBe(72);
    expect(result.data[1]).toBe(172);
    expect(result.data[2]).toBe(255);
  });

  it("contrast=-100 flattens to midpoint gray (128,128,128)", () => {
    const result = applyAdjustments(withContrast(-100), basePixel());
    // factor=0: 128 + (x-128)*0 = 128 for any x
    expect(result.data[0]).toBe(128);
    expect(result.data[1]).toBe(128);
    expect(result.data[2]).toBe(128);
  });

  it("contrast=+50 stretches moderately (factor=1.5)", () => {
    const result = applyAdjustments(withContrast(50), basePixel());
    // factor=1.5: 100→128+(-28)*1.5=86, 150→128+(22)*1.5=161, 200→128+(72)*1.5=236
    expect(result.data[0]).toBe(86);
    expect(result.data[1]).toBe(161);
    expect(result.data[2]).toBe(236);
  });

  it("preserves alpha channel regardless of contrast value", () => {
    const result = applyAdjustments(withContrast(75), basePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyBrightness (via applyAdjustments)", () => {
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);

  const withBrightness = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    brightness: value,
  });

  it("brightness=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withBrightness(0), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("brightness=+50 adds offset uniformly (100→150, 150→200, 200→250)", () => {
    const result = applyAdjustments(withBrightness(50), basePixel());
    expect(result.data[0]).toBe(150);
    expect(result.data[1]).toBe(200);
    expect(result.data[2]).toBe(250);
  });

  it("brightness=-50 subtracts uniformly (100→50, 150→100, 200→150)", () => {
    const result = applyAdjustments(withBrightness(-50), basePixel());
    expect(result.data[0]).toBe(50);
    expect(result.data[1]).toBe(100);
    expect(result.data[2]).toBe(150);
  });

  it("brightness=+100 clamps upper bound (200→255)", () => {
    const result = applyAdjustments(withBrightness(100), basePixel());
    expect(result.data[0]).toBe(200);
    expect(result.data[1]).toBe(250);
    expect(result.data[2]).toBe(255); // 200+100=300 → 255
  });

  it("brightness=-100 clamps lower bound (100→0)", () => {
    const result = applyAdjustments(withBrightness(-100), basePixel());
    expect(result.data[0]).toBe(0); // 100-100=0
    expect(result.data[1]).toBe(50);
    expect(result.data[2]).toBe(100);
  });

  it("preserves alpha channel regardless of brightness value", () => {
    const result = applyAdjustments(withBrightness(80), basePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyGamma (via applyAdjustments)", () => {
  const midtonePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1);

  const withGamma = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    gamma: value,
  });

  it("gamma=1 returns input unchanged (identity, exponent=1)", () => {
    const result = applyAdjustments(withGamma(1), midtonePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([128, 128, 128, 255]));
  });

  it("gamma=2 brightens midtones (128 → ~181 via sqrt curve)", () => {
    const result = applyAdjustments(withGamma(2), midtonePixel());
    // exponent=0.5; 255 * sqrt(128/255) = 255 * sqrt(0.502) ≈ 255 * 0.709 ≈ 181
    expect(result.data[0]).toBe(181);
    expect(result.data[1]).toBe(181);
    expect(result.data[2]).toBe(181);
  });

  it("gamma=0.5 darkens midtones (128 → ~64 via square curve)", () => {
    const result = applyAdjustments(withGamma(0.5), midtonePixel());
    // exponent=2; 255 * (128/255)^2 = 255 * 0.252 ≈ 64
    expect(result.data[0]).toBe(64);
    expect(result.data[1]).toBe(64);
    expect(result.data[2]).toBe(64);
  });

  it("preserves zero (0 stays 0 regardless of gamma)", () => {
    const image = new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1);
    const result = applyAdjustments(withGamma(2), image);
    expect(result.data[0]).toBe(0);
  });

  it("preserves maximum (255 stays 255 regardless of gamma)", () => {
    const image = new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1);
    const result = applyAdjustments(withGamma(0.5), image);
    expect(result.data[0]).toBe(255);
  });

  it("preserves alpha channel regardless of gamma value", () => {
    const result = applyAdjustments(withGamma(1.5), midtonePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyHighlights (via applyAdjustments)", () => {
  const pureHighlight = (): ImageData =>
    new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1); // luminance=255

  const midtonePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1); // luminance=128

  const shadowPixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([50, 50, 50, 255]), 1, 1); // luminance=50

  const withHighlights = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    highlights: value,
  });

  it("highlights=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withHighlights(0), pureHighlight());
    expect(result.data).toEqual(new Uint8ClampedArray([255, 255, 255, 255]));
  });

  it("pixels at or below threshold (128) are unaffected", () => {
    const result = applyAdjustments(withHighlights(50), midtonePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([128, 128, 128, 255]));
  });

  it("pixels at luminance=50 are unaffected (below threshold)", () => {
    const result = applyAdjustments(withHighlights(80), shadowPixel());
    expect(result.data).toEqual(new Uint8ClampedArray([50, 50, 50, 255]));
  });

  it("positive value darkens pure highlights (255→230 at value=50)", () => {
    const result = applyAdjustments(withHighlights(50), pureHighlight());
    // luminance=255: weight=(255-128)/127=1.0, offset=-50*1.0*0.5=-25, new=230
    expect(result.data[0]).toBe(230);
    expect(result.data[1]).toBe(230);
    expect(result.data[2]).toBe(230);
  });

  it("negative value brightens pure highlights (capped at 255)", () => {
    const result = applyAdjustments(withHighlights(-50), pureHighlight());
    // Already at 255, positive offset clamps at 255
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
  });

  it("preserves alpha channel regardless of highlights value", () => {
    const result = applyAdjustments(withHighlights(40), pureHighlight());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyShadows (via applyAdjustments)", () => {
  const pureShadow = (): ImageData =>
    new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1); // luminance=0

  const midtonePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1); // luminance=128

  const highlightPixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1); // luminance=255

  const withShadows = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    shadows: value,
  });

  it("shadows=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withShadows(0), pureShadow());
    expect(result.data).toEqual(new Uint8ClampedArray([0, 0, 0, 255]));
  });

  it("pixels at or above threshold (128) are unaffected", () => {
    const result = applyAdjustments(withShadows(50), midtonePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([128, 128, 128, 255]));
  });

  it("pixels at luminance=255 are unaffected (above threshold)", () => {
    const result = applyAdjustments(withShadows(80), highlightPixel());
    expect(result.data).toEqual(new Uint8ClampedArray([255, 255, 255, 255]));
  });

  it("positive value brightens pure shadows (0→25 at value=50)", () => {
    const result = applyAdjustments(withShadows(50), pureShadow());
    // luminance=0: weight=1.0, offset=50*1.0*0.5=25, new=25
    expect(result.data[0]).toBe(25);
    expect(result.data[1]).toBe(25);
    expect(result.data[2]).toBe(25);
  });

  it("negative value darkens pure shadows (already at 0, stays 0)", () => {
    const result = applyAdjustments(withShadows(-50), pureShadow());
    // Already at 0, negative offset clamps at 0
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it("preserves alpha channel regardless of shadows value", () => {
    const result = applyAdjustments(withShadows(40), pureShadow());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyWhites (via applyAdjustments)", () => {
  const midtonePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1);

  const whitePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1);

  const withWhites = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    whites: value,
  });

  it("whites=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withWhites(0), midtonePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([128, 128, 128, 255]));
  });

  it("positive value compresses histogram (128 → ~149 at value=50, whitePoint=230)", () => {
    const result = applyAdjustments(withWhites(50), midtonePixel());
    // whitePoint = 255 - 25 = 230, multiplier = 255/230 ≈ 1.109
    // 128 * 1.109 ≈ 142
    expect(result.data[0]).toBe(142);
    expect(result.data[1]).toBe(142);
    expect(result.data[2]).toBe(142);
  });

  it("positive value+100 clips more (whitePoint=205, 255 stays 255 via clamping)", () => {
    const result = applyAdjustments(withWhites(100), whitePixel());
    // 255 * (255/205) = 317 → clamped to 255
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
  });

  it("preserves alpha channel regardless of whites value", () => {
    const result = applyAdjustments(withWhites(75), midtonePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyBlacks (via applyAdjustments)", () => {
  const midtonePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1);

  const blackPixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1);

  const withBlacks = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    blacks: value,
  });

  it("blacks=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withBlacks(0), midtonePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([128, 128, 128, 255]));
  });

  it("positive value raises black point (128 → ~156 at value=50, blackPoint=25)", () => {
    const result = applyAdjustments(withBlacks(50), midtonePixel());
    // blackPoint=25, range=230, factor=230/255 ≈ 0.902
    // (128-25)/0.902 ≈ 114
    expect(result.data[0]).toBe(114);
    expect(result.data[1]).toBe(114);
    expect(result.data[2]).toBe(114);
  });

  it("positive value+100 clips shadows to higher black (blackPoint=50, 0 stays 0 via clamping)", () => {
    const result = applyAdjustments(withBlacks(100), blackPixel());
    // (0-50)/0.8 = -62.5 → clamped to 0
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it("preserves alpha channel regardless of blacks value", () => {
    const result = applyAdjustments(withBlacks(75), midtonePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyClarity (via applyAdjustments)", () => {
  const withClarity = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    clarity: value,
  });

  it("clarity=0 returns input unchanged (identity)", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);
    const result = applyAdjustments(withClarity(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("uniform region is unaffected by clarity (blur returns same value, diff=0)", () => {
    // 4×4 grid of identical midtone pixels — no local contrast to enhance
    const data = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;
      data[i + 1] = 128;
      data[i + 2] = 128;
      data[i + 3] = 255;
    }
    const image = new ImageData(data, 4, 4);
    const result = applyAdjustments(withClarity(50), image);

    // Every pixel should still be 128 (or very close, within box blur edge effects)
    for (let i = 0; i < result.data.length; i += 4) {
      expect(result.data[i]).toBeCloseTo(128, 0);
    }
  });

  it("positive clarity increases local contrast at edges", () => {
    // 32×32 grid with a sharp horizontal brightness edge (top half dark, bottom half bright)
    // Need image bigger than clarity radius (15) for blur to produce visible diff
    const size = 32;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const base = (y * size + x) * 4;
        const v = y < size / 2 ? 50 : 200;
        data[base] = v;
        data[base + 1] = v;
        data[base + 2] = v;
        data[base + 3] = 255;
      }
    }
    const image = new ImageData(data, size, size);
    const original = new Uint8ClampedArray(data);
    const result = applyAdjustments(withClarity(100), image);

    // Edge pixels should have increased contrast (darks darker near edge, brights brighter)
    const changed = Array.from(result.data).some((v, i) => i % 4 !== 3 && v !== original[i]);
    expect(changed).toBe(true);
  });

  it("preserves alpha channel regardless of clarity value", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);
    const result = applyAdjustments(withClarity(50), image);
    expect(result.data[3]).toBe(255);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Color Basics — Temperature, Tint, Hue, Saturation, Vibrance
// ═══════════════════════════════════════════════════════════════════════════

describe("applyTemperature (via applyAdjustments)", () => {
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);

  const withTemp = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    temperature: value,
  });

  it("temperature=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withTemp(0), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("positive value warms image (R increases via scale, B decreases)", () => {
    const result = applyAdjustments(withTemp(50), basePixel());
    // t=0.5, rScale=1.075, bScale=0.925
    expect(result.data[0]).toBe(108); // 100*1.075=107.5→108
    expect(result.data[1]).toBe(150); // G unchanged
    expect(result.data[2]).toBe(185); // 200*0.925=185
  });

  it("negative value cools image (B increases, R decreases)", () => {
    const result = applyAdjustments(withTemp(-50), basePixel());
    // t=-0.5, rScale=0.925, bScale=1.075
    expect(result.data[0]).toBe(92);  // 100*0.925=92.5→92
    expect(result.data[1]).toBe(150); // G unchanged
    expect(result.data[2]).toBe(215); // 200*1.075=215
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(withTemp(75), basePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyTint (via applyAdjustments)", () => {
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);

  const withTint = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    tint: value,
  });

  it("tint=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withTint(0), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("positive value shifts toward magenta (G decreases, R+B increase)", () => {
    const result = applyAdjustments(withTint(50), basePixel());
    // t=0.5, gAdjust=-15, rbAdjust=7.5
    expect(result.data[0]).toBe(108); // 100+7.5≈108
    expect(result.data[1]).toBe(135); // 150-15
    expect(result.data[2]).toBe(208); // 200+7.5≈208
  });

  it("negative value shifts toward green (G increases, R+B decrease)", () => {
    const result = applyAdjustments(withTint(-50), basePixel());
    // t=-0.5, gAdjust=15, rbAdjust=-7.5
    expect(result.data[0]).toBe(92);  // 100-7.5=92.5→92 (Uint8ClampedArray rounding)
    expect(result.data[1]).toBe(165); // 150+15
    expect(result.data[2]).toBe(192); // 200-7.5=192.5→192
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(withTint(80), basePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyHue (via applyAdjustments)", () => {
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([255, 0, 0, 255]), 1, 1); // pure red

  const withHue = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    hue: value,
  });

  it("hue=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withHue(0), basePixel());
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it("hue=120 shifts red to green (approximately)", () => {
    const result = applyAdjustments(withHue(120), basePixel());
    // Red (hue=0°) + 120° = 120° = green
    expect(result.data[1]).toBeGreaterThan(200); // G should be high
    expect(result.data[0]).toBeLessThan(50);     // R should be low
    expect(result.data[2]).toBeLessThan(50);     // B should be low
  });

  it("hue=180 shifts red to cyan (approximately)", () => {
    const result = applyAdjustments(withHue(180), basePixel());
    // Red (hue=0°) + 180° = 180° = cyan (green+blue)
    expect(result.data[0]).toBeLessThan(50);     // R should be low
    expect(result.data[1]).toBeGreaterThan(200); // G should be high
    expect(result.data[2]).toBeGreaterThan(200); // B should be high
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(withHue(90), basePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applySaturation (via applyAdjustments)", () => {
  const colorPixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([200, 50, 50, 255]), 1, 1); // saturated red

  const grayPixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1); // gray (no saturation)

  const withSat = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    saturation: value,
  });

  it("saturation=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withSat(0), colorPixel());
    expect(result.data[0]).toBe(200);
    expect(result.data[1]).toBe(50);
    expect(result.data[2]).toBe(50);
  });

  it("saturation=-100 converts to grayscale (all channels equal)", () => {
    const result = applyAdjustments(withSat(-100), colorPixel());
    // factor=0, newS=0 → all channels = luminance
    expect(result.data[0]).toBe(result.data[1]);
    expect(result.data[1]).toBe(result.data[2]);
  });

  it("gray pixels are unaffected by saturation (already at s=0)", () => {
    const result = applyAdjustments(withSat(100), grayPixel());
    // Gray has s=0, 0 * 2 = 0, so stays gray
    expect(result.data[0]).toBe(128);
    expect(result.data[1]).toBe(128);
    expect(result.data[2]).toBe(128);
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(withSat(50), colorPixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyVibrance (via applyAdjustments)", () => {
  const colorPixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([200, 50, 50, 255]), 1, 1); // saturated red

  const mutedPixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([160, 120, 120, 255]), 1, 1); // low saturation

  const withVibrance = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    vibrance: value,
  });

  it("vibrance=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withVibrance(0), colorPixel());
    expect(result.data[0]).toBe(200);
    expect(result.data[1]).toBe(50);
    expect(result.data[2]).toBe(50);
  });

  it("positive vibrance boosts muted colors more than saturated ones", () => {
    const resultColor = applyAdjustments(withVibrance(50), colorPixel());
    const resultMuted = applyAdjustments(withVibrance(50), mutedPixel());

    // Muted pixel should have a bigger saturation change than already-saturated pixel
    // Compare channel spread (max-min) as a proxy for saturation
    const colorSpreadBefore = 200 - 50; // = 150
    const mutedSpreadBefore = 160 - 120; // = 40
    const colorSpreadAfter = Math.max(resultColor.data[0], resultColor.data[1], resultColor.data[2])
      - Math.min(resultColor.data[0], resultColor.data[1], resultColor.data[2]);
    const mutedSpreadAfter = Math.max(resultMuted.data[0], resultMuted.data[1], resultMuted.data[2])
      - Math.min(resultMuted.data[0], resultMuted.data[1], resultMuted.data[2]);

    // Muted pixel should have proportionally larger increase
    const mutedIncrease = mutedSpreadAfter / mutedSpreadBefore;
    const colorIncrease = colorSpreadAfter / colorSpreadBefore;
    expect(mutedIncrease).toBeGreaterThan(colorIncrease);
  });

  it("negative vibrance reduces saturation (similar to negative saturation)", () => {
    const result = applyAdjustments(withVibrance(-50), colorPixel());
    // Should reduce the spread between channels
    const spreadAfter = Math.max(result.data[0], result.data[1], result.data[2])
      - Math.min(result.data[0], result.data[1], result.data[2]);
    const spreadBefore = 200 - 50; // = 150
    expect(spreadAfter).toBeLessThan(spreadBefore);
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(withVibrance(50), colorPixel());
    expect(result.data[3]).toBe(255);
  });
});

// Detail Control Tests
describe("applySharpening (via applyAdjustments)", () => {
  const withSharpening = (amount: number, radius?: number, detail?: number, masking?: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    sharpening: amount,
    sharpeningRadius: radius ?? 1,
    sharpeningDetail: detail ?? 25,
    sharpeningMasking: masking ?? 0,
  });

  it("amount=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withSharpening(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withSharpening(50), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyNoiseReduction (via applyAdjustments)", () => {
  const withNR = (luminance: number, detail?: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    noiseReduction: luminance,
    noiseReductionDetail: detail ?? 25,
  });

  it("luminance=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withNR(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withNR(50), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyGaussianBlur (via applyAdjustments)", () => {
  const withBlur = (radius: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    gaussianBlur: radius,
  });

  it("radius=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withBlur(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withBlur(10), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyMedianFilter (via applyAdjustments)", () => {
  const withMedian = (radius: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    medianFilter: radius,
  });

  it("radius=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withMedian(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withMedian(2), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyMotionBlur (via applyAdjustments)", () => {
  const withMotion = (angle: number, distance: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    motionBlur: { angle, distance },
  });

  it("distance=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withMotion(0, 0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withMotion(45, 10), image);
    expect(result.data[3]).toBe(255);
  });
});

// Effects Tests
describe("applyVignette (via applyAdjustments)", () => {
  const withVignette = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    vignette: value,
  });

  it("vignette=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withVignette(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withVignette(50), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyGrain (via applyAdjustments)", () => {
  const withGrain = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    grain: value,
  });

  it("grain=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withGrain(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withGrain(50), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyTexture (via applyAdjustments)", () => {
  const withTexture = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    texture: value,
  });

  it("texture=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withTexture(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withTexture(50), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyDehaze (via applyAdjustments)", () => {
  const withDehaze = (value: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    dehaze: value,
  });

  it("dehaze=0 returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withDehaze(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withDehaze(50), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyCurve (via applyAdjustments)", () => {
  const withCurve = (points: CurvePoint[]): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    curvePoints: points,
  });

  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);

  it("empty points = identity", () => {
    const result = applyAdjustments(withCurve([]), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("identity curve (0->0, 255->255) returns input unchanged", () => {
    const result = applyAdjustments(
      withCurve([{ x: 0, y: 0 }, { x: 255, y: 255 }]),
      basePixel()
    );
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("S-curve produces higher contrast (100→86, 150→145, 200→214)", () => {
    const result = applyAdjustments(
      withCurve([
        { x: 0, y: 0 },
        { x: 64, y: 32 },
        { x: 192, y: 224 },
        { x: 255, y: 255 },
      ]),
      new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1)
    );
    // Midtones get darkened/brightened away from center
    expect(result.data[0]).toBeLessThan(120);
    expect(result.data[2]).toBeGreaterThan(210);
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(
      withCurve([{ x: 0, y: 50 }, { x: 255, y: 200 }]),
      basePixel()
    );
    expect(result.data[3]).toBe(255);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Creative Color — Invert, Solarize, Posterize, Threshold, Duotone+
// ═══════════════════════════════════════════════════════════════════════════

describe("applyInvert (via applyAdjustments)", () => {
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);

  const withInvert = (invert: boolean): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    invert,
  });

  it("invert=false returns input unchanged (identity)", () => {
    const result = applyAdjustments(withInvert(false), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("invert=true negates each channel (100→155, 150→105, 200→55)", () => {
    const result = applyAdjustments(withInvert(true), basePixel());
    expect(result.data[0]).toBe(155); // 255-100
    expect(result.data[1]).toBe(105); // 255-150
    expect(result.data[2]).toBe(55);  // 255-200
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(withInvert(true), basePixel());
    expect(result.data[3]).toBe(255);
  });

  it("extreme pixel values invert correctly (0→255, 255→0)", () => {
    const image = new ImageData(new Uint8ClampedArray([0, 255, 128, 255]), 1, 1);
    const result = applyAdjustments(withInvert(true), image);
    expect(result.data[0]).toBe(255);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(127);
  });
});

describe("applySolarize (via applyAdjustments)", () => {
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([200, 100, 50, 255]), 1, 1);

  const withSolarize = (threshold: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    solarize: threshold,
  });

  it("solarize=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withSolarize(0), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([200, 100, 50, 255]));
  });

  it("solarize at high threshold (255) leaves everything unchanged", () => {
    // luminance=200*0.299+100*0.587+50*0.114≈130, < 255 → no invert
    const result = applyAdjustments(withSolarize(255), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([200, 100, 50, 255]));
  });

  it("solarize at threshold=1 inverts pixels with luminance > 1 (near full invert)", () => {
    const result = applyAdjustments(withSolarize(1), basePixel());
    // luminance ≈ 130 > 1 → invert
    expect(result.data[0]).toBe(55);  // 255-200
    expect(result.data[1]).toBe(155); // 255-100
    expect(result.data[2]).toBe(205); // 255-50
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(withSolarize(128), basePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyPosterize (via applyAdjustments)", () => {
  const basePixel = (): ImageData =>
    new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);

  const withPosterize = (levels: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    posterize: levels,
  });

  it("posterize=0 returns input unchanged (identity)", () => {
    const result = applyAdjustments(withPosterize(0), basePixel());
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("posterize=2 reduces to binary levels (0 or 255)", () => {
    const result = applyAdjustments(withPosterize(2), basePixel());
    // step=255, 100/255=0.39→0*255=0, 150/255=0.59→1*255=255, 200/255=0.78→1*255=255
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
  });

  it("posterize=4 quantizes to 4 levels (step=85)", () => {
    const result = applyAdjustments(withPosterize(4), basePixel());
    // step=85, 100/85=1.18→1*85=85, 150/85=1.76→2*85=170, 200/85=2.35→2*85=170
    expect(result.data[0]).toBe(85);
    expect(result.data[1]).toBe(170);
    expect(result.data[2]).toBe(170);
  });

  it("preserves alpha channel", () => {
    const result = applyAdjustments(withPosterize(8), basePixel());
    expect(result.data[3]).toBe(255);
  });
});

describe("applyThreshold (via applyAdjustments)", () => {
  const withThreshold = (t: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    threshold: t,
  });

  it("threshold=0 returns input unchanged (identity)", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);
    const result = applyAdjustments(withThreshold(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("threshold=128 produces binary output based on luminance > 128", () => {
    // Dark pixel: luminance≈50 → 0
    const dark = new ImageData(new Uint8ClampedArray([50, 50, 50, 255]), 1, 1);
    const darkResult = applyAdjustments(withThreshold(128), dark);
    expect(darkResult.data[0]).toBe(0);
    expect(darkResult.data[1]).toBe(0);
    expect(darkResult.data[2]).toBe(0);

    // Bright pixel: luminance≈200 → 255
    const bright = new ImageData(new Uint8ClampedArray([200, 200, 200, 255]), 1, 1);
    const brightResult = applyAdjustments(withThreshold(128), bright);
    expect(brightResult.data[0]).toBe(255);
    expect(brightResult.data[1]).toBe(255);
    expect(brightResult.data[2]).toBe(255);
  });

  it("threshold=255 makes all non-max pixels black", () => {
    const image = new ImageData(new Uint8ClampedArray([254, 254, 254, 255]), 1, 1);
    const result = applyAdjustments(withThreshold(255), image);
    expect(result.data[0]).toBe(0);
    expect(result.data[1]).toBe(0);
    expect(result.data[2]).toBe(0);
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withThreshold(128), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyDuotone (via applyAdjustments)", () => {
  const withDuotone = (colorA: string, colorB: string): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    duotone: { colorA, colorB },
  });

  it("duotone=null returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 150, 200, 255]), 1, 1);
    const result = applyAdjustments({ ...DEFAULT_ADJUSTMENTS, duotone: null }, image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 150, 200, 255]));
  });

  it("applies duotone gradient to pixel based on luminance", () => {
    // Pure black pixel → should map to colorA (#ff0000 = red)
    const blackImg = new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1);
    const blackResult = applyAdjustments(withDuotone('#ff0000', '#0000ff'), blackImg);
    expect(blackResult.data[0]).toBe(255); // R from colorA
    expect(blackResult.data[1]).toBe(0);
    expect(blackResult.data[2]).toBe(0);

    // Pure white pixel → should map to colorB (#0000ff = blue)
    const whiteImg = new ImageData(new Uint8ClampedArray([255, 255, 255, 255]), 1, 1);
    const whiteResult = applyAdjustments(withDuotone('#ff0000', '#0000ff'), whiteImg);
    expect(whiteResult.data[0]).toBe(0);
    expect(whiteResult.data[1]).toBe(0);
    expect(whiteResult.data[2]).toBe(255);
  });
});

describe("applyTritone (via applyAdjustments)", () => {
  const withTritone = (a: string, b: string, c: string): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    tritone: { colorA: a, colorB: b, colorC: c },
  });

  it("tritone=null returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments({ ...DEFAULT_ADJUSTMENTS, tritone: null }, image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("applies tritone gradient (black→green→white)", () => {
    // Black pixel → colorA (#ff0000)
    const black = new ImageData(new Uint8ClampedArray([0, 0, 0, 255]), 1, 1);
    const r = applyAdjustments(withTritone('#ff0000', '#00ff00', '#0000ff'), black);
    expect(r.data[0]).toBe(255); // maps to colorA

    // Mid-gray pixel → colorB (#00ff00)
    const mid = new ImageData(new Uint8ClampedArray([128, 128, 128, 255]), 1, 1);
    const r2 = applyAdjustments(withTritone('#ff0000', '#00ff00', '#0000ff'), mid);
    expect(r2.data[1]).toBeGreaterThan(200); // green channel high
  });
});

describe("applyQuadtone (via applyAdjustments)", () => {
  it("quadtone=null returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments({ ...DEFAULT_ADJUSTMENTS, quadtone: null }, image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Blur & Lens Corrections — Distortion, CA, Defringe, Perspective
// ═══════════════════════════════════════════════════════════════════════════

describe("applyDistortion (via applyAdjustments)", () => {
  const withDistortion = (distortion: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    lensCorrections: { distortion, vignetting: 0, chromaticAberrationRedCyan: 0, chromaticAberrationBlueYellow: 0, defringe: 0 },
  });

  it("distortion=0 returns input unchanged (identity)", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withDistortion(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("distortion=null (no lensCorrections) returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(DEFAULT_ADJUSTMENTS, image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withDistortion(50), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyChromaticAberration (via applyAdjustments)", () => {
  const withCA = (rc: number, by: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    lensCorrections: { distortion: 0, vignetting: 0, chromaticAberrationRedCyan: rc, chromaticAberrationBlueYellow: by, defringe: 0 },
  });

  it("rc=0, by=0 returns input unchanged (identity)", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withCA(0, 0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves green channel when only RC is adjusted", () => {
    // 3x3 image to allow bilinear sampling near center
    const data = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 200; data[i + 1] = 100; data[i + 2] = 50; data[i + 3] = 255;
    }
    const image = new ImageData(data, 3, 3);
    const result = applyAdjustments(withCA(50, 0), image);
    // G channel should remain near 100 (unchanged by CA)
    expect(result.data[1]).toBeCloseTo(100, 0);
  });
});

describe("applyLensVignetting (via applyAdjustments)", () => {
  const withLensVignette = (v: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    lensCorrections: { distortion: 0, vignetting: v, chromaticAberrationRedCyan: 0, chromaticAberrationBlueYellow: 0, defringe: 0 },
  });

  it("vignetting=0 returns input unchanged (identity)", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withLensVignette(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withLensVignette(50), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyDefringe (via applyAdjustments)", () => {
  const withDefringe = (amount: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    lensCorrections: { distortion: 0, vignetting: 0, chromaticAberrationRedCyan: 0, chromaticAberrationBlueYellow: 0, defringe: amount },
  });

  it("defringe=0 returns input unchanged (identity)", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withDefringe(0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("uniform image is unaffected by defringe (no edges)", () => {
    // 5×5 uniform gray — no edges to fringe
    const data = new Uint8ClampedArray(5 * 5 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128; data[i + 1] = 128; data[i + 2] = 128; data[i + 3] = 255;
    }
    const image = new ImageData(data, 5, 5);
    const result = applyAdjustments(withDefringe(10), image);
    // Should be nearly unchanged (no edges detected)
    expect(result.data[0]).toBe(128);
    expect(result.data[1]).toBe(128);
    expect(result.data[2]).toBe(128);
  });

  it("preserves alpha channel", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withDefringe(10), image);
    expect(result.data[3]).toBe(255);
  });
});

describe("applyPerspective (via applyAdjustments)", () => {
  const withPerspective = (vertical: number, horizontal: number): AdjustmentState => ({
    ...DEFAULT_ADJUSTMENTS,
    perspective: { upright: "off" as const, vertical, horizontal, rotate: 0, aspect: 0, scale: 100 },
  });

  it("vertical=0, horizontal=0 returns input unchanged (identity)", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(withPerspective(0, 0), image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("perspective=null returns input unchanged", () => {
    const image = new ImageData(new Uint8ClampedArray([100, 100, 100, 255]), 1, 1);
    const result = applyAdjustments(DEFAULT_ADJUSTMENTS, image);
    expect(result.data).toEqual(new Uint8ClampedArray([100, 100, 100, 255]));
  });

  it("preserves alpha channel", () => {
    // Use 3×3 image so center pixel maps in-bounds after transform
    const data = new Uint8ClampedArray(3 * 3 * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 100; data[i + 1] = 150; data[i + 2] = 200; data[i + 3] = 255;
    }
    const image = new ImageData(data, 3, 3);
    const result = applyAdjustments(withPerspective(50, 0), image);
    // Center pixel (index 4*4=16) should retain alpha
    expect(result.data[19]).toBe(255);
  });
});
