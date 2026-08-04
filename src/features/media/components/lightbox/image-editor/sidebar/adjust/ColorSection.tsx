"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

export function ColorSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Color">
      <SliderRow
        label="Hue"
        value={adjustments.hue}
        min={-180}
        max={180}
        step={1}
        onChange={(v) => setScalar("hue", v)}
        onReset={() => setScalar("hue", 0)}
        unit="°"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Saturation"
        value={adjustments.saturation}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("saturation", v)}
        onReset={() => setScalar("saturation", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Vibrance"
        value={adjustments.vibrance}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("vibrance", v)}
        onReset={() => setScalar("vibrance", 0)}
        unit="%"
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
