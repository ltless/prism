"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

export function BasicLightSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Basic Light">
      <SliderRow
        label="Exposure"
        value={adjustments.exposure}
        min={-5}
        max={5}
        step={0.01}
        onChange={(v) => setScalar("exposure", v)}
        onReset={() => setScalar("exposure", 0)}
        unit=" stops"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Contrast"
        value={adjustments.contrast}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("contrast", v)}
        onReset={() => setScalar("contrast", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Brightness"
        value={adjustments.brightness}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("brightness", v)}
        onReset={() => setScalar("brightness", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Gamma"
        value={adjustments.gamma}
        min={0.1}
        max={3}
        step={0.01}
        onChange={(v) => setScalar("gamma", v)}
        onReset={() => setScalar("gamma", 1)}
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
