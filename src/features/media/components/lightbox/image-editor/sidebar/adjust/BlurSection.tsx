"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

const DEFAULT_MOTION = { angle: 0, distance: 0 };

export function BlurSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, setMergeField, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Blur">
      <SliderRow
        label="Gaussian Blur"
        value={adjustments.gaussianBlur}
        min={0}
        max={250}
        step={1}
        onChange={(v) => setScalar("gaussianBlur", v)}
        onReset={() => setScalar("gaussianBlur", 0)}
        unit="px"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Median Filter"
        value={adjustments.medianFilter}
        min={0}
        max={10}
        step={1}
        onChange={(v) => setScalar("medianFilter", v)}
        onReset={() => setScalar("medianFilter", 0)}
        unit="px"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Motion Blur Angle"
        value={adjustments.motionBlur?.angle ?? 0}
        min={-360}
        max={360}
        step={1}
        onChange={(v) => setMergeField("motionBlur", { angle: v }, DEFAULT_MOTION)}
        onReset={() => setMergeField("motionBlur", { angle: 0 }, DEFAULT_MOTION)}
        unit="°"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Motion Blur Distance"
        value={adjustments.motionBlur?.distance ?? 0}
        min={0}
        max={250}
        step={1}
        onChange={(v) => setMergeField("motionBlur", { distance: v }, DEFAULT_MOTION)}
        onReset={() => setMergeField("motionBlur", { distance: 0 }, DEFAULT_MOTION)}
        unit="px"
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
