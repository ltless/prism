/**
 * AdjustmentEngine — the engine's public entry point. The implementation
 * now lives in sibling modules split by category (F13 refactor, no behavior
 * change):
 *
 *   pipeline.ts  applyAdjustments + hasActiveAdjustments + composed fast paths
 *   tone.ts      basic light, tone targeting, curves, levels
 *   color.ts     per-color HSL + color grading
 *   detail.ts    clarity, texture, dehaze, sharpening, noise reduction
 *   effects.ts   vignette, grain, blurs, invert/posterize/threshold, toning maps
 *   lens.ts      distortion, aberration, defringe, perspective
 *   shared.ts    clamp, luminance, HSL conversion, scratch pool, sampling
 *
 * This barrel keeps the public API (applyAdjustments, hasActiveAdjustments)
 * unchanged so no importer needs to change.
 */
export { applyAdjustments, hasActiveAdjustments } from "./pipeline";
export type { LevelsParams } from "./tone";
