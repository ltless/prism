"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

const DEFAULT_SPLIT = { shadowsHue: 0, shadowsSaturation: 0, highlightsHue: 0, highlightsSaturation: 0, balance: 0 };

export function SplitToningSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setMergeField, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Split Toning">
      <SliderRow
        label="Shadows Hue"
        value={adjustments.splitToning?.shadowsHue ?? 0}
        min={0}
        max={360}
        step={1}
        onChange={(v) => setMergeField("splitToning", { shadowsHue: v }, DEFAULT_SPLIT)}
        onReset={() => setMergeField("splitToning", { shadowsHue: 0 }, DEFAULT_SPLIT)}
        unit="°"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Shadows Sat"
        value={adjustments.splitToning?.shadowsSaturation ?? 0}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setMergeField("splitToning", { shadowsSaturation: v }, DEFAULT_SPLIT)}
        onReset={() => setMergeField("splitToning", { shadowsSaturation: 0 }, DEFAULT_SPLIT)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Highlights Hue"
        value={adjustments.splitToning?.highlightsHue ?? 0}
        min={0}
        max={360}
        step={1}
        onChange={(v) => setMergeField("splitToning", { highlightsHue: v }, DEFAULT_SPLIT)}
        onReset={() => setMergeField("splitToning", { highlightsHue: 0 }, DEFAULT_SPLIT)}
        unit="°"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Highlights Sat"
        value={adjustments.splitToning?.highlightsSaturation ?? 0}
        min={0}
        max={100}
        step={1}
        onChange={(v) => setMergeField("splitToning", { highlightsSaturation: v }, DEFAULT_SPLIT)}
        onReset={() => setMergeField("splitToning", { highlightsSaturation: 0 }, DEFAULT_SPLIT)}
        unit="%"
        onCommit={endDragSession}
      />
      <SliderRow
        label="Balance"
        value={adjustments.splitToning?.balance ?? 0}
        min={-100}
        max={100}
        step={1}
        onChange={(v) => setMergeField("splitToning", { balance: v }, DEFAULT_SPLIT)}
        onReset={() => setMergeField("splitToning", { balance: 0 }, DEFAULT_SPLIT)}
        unit="%"
        onCommit={endDragSession}
      />
      {(adjustments.splitToning?.shadowsHue !== 0 ||
        adjustments.splitToning?.shadowsSaturation !== 0 ||
        adjustments.splitToning?.highlightsHue !== 0 ||
        adjustments.splitToning?.highlightsSaturation !== 0 ||
        adjustments.splitToning?.balance !== 0) && (
        <button
          type="button"
          onClick={() => {
            setMergeField(
              "splitToning",
              { shadowsHue: 0, shadowsSaturation: 0, highlightsHue: 0, highlightsSaturation: 0, balance: 0 },
              DEFAULT_SPLIT
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
