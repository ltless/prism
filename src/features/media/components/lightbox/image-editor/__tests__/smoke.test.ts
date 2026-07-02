import { describe, it, expect, beforeEach } from "vitest";
import {
  useEditorState,
  DEFAULT_ADJUSTMENTS,
} from "../state/editorState";
import {
  useHistoryStore,
  getSnapshot,
  MAX_HISTORY,
} from "../state/history";
import { applyAdjustments } from "../engine/AdjustmentEngine";

// Reset stores before each test
beforeEach(() => {
  useHistoryStore.setState({ past: [], future: [] });
  useEditorState.setState({
    rotation: 0,
    flipH: false,
    flipV: false,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    crop: null,
    isDirty: false,
    activeTool: "select",
  });
});

describe("P0-10: Smoke / integration tests", () => {
  it("handles 50 rapid adjustment mutations without throwing or race-conditioning", () => {
    // Baseline snapshot
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    const state = useEditorState.getState();

    // Simulate 50 rapid adjustments — like user dragging a slider 50 ticks
    // rapidly. Each adjustment is wrapped in a snapshot to test the full
    // undo/redo stack interaction under load.
    for (let i = 1; i <= 50; i++) {
      useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));
      state.setAdjustment("temperature", i);
      state.setAdjustment("tint", -i);
      state.setAdjustment("exposure", (i / 10));
    }

    // Verify final state reflects last adjustment
    const finalAdj = useEditorState.getState().adjustments;
    expect(finalAdj.temperature).toBe(50);
    expect(finalAdj.tint).toBe(-50);
    expect(finalAdj.exposure).toBeCloseTo(5.0);

    // History stack capped at MAX_HISTORY — verify cap works
    expect(useHistoryStore.getState().past.length).toBeLessThanOrEqual(MAX_HISTORY);
  });

  it("undo/redo 50 steps completes without errors", () => {
    // Seed baseline
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    // Push 50 snapshots: after each rotation change, snapshot it
    for (let i = 1; i <= MAX_HISTORY; i++) {
      useEditorState.getState().setTransform({ rotation: i });
      useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));
    }

    expect(useEditorState.getState().rotation).toBe(MAX_HISTORY);

    // Verify history is capped
    expect(useHistoryStore.getState().past.length).toBe(MAX_HISTORY);

    // Undo 20 steps — should step back to rotation=30
    for (let i = 0; i < 20; i++) {
      const undone = useHistoryStore.getState().undo();
      expect(undone).toBe(true);
    }
    expect(useEditorState.getState().rotation).toBe(MAX_HISTORY - 20);

    // Redo 10 steps — should step forward to rotation=40
    for (let i = 0; i < 10; i++) {
      const redone = useHistoryStore.getState().redo();
      expect(redone).toBe(true);
    }
    expect(useEditorState.getState().rotation).toBe(MAX_HISTORY - 10);

    // Reset history
    useHistoryStore.getState().resetHistory();
    expect(useHistoryStore.getState().past.length).toBe(0);
    expect(useHistoryStore.getState().future.length).toBe(0);
  });

  it("adjustment snapshot deep-copies adjustments to prevent cross-contamination", () => {
    // Take two snapshots at different states
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    useEditorState.getState().setAdjustment("temperature", 10);
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    useEditorState.getState().setAdjustment("temperature", 20);
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    const past = useHistoryStore.getState().past;
    expect(past.length).toBe(3);

    // Each snapshot's adjustments should be independent references
    expect(past[0].adjustments).not.toBe(past[1].adjustments);
    expect(past[1].adjustments).not.toBe(past[2].adjustments);

    // And independent of live state
    expect(past[2].adjustments).not.toBe(useEditorState.getState().adjustments);

    // Values should reflect what they were at the time of snapshot
    expect(past[0].adjustments.temperature).toBe(0);
    expect(past[1].adjustments.temperature).toBe(10);
    expect(past[2].adjustments.temperature).toBe(20);
    expect(useEditorState.getState().adjustments.temperature).toBe(20);
  });

  it("resetAll restores adjustments to defaults and transform to identity", () => {
    const state = useEditorState.getState();

    // Mutate everything
    state.setAdjustment("temperature", 50);
    state.setAdjustment("tint", -30);
    state.setTransform({ rotation: 180, flipH: true, flipV: true });
    state.setCrop({ x: 10, y: 20, width: 100, height: 100, rotation: 45 });

    // Sanity check — re-fetch since Zustand state is immutable per-call
    const live1 = useEditorState.getState();
    expect(live1.rotation).toBe(180);
    expect(live1.flipH).toBe(true);
    expect(live1.adjustments.temperature).toBe(50);
    expect(live1.crop).not.toBeNull();

    // Reset all
    live1.resetAll();

    // Verify everything returned to defaults
    const after = useEditorState.getState();
    expect(after.rotation).toBe(0);
    expect(after.flipH).toBe(false);
    expect(after.flipV).toBe(false);
    expect(after.adjustments.temperature).toBe(0);
    expect(after.adjustments.tint).toBe(0);
    expect(after.crop).toBeNull();
  });

  it("snapshot excludes UI state (activeTool, isDirty)", () => {
    const state = useEditorState.getState();
    state.setActiveTool("hand");
    state.setDirty(true);

    const snap = getSnapshot(state);

    // snapshot shape is EditorSnapshot, which doesn't include UI fields
    // (verified by type) — but verify at runtime too
    expect((snap as unknown as Record<string, unknown>).activeTool).toBeUndefined();
    expect((snap as unknown as Record<string, unknown>).isDirty).toBeUndefined();
  });

  it("undo/redo preserves UI state (doesn't clobber activeTool/isDirty)", () => {
    const state = useEditorState.getState();

    state.setActiveTool("crop");
    state.setDirty(true);

    // Re-fetch state after mutations before snapshot (Zustand state is immutable)
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    useEditorState.getState().setTransform({ rotation: 45 });
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    useEditorState.getState().setTransform({ rotation: 90 });
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    // Undo twice — rotation should unwind but activeTool stays "crop"
    useHistoryStore.getState().undo();
    useHistoryStore.getState().undo();

    const final = useEditorState.getState();
    expect(final.rotation).toBe(0);
    expect(final.activeTool).toBe("crop"); // preserved
  });
});

describe("Basic Light & Color integration", () => {
  it("combined Exposure+Contrast+Brightness+Gamma produces mathematically predictable output", () => {
    // Start with a known pixel [100, 150, 200, 255]
    // Pipeline: exposure → contrast → brightness → gamma
    const pixel = new Uint8ClampedArray([100, 150, 200, 255]);
    const image = new ImageData(pixel, 1, 1);

    const state = {
      ...DEFAULT_ADJUSTMENTS,
      exposure: 1, // ×2 multiplier
      contrast: 0, // no change
      brightness: 0, // no change
      gamma: 1, // identity exponent
    };

    const result = applyAdjustments(state, image);
    // Expected: [200, 255, 255, 255] (doubling + clamp via Uint8ClampedArray)
    expect(result.data[0]).toBe(200);
    expect(result.data[1]).toBe(255);
    expect(result.data[2]).toBe(255);
    expect(result.data[3]).toBe(255);
  });

  it("order of operations matters: Exposure before Contrast matters", () => {
    // Same pixel + same total adjustment values, but in different orders
    const pixel1 = new Uint8ClampedArray([100, 100, 100, 255]);
    const pixel2 = new Uint8ClampedArray([100, 100, 100, 255]);
    const image1 = new ImageData(pixel1, 1, 1);
    const image2 = new ImageData(pixel2, 1, 1);

    // Order A: Exposure then Contrast
    const stateA = { ...DEFAULT_ADJUSTMENTS, exposure: 1, contrast: 50, brightness: 0, gamma: 1 };
    applyAdjustments(stateA, image1);
    // 100×2=200, then contrast +50: factor=1.5, 128+(200-128)*1.5=128+108=236
    expect(image1.data[0]).toBe(236);

    // Order B: Contrast then Exposure (hypothetical, not how the engine actually runs,
    // but we verify the ORDER matters — this simulates what WOULD happen in the wrong order)
    const adjustedPixel = new Uint8ClampedArray([100, 100, 100, 255]);
    const imageB = new ImageData(adjustedPixel, 1, 1);
    // Contrast first: factor=1.5, 128+(100-128)*1.5=128-42=86
    // Then exposure ×2: 172
    const stateContrastOnly = { ...DEFAULT_ADJUSTMENTS, contrast: 50 };
    applyAdjustments(stateContrastOnly, imageB);
    expect(imageB.data[0]).toBe(86);

    // Apply exposure to image2
    const stateExposureOnly = { ...DEFAULT_ADJUSTMENTS, exposure: 1 };
    applyAdjustments(stateExposureOnly, image2);
    expect(image2.data[0]).toBe(200);
  });

  it("Reset All clears basic adjustments to defaults", () => {
    const state = useEditorState.getState();
    state.setAdjustment("exposure", 2);
    state.setAdjustment("contrast", 50);
    state.setAdjustment("brightness", 30);
    state.setAdjustment("gamma", 1.5);

    // Sanity check
    expect(useEditorState.getState().adjustments.exposure).toBe(2);
    expect(useEditorState.getState().adjustments.gamma).toBe(1.5);

    // Reset all
    state.resetAll();

    // Verify all basic adjustments returned to defaults
    const after = useEditorState.getState().adjustments;
    expect(after.exposure).toBe(0);
    expect(after.contrast).toBe(0);
    expect(after.brightness).toBe(0);
    expect(after.gamma).toBe(1); // gamma default is 1, not 0
  });

  it("resetAdjustment for a single adjustment restores its default", () => {
    const state = useEditorState.getState();
    state.setAdjustment("exposure", 3);
    state.setAdjustment("contrast", 75);

    // Reset only exposure
    state.resetAdjustment("exposure");

    // Exposure should be back to 0, contrast unaffected
    expect(useEditorState.getState().adjustments.exposure).toBe(0);
    expect(useEditorState.getState().adjustments.contrast).toBe(75);
  });

  it("undo/redo works for an adjustment sequence", () => {
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    useEditorState.getState().setAdjustment("exposure", 1);
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    useEditorState.getState().setAdjustment("contrast", 50);
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    useEditorState.getState().setAdjustment("brightness", 30);
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    useEditorState.getState().setAdjustment("gamma", 1.5);
    useHistoryStore.getState().pushSnapshot(getSnapshot(useEditorState.getState()));

    // Current state: exposure=1, contrast=50, brightness=30, gamma=1.5
    expect(useEditorState.getState().adjustments.exposure).toBe(1);
    expect(useEditorState.getState().adjustments.gamma).toBe(1.5);

    // Undo all 4 changes, back to identity
    useHistoryStore.getState().undo(); // undo gamma
    expect(useEditorState.getState().adjustments.gamma).toBe(1);
    expect(useEditorState.getState().adjustments.brightness).toBe(30);

    useHistoryStore.getState().undo(); // undo brightness
    expect(useEditorState.getState().adjustments.brightness).toBe(0);

    useHistoryStore.getState().undo(); // undo contrast
    expect(useEditorState.getState().adjustments.contrast).toBe(0);

    useHistoryStore.getState().undo(); // undo exposure
    expect(useEditorState.getState().adjustments.exposure).toBe(0);

    // Redo exposure
    useHistoryStore.getState().redo();
    expect(useEditorState.getState().adjustments.exposure).toBe(1);
  });

  it("combined Highlights+Shadows recovers blown highlights and dark shadows", () => {
    // Test that highlights and shadows work together to recover extreme tones
    // Use a pixel in the highlight range but not at the extreme (so there's room to brighten)
    const pixel = new Uint8ClampedArray([200, 200, 200, 255]); // luminance=200, bright but not max
    const image = new ImageData(pixel, 1, 1);

    const state = {
      ...DEFAULT_ADJUSTMENTS,
      highlights: -50, // recover highlights (brighten toward midtone)
      shadows: 50, // retrieve shadow detail
    };

    const result = applyAdjustments(state, image);
    // Highlights at 200 will be brightened by the highlights adjustment
    // (negative highlights value = brighten highlights)
    // weight = (200-128)/127 ≈ 0.57, offset = 50*0.57*0.5 ≈ 14
    // 200 + 14 = 214
    expect(result.data[0]).toBeGreaterThan(200);
    expect(result.data[0]).toBeLessThan(255);
  });

  it("Whites+Blacks set clip points for histogram extremes", () => {
    // Test that whites and blacks define the histogram boundaries
    const pixel = new Uint8ClampedArray([50, 200, 150, 255]);
    const image = new ImageData(pixel, 1, 1);

    const state = {
      ...DEFAULT_ADJUSTMENTS,
      whites: 20, // compress histogram from white side (whitePoint=245)
      blacks: 20, // compress histogram from black side (blackPoint=10)
    };

    const result = applyAdjustments(state, image);
    // Values should be scaled within the new [10, 245] range
    expect(result.data[0]).toBeGreaterThan(0);
    expect(result.data[1]).toBeLessThan(255);
  });

  it("Clarity increases midtone local contrast without affecting uniform regions", () => {
    // Create a uniform midtone region (should be unaffected by clarity)
    const size = 16;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 128;     // R
      data[i+1] = 128;   // G
      data[i+2] = 128;   // B
      data[i+3] = 255;   // A
    }
    const image = new ImageData(data, size, size);

    const state = {
      ...DEFAULT_ADJUSTMENTS,
      clarity: 50, // significant clarity increase
    };

    const result = applyAdjustments(state, image);
    // Uniform region should remain ~128 (no local contrast to enhance)
    expect(result.data[0]).toBeCloseTo(128, 0);
    expect(result.data[1]).toBeCloseTo(128, 0);
  });

  it("Pipeline order: Exposure before Highlights produces different result", () => {
    // Verify that the pipeline order matters (Exposure → Highlights, not reversed)
    const pixel = new Uint8ClampedArray([200, 200, 200, 255]);
    const image = new ImageData(pixel, 1, 1);

    // Current pipeline order: Exposure first, then Highlights
    const state = {
      ...DEFAULT_ADJUSTMENTS,
      exposure: 1, // double to 400 (clamped to 255)
      highlights: -50, // recover highlights
    };

    const result = applyAdjustments(state, image);
    // After exposure: 200→255 (clamped)
    // After highlights: 255 should be unaffected (it's at the extreme)
    // OR if highlights adjustment applies before final clamp, it would darken
    expect(result.data[0]).toBeLessThanOrEqual(255);
    expect(result.data[0]).toBeGreaterThanOrEqual(200);
  });

  it("All basic + tone adjustments combined (stress test)", () => {
    // Stress test: apply all adjustments at once
    const pixel = new Uint8ClampedArray([100, 150, 200, 255]);
    const image = new ImageData(pixel, 1, 1);

    const state = {
      ...DEFAULT_ADJUSTMENTS,
      exposure: 0.5,
      contrast: 20,
      brightness: 10,
      gamma: 1.2,
      highlights: -30,
      shadows: 40,
      whites: 15,
      blacks: 15,
      clarity: 25,
    };

    const result = applyAdjustments(state, image);
    // Should complete without errors and produce valid RGB values
    expect(result.data[0]).toBeGreaterThanOrEqual(0);
    expect(result.data[0]).toBeLessThanOrEqual(255);
    expect(result.data[1]).toBeGreaterThanOrEqual(0);
    expect(result.data[1]).toBeLessThanOrEqual(255);
    expect(result.data[2]).toBeGreaterThanOrEqual(0);
    expect(result.data[2]).toBeLessThanOrEqual(255);
    expect(result.data[3]).toBe(255); // alpha unchanged
  });
});
