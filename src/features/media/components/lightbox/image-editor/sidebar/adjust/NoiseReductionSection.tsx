"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

export function NoiseReductionSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Noise Reduction">
      <SliderRow
        label="Luminance"
        value={adjustments.noiseReduction}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setScalar("noiseReduction", v)}
        onReset={() => setScalar("noiseReduction", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Detail"
        value={adjustments.noiseReductionDetail}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setScalar("noiseReductionDetail", v)}
        onReset={() => setScalar("noiseReductionDetail", 25)}
        unit="%"
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
