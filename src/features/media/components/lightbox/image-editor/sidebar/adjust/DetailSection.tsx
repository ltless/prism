"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

export function DetailSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Detail">
      <SliderRow
        label="Sharpening"
        value={adjustments.sharpening}
        min={0}
        max={200}
        step={1}
        onChange={(v) => setScalar("sharpening", v)}
        onReset={() => setScalar("sharpening", 0)}
        onCommit={endDragSession}
      />
      <SliderRow
        label="Radius"
        value={adjustments.sharpeningRadius}
        min={0.5}
        max={3}
        step={0.1}
        onChange={(v) => setScalar("sharpeningRadius", v)}
        onReset={() => setScalar("sharpeningRadius", 1)}
        unit="px"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Detail"
        value={adjustments.sharpeningDetail}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setScalar("sharpeningDetail", v)}
        onReset={() => setScalar("sharpeningDetail", 25)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Masking"
        value={adjustments.sharpeningMasking}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setScalar("sharpeningMasking", v)}
        onReset={() => setScalar("sharpeningMasking", 0)}
        unit="%"
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
