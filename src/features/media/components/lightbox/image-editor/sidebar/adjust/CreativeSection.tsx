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

function ToneColorPicker({
  label,
  colors,
  onChange,
  onReset,
}: {
  label: string;
  colors: { key: string; title: string; swatch: string; def: string }[];
  onChange: (key: string, v: string) => void;
  onReset: () => void;
}) {
  const isDirty = colors.some((c) => c.swatch !== c.def);
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] text-main-text/80 block">{label}</span>
      <div className="flex items-center gap-2">
        {colors.map((c) => (
          <input
            key={c.key}
            type="color"
            value={c.swatch}
            onChange={(e) => onChange(c.key, e.target.value)}
            className="w-6 h-6 rounded-md border border-main-border cursor-pointer"
            title={c.title}
          />
        ))}
        {isDirty && (
          <button type="button" onClick={onReset} className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer">
            Reset
          </button>
        )}
      </div>
    </div>
  );
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

      <ToneColorPicker
        label="Duotone"
        colors={[
          { key: "colorA", swatch: adjustments.duotone?.colorA ?? "#000", def: "#000", title: "Shadow color" },
          { key: "colorB", swatch: adjustments.duotone?.colorB ?? "#ffffff", def: "#ffffff", title: "Highlight color" },
        ]}
        onChange={(k, v) => k === "colorA" ? onDuotoneColorAChange(v) : onDuotoneColorBChange(v)}
        onReset={() => { onDuotoneColorAChange("#000"); onDuotoneColorBChange("#ffffff"); }}
      />
      <ToneColorPicker
        label="Tritone"
        colors={[
          { key: "colorA", swatch: adjustments.tritone?.colorA ?? "#000", def: "#000", title: "Shadow" },
          { key: "colorB", swatch: adjustments.tritone?.colorB ?? "#808080", def: "#808080", title: "Midtone" },
          { key: "colorC", swatch: adjustments.tritone?.colorC ?? "#ffffff", def: "#ffffff", title: "Highlight" },
        ]}
        onChange={(k, v) => k === "colorA" ? onTritoneColorAChange(v) : k === "colorB" ? onTritoneColorBChange(v) : onTritoneColorCChange(v)}
        onReset={() => { onTritoneColorAChange("#000"); onTritoneColorBChange("#808080"); onTritoneColorCChange("#ffffff"); }}
      />
      <ToneColorPicker
        label="Quadtone"
        colors={[
          { key: "colorA", swatch: adjustments.quadtone?.colorA ?? "#000", def: "#000", title: "0%" },
          { key: "colorB", swatch: adjustments.quadtone?.colorB ?? "#404040", def: "#404040", title: "33%" },
          { key: "colorC", swatch: adjustments.quadtone?.colorC ?? "#bfbfbf", def: "#bfbfbf", title: "67%" },
          { key: "colorD", swatch: adjustments.quadtone?.colorD ?? "#ffffff", def: "#ffffff", title: "100%" },
        ]}
        onChange={(k, v) => k === "colorA" ? onQuadtoneColorAChange(v) : k === "colorB" ? onQuadtoneColorBChange(v) : k === "colorC" ? onQuadtoneColorCChange(v) : onQuadtoneColorDChange(v)}
        onReset={() => { onQuadtoneColorAChange("#000"); onQuadtoneColorBChange("#404040"); onQuadtoneColorCChange("#bfbfbf"); onQuadtoneColorDChange("#ffffff"); }}
      />
    </CollapsibleSection>
  );
}
