"use client";

import { useState } from "react";
import { Compass, SlidersHorizontal, Palette, Swatches, ChartBar, ArrowsOut, Info, Clock, X } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { EditorTool } from "./image-editor/state/editorState";
import { AdjustPanel } from "./image-editor/sidebar/AdjustPanel";
import { ColorPanel } from "./image-editor/sidebar/ColorPanel";
import { SwatchesPanel } from "./image-editor/sidebar/SwatchesPanel";
import { TransformPanel } from "./image-editor/sidebar/TransformPanel";
import { InfoPanel } from "./image-editor/sidebar/InfoPanel";
import { CursorPosInfo } from "./image-editor/sidebar/CursorPosInfo";
import { NavigatorPanel } from "./image-editor/sidebar/NavigatorPanel";
import { HistogramPanel } from "./image-editor/sidebar/HistogramPanel";
import { HistoryPanel } from "./image-editor/sidebar/HistoryPanel";
import { useSwatches } from "./image-editor/hooks/useSwatches";

interface EditorSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTool: EditorTool;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  pan: { x: number; y: number };
  canvasContainerSize: { width: number; height: number };
  imageWidth: number;
  imageHeight: number;
  mimeType: string;
  rotation: number;
  onRotationChange: (v: number) => void;
  flipH: boolean;
  flipV: boolean;
  onFlipH: () => void;
  onFlipV: () => void;
  mediaUrl: string;
  sampledColor?: { r: number; g: number; b: number; a: number } | null;
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

type PanelId =
  | "navigator"
  | "adjust"
  | "color"
  | "swatches"
  | "histogram"
  | "info"
  | "transform"
  | "history";

const tabs: { id: PanelId; icon: typeof Palette; label: string }[] = [
  { id: "adjust", icon: SlidersHorizontal, label: "Adjust" },
  { id: "transform", icon: ArrowsOut, label: "Transform" },
  { id: "color", icon: Palette, label: "Color" },
  { id: "swatches", icon: Swatches, label: "Swatches" },
  { id: "histogram", icon: ChartBar, label: "Histogram" },
  { id: "navigator", icon: Compass, label: "Navigator" },
  { id: "info", icon: Info, label: "Info" },
  { id: "history", icon: Clock, label: "History" },
];

// ---------------------------------------------------------------------------
// Shared UI primitives (exported for extracted panels)
// ---------------------------------------------------------------------------

export function PanelHeader({
  icon: _icon,
  label,
  onClose,
}: {
  icon: typeof Palette;
  label: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between h-11 px-3.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/50">{label}</span>
      <button
        type="button"
        onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 hover:text-white hover:bg-white/10 cursor-pointer"
        aria-label={`Close ${label}`}
      >
        <X size={12} weight="bold" />
      </button>
    </div>
  );
}

export function SubHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[11px] font-medium text-muted-text">
        {label}
      </span>
      <div className="flex-1 h-px bg-main-border/50" />
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-text">{label}</span>
      <span className="font-mono text-main-text">{value}</span>
    </div>
  );
}

export { CursorPosInfo };

// ---------------------------------------------------------------------------

export function EditorSidebar({
  isOpen,
  onToggle,
  activeTool: _activeTool,
  zoom,
  onZoomChange,
  brushColor,
  onBrushColorChange,
  brushSize: _brushSize,
  onBrushSizeChange: _onBrushSizeChange,
  canvasContainerRef,
  pan,
  canvasContainerSize,
  imageWidth,
  imageHeight,
  mimeType,
  rotation,
  onRotationChange,
  flipH,
  flipV,
  onFlipH,
  onFlipV,
  mediaUrl,
  sampledColor,
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
}: EditorSidebarProps) {
  const [active, setActive] = useState<PanelId>("adjust");
  const { swatches, addSwatch, removeSwatch } = useSwatches(brushColor);

  const select = (id: PanelId) => {
    setActive(id);
    if (!isOpen) onToggle();
  };

  return (
    <div className="flex shrink-0 py-3 pr-3">
      {isOpen && (
        <div className="lb-editor-sheet w-72 mr-2 flex flex-col overflow-y-auto custom-scroll rounded-[1.4rem] bg-[#101012] text-white ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] [--text-main:#f4f4f5] [--text-muted:rgba(255,255,255,0.48)] [--border-soft:rgba(255,255,255,0.1)] [--border-medium:rgba(255,255,255,0.16)] [--bg-surface:rgba(255,255,255,0.06)] [--bg-panel:#141416] [--accent-rgb:255_255_255] [--text-on-primary:#0c0c0e]">
          {active === "navigator" && (
            <NavigatorPanel
              mediaUrl={mediaUrl}
              pan={pan}
              canvasContainerSize={canvasContainerSize}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              zoom={zoom}
              onZoomChange={onZoomChange}
              onClose={() => onToggle()}
            />
          )}

          {/* ADJUST panel */}
          {active === "adjust" && (
            <AdjustPanel
              onClose={() => onToggle()}
              onInvertChange={onInvertChange}
              onDuotoneColorAChange={onDuotoneColorAChange}
              onDuotoneColorBChange={onDuotoneColorBChange}
              onTritoneColorAChange={onTritoneColorAChange}
              onTritoneColorBChange={onTritoneColorBChange}
              onTritoneColorCChange={onTritoneColorCChange}
              onQuadtoneColorAChange={onQuadtoneColorAChange}
              onQuadtoneColorBChange={onQuadtoneColorBChange}
              onQuadtoneColorCChange={onQuadtoneColorCChange}
              onQuadtoneColorDChange={onQuadtoneColorDChange}
            />
          )}

          {/* Color Panel */}
          {active === "color" && (
            <ColorPanel
              brushColor={brushColor}
              onBrushColorChange={onBrushColorChange}
              onClose={() => onToggle()}
            />
          )}

          {/* Swatches Panel */}
          {active === "swatches" && (
            <SwatchesPanel
              brushColor={brushColor}
              onBrushColorChange={onBrushColorChange}
              swatches={swatches}
              onAddSwatch={addSwatch}
              onRemoveSwatch={removeSwatch}
              onClose={() => onToggle()}
            />
          )}

          {/* Histogram Panel */}
          {active === "histogram" && (
            <HistogramPanel
              mediaUrl={mediaUrl}
              onClose={() => onToggle()}
            />
          )}

          {/* Transform Panel */}
          {active === "transform" && (
            <TransformPanel
              rotation={rotation}
              flipH={flipH}
              flipV={flipV}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              onRotationChange={onRotationChange}
              onFlipH={onFlipH}
              onFlipV={onFlipV}
              onClose={() => onToggle()}
            />
          )}

          {/* Info Panel */}
          {active === "info" && (
            <InfoPanel
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              mimeType={mimeType}
              zoom={zoom}
              sampledColor={sampledColor}
              canvasContainerRef={canvasContainerRef}
              onClose={() => onToggle()}
            />
          )}

          {/* History Panel */}
          {active === "history" && (
            <HistoryPanel onClose={() => onToggle()} />
          )}
        </div>
      )}

      <div className="w-12 shrink-0 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-0.5 rounded-full bg-[#0c0c0e] p-1.5 ring-1 ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const on = isOpen && active === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => select(tab.id)}
              title={tab.label}
              aria-pressed={on}
              className={cn(
                "w-9 h-9 flex items-center justify-center rounded-full cursor-pointer active:scale-[0.96] transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                on ? "bg-white text-[#0c0c0e]" : "text-white/60 hover:text-white hover:bg-white/10"
              )}
            >
              <Icon size={16} weight={on ? "fill" : "light"} />
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
