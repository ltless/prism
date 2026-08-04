"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

export function EffectsSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Effects">
      <SliderRow
        label="Vignette"
        value={adjustments.vignette}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("vignette", v)}
        onReset={() => setScalar("vignette", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Grain"
        value={adjustments.grain}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setScalar("grain", v)}
        onReset={() => setScalar("grain", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Texture"
        value={adjustments.texture}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("texture", v)}
        onReset={() => setScalar("texture", 0)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Dehaze"
        value={adjustments.dehaze}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setScalar("dehaze", v)}
        onReset={() => setScalar("dehaze", 0)}
        unit="%"
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
