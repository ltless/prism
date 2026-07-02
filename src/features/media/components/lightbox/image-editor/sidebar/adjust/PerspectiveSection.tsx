"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

const DEFAULT_PERSP = { upright: "off" as const, vertical: 0, horizontal: 0, rotate: 0, aspect: 0, scale: 100 };

export function PerspectiveSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setMergeField, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Perspective">
      <SliderRow
        label="Vertical"
        value={adjustments.perspective?.vertical ?? 0}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setMergeField("perspective", { vertical: v }, DEFAULT_PERSP)}
        onReset={() => setMergeField("perspective", { vertical: 0 }, DEFAULT_PERSP)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Horizontal"
        value={adjustments.perspective?.horizontal ?? 0}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setMergeField("perspective", { horizontal: v }, DEFAULT_PERSP)}
        onReset={() => setMergeField("perspective", { horizontal: 0 }, DEFAULT_PERSP)}
        unit="%"
        onCommit={endDragSession}
      />
    </CollapsibleSection>
  );
}
