"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

const DEFAULT_LEVELS = { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 };

export function LevelsSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setMergeField, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Levels">
      <SliderRow
        label="Input Black"
        value={adjustments.levels?.inBlack ?? 0}
        min={0}
        max={254}
        step={1}
        onChange={(v) => setMergeField("levels", { inBlack: v }, DEFAULT_LEVELS)}
        onReset={() => setMergeField("levels", { inBlack: 0 }, DEFAULT_LEVELS)}
        onCommit={endDragSession}
      />
      <SliderRow
        label="Input White"
        value={adjustments.levels?.inWhite ?? 255}
        min={1}
        max={255}
        step={1}
        onChange={(v) => setMergeField("levels", { inWhite: v }, DEFAULT_LEVELS)}
        onReset={() => setMergeField("levels", { inWhite: 255 }, DEFAULT_LEVELS)}
        onCommit={endDragSession}
      />
      <SliderRow
        label="Gamma"
        value={adjustments.levels?.gamma ?? 1}
        min={0.1}
        max={9.99}
        step={0.01}
        onChange={(v) => setMergeField("levels", { gamma: v }, DEFAULT_LEVELS)}
        onReset={() => setMergeField("levels", { gamma: 1 }, DEFAULT_LEVELS)}
        onCommit={endDragSession}
      />
      <SliderRow
        label="Output Black"
        value={adjustments.levels?.outBlack ?? 0}
        min={0}
        max={254}
        step={1}
        onChange={(v) => setMergeField("levels", { outBlack: v }, DEFAULT_LEVELS)}
        onReset={() => setMergeField("levels", { outBlack: 0 }, DEFAULT_LEVELS)}
        onCommit={endDragSession}
      />
      <SliderRow
        label="Output White"
        value={adjustments.levels?.outWhite ?? 255}
        min={1}
        max={255}
        step={1}
        onChange={(v) => setMergeField("levels", { outWhite: v }, DEFAULT_LEVELS)}
        onReset={() => setMergeField("levels", { outWhite: 255 }, DEFAULT_LEVELS)}
        onCommit={endDragSession}
      />
      {(adjustments.levels?.inBlack !== 0 ||
        adjustments.levels?.inWhite !== 255 ||
        adjustments.levels?.gamma !== 1 ||
        adjustments.levels?.outBlack !== 0 ||
        adjustments.levels?.outWhite !== 255) && (
        <button
          type="button"
          onClick={() => {
            setMergeField(
              "levels",
              { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 },
              DEFAULT_LEVELS
            );
            endDragSession();
          }}
          className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
        >
          Reset
        </button>
      )}
    </CollapsibleSection>
  );
}
