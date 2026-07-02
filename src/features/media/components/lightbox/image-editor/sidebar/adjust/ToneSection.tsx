"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

export function ToneSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Tone">
      <SliderRow
        label="Highlights"
        value={adjustments.highlights}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("highlights", v)}
        onReset={() => setScalar("highlights", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Shadows"
        value={adjustments.shadows}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("shadows", v)}
        onReset={() => setScalar("shadows", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Whites"
        value={adjustments.whites}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("whites", v)}
        onReset={() => setScalar("whites", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Blacks"
        value={adjustments.blacks}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("blacks", v)}
        onReset={() => setScalar("blacks", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Clarity"
        value={adjustments.clarity}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("clarity", v)}
        onReset={() => setScalar("clarity", 0)}
        unit="%"
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
