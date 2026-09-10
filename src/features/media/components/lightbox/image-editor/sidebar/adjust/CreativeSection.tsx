"use client";

import { SliderRow } from "../SliderRow";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

interface CreativeSectionProps {
  onInvertChange: (v: boolean) => void;
  onDuotoneColorAChange: (v: string) => void;
  onDuotoneColorBChange: (v: string) => void;
  onTritoneColorAChange: (v: string) => void;
  onTritoneColorBChange: (v: string) => void;
  onTritoneColorCChange: (v: string) => void;
  onQuadtoneColorAChange: (v: string) => void;
  onQuadtoneColorBChange: (v: string) => void;
  onQuadtoneColorCChange: (v: string) => void;
  onQuadtoneColorDChange: (v: string) => void;
}

export function CreativeSection({
  onInvertChange,
  onDuotoneColorAChange,
  onDuotoneColorBChange,
  onTritoneColorAChange,
  onTritoneColorBChange,
  onTritoneColorCChange,
  onQuadtoneColorAChange,
  onQuadtoneColorBChange,
  onQuadtoneColorCChange,
  onQuadtoneColorDChange,
}: CreativeSectionProps) {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, endDragSession } = useEditorActions();
  return (
    <CollapsibleSection label="Creative">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-main-text/80">Invert</span>
        <button
          type="button"
          onClick={() => onInvertChange(!adjustments.invert)}
          className={`px-3 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
            adjustments.invert
              ? "border-primary bg-primary/10 text-primary"
              : "border-main-border/60 bg-surface-bg/40 text-muted-text hover:text-main-text"
          }`}
        >
          {adjustments.invert ? "ON" : "OFF"}
        </button>
      </div>
      <SliderRow
        label="Solarize"
        value={adjustments.solarize}
        min={0}
        max={255}
        step={1}
        onChange={(v) => setScalar("solarize", v)}
        onReset={() => setScalar("solarize", 0)}
        onCommit={endDragSession}
      />
      <SliderRow
        label="Posterize"
        value={adjustments.posterize}
        min={0}
        max={255}
        step={1}
        onChange={(v) => setScalar("posterize", v)}
        onReset={() => setScalar("posterize", 0)}
        onCommit={endDragSession}
      />
      <SliderRow
        label="Threshold"
        value={adjustments.threshold}
        min={0}
        max={255}
        step={1}
        onChange={(v) => setScalar("threshold", v)}
        onReset={() => setScalar("threshold", 0)}
        onCommit={endDragSession}
      />

      <div className="space-y-1.5">
        <span className="text-[11px] text-main-text/80 block">Duotone</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={adjustments.duotone?.colorA ?? "#000"}
            onChange={(e) => onDuotoneColorAChange(e.target.value)}
            className="w-8 h-8 rounded-md border border-main-border cursor-pointer"
            title="Shadow color"
          />
          <input
            type="color"
            value={adjustments.duotone?.colorB ?? "#ffffff"}
            onChange={(e) => onDuotoneColorBChange(e.target.value)}
            className="w-8 h-8 rounded-md border border-main-border cursor-pointer"
            title="Highlight color"
          />
          {(adjustments.duotone?.colorA !== "#000" || adjustments.duotone?.colorB !== "#ffffff") && (
            <button
              type="button"
              onClick={() => {
                onDuotoneColorAChange("#000");
                onDuotoneColorBChange("#ffffff");
              }}
              className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] text-main-text/80 block">Tritone</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={adjustments.tritone?.colorA ?? "#000"}
            onChange={(e) => onTritoneColorAChange(e.target.value)}
            className="w-7 h-7 rounded-md border border-main-border cursor-pointer"
            title="Shadow"
          />
          <input
            type="color"
            value={adjustments.tritone?.colorB ?? "#808080"}
            onChange={(e) => onTritoneColorBChange(e.target.value)}
            className="w-7 h-7 rounded-md border border-main-border cursor-pointer"
            title="Midtone"
          />
          <input
            type="color"
            value={adjustments.tritone?.colorC ?? "#ffffff"}
            onChange={(e) => onTritoneColorCChange(e.target.value)}
            className="w-7 h-7 rounded-md border border-main-border cursor-pointer"
            title="Highlight"
          />
          {(adjustments.tritone?.colorA !== "#000" ||
            adjustments.tritone?.colorB !== "#808080" ||
            adjustments.tritone?.colorC !== "#ffffff") && (
            <button
              type="button"
              onClick={() => {
                onTritoneColorAChange("#000");
                onTritoneColorBChange("#808080");
                onTritoneColorCChange("#ffffff");
              }}
              className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] text-main-text/80 block">Quadtone</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={adjustments.quadtone?.colorA ?? "#000"}
            onChange={(e) => onQuadtoneColorAChange(e.target.value)}
            className="w-6 h-6 rounded-md border border-main-border cursor-pointer"
            title="0%"
          />
          <input
            type="color"
            value={adjustments.quadtone?.colorB ?? "#404040"}
            onChange={(e) => onQuadtoneColorBChange(e.target.value)}
            className="w-6 h-6 rounded-md border border-main-border cursor-pointer"
            title="33%"
          />
          <input
            type="color"
            value={adjustments.quadtone?.colorC ?? "#bfbfbf"}
            onChange={(e) => onQuadtoneColorCChange(e.target.value)}
            className="w-6 h-6 rounded-md border border-main-border cursor-pointer"
            title="67%"
          />
          <input
            type="color"
            value={adjustments.quadtone?.colorD ?? "#ffffff"}
            onChange={(e) => onQuadtoneColorDChange(e.target.value)}
            className="w-6 h-6 rounded-md border border-main-border cursor-pointer"
            title="100%"
          />
          {(adjustments.quadtone?.colorA !== "#000" ||
            adjustments.quadtone?.colorB !== "#404040" ||
            adjustments.quadtone?.colorC !== "#bfbfbf" ||
            adjustments.quadtone?.colorD !== "#ffffff") && (
            <button
              type="button"
              onClick={() => {
                onQuadtoneColorAChange("#000");
                onQuadtoneColorBChange("#404040");
                onQuadtoneColorCChange("#bfbfbf");
                onQuadtoneColorDChange("#ffffff");
              }}
              className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </CollapsibleSection>
  );
}
