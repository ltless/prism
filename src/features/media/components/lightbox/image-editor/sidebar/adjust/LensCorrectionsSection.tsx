"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

const DEFAULT_LENS = { distortion: 0, vignetting: 0, chromaticAberrationRedCyan: 0, chromaticAberrationBlueYellow: 0, defringe: 0 };

export function LensCorrectionsSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setMergeField, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Lens Corrections">
      <SliderRow
        label="Distortion"
        value={adjustments.lensCorrections?.distortion ?? 0}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setMergeField("lensCorrections", { distortion: v }, DEFAULT_LENS)}
        onReset={() => setMergeField("lensCorrections", { distortion: 0 }, DEFAULT_LENS)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Vignetting"
        value={adjustments.lensCorrections?.vignetting ?? 0}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setMergeField("lensCorrections", { vignetting: v }, DEFAULT_LENS)}
        onReset={() => setMergeField("lensCorrections", { vignetting: 0 }, DEFAULT_LENS)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="CA Red/Cyan"
        value={adjustments.lensCorrections?.chromaticAberrationRedCyan ?? 0}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setMergeField("lensCorrections", { chromaticAberrationRedCyan: v }, DEFAULT_LENS)}
        onReset={() => setMergeField("lensCorrections", { chromaticAberrationRedCyan: 0 }, DEFAULT_LENS)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="CA Blue/Yellow"
        value={adjustments.lensCorrections?.chromaticAberrationBlueYellow ?? 0}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setMergeField("lensCorrections", { chromaticAberrationBlueYellow: v }, DEFAULT_LENS)}
        onReset={() => setMergeField("lensCorrections", { chromaticAberrationBlueYellow: 0 }, DEFAULT_LENS)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Defringe"
        value={adjustments.lensCorrections?.defringe ?? 0}
        min={0}
        max={20}
        step={1}
        onChange={(v) => setMergeField("lensCorrections", { defringe: v }, DEFAULT_LENS)}
        onReset={() => setMergeField("lensCorrections", { defringe: 0 }, DEFAULT_LENS)}
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
