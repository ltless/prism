"use client";

import { useState } from "react";
import type { EditorTool } from "./image-editor/state/editorState";
import { AdjustPanel } from "./image-editor/sidebar/AdjustPanel";
import { ColorPanel } from "./image-editor/sidebar/ColorPanel";
import { SwatchesPanel } from "./image-editor/sidebar/SwatchesPanel";
import { TransformPanel } from "./image-editor/sidebar/TransformPanel";
import { InfoPanel } from "./image-editor/sidebar/InfoPanel";
import { CursorPosInfo } from "./image-editor/sidebar/CursorPosInfo";
import { NavigatorPanel } from "./image-editor/sidebar/NavigatorPanel";
import { SidebarRail } from "./image-editor/sidebar/SidebarRail";
import { HistogramPanel } from "./image-editor/sidebar/HistogramPanel";
import { HistoryPanel } from "./image-editor/sidebar/HistoryPanel";
import { useSwatches } from "./image-editor/hooks/useSwatches";
import { Palette, X } from "@phosphor-icons/react";

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

// ---------------------------------------------------------------------------
// Shared UI primitives (exported for extracted panels)
// ---------------------------------------------------------------------------

export function PanelHeader({
  icon: Icon,
  label,
  onClose,
}: {
  icon: typeof Palette;
  label: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 border-b border-main-border/60 bg-surface-bg/40">
      <div className="flex items-center gap-2">
        <Icon size={14} weight="regular" className="text-primary" />
        <span className="text-[11px] font-semibold tracking-wide text-main-text">
          {label}
        </span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="text-muted-text hover:text-main-text transition-colors cursor-pointer p-0.5 -mr-0.5"
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
      <span className="text-[11px] font-bold uppercase tracking-widest text-muted-text/70">
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
  const [openPanels, setOpenPanels] = useState<Set<PanelId>>(new Set());
  const { swatches, addSwatch, removeSwatch } = useSwatches(brushColor);

  const togglePanel = (id: PanelId) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    if (!isOpen) onToggle();
  };

  return (
    <div className="flex shrink-0 border-l border-main-border">
      {/* Panels */}
      {isOpen && openPanels.size > 0 && (
        <div className="w-64 flex flex-col gap-0 border-r border-main-border bg-app-bg overflow-y-auto custom-scroll">
          {/* Navigator Panel */}
          {openPanels.has("navigator") && (
            <NavigatorPanel
              mediaUrl={mediaUrl}
              pan={pan}
              canvasContainerSize={canvasContainerSize}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              zoom={zoom}
              onZoomChange={onZoomChange}
              onClose={() => togglePanel("navigator")}
            />
          )}

          {/* ADJUST panel */}
          {openPanels.has("adjust") && (
            <AdjustPanel
              onClose={() => togglePanel("adjust")}
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
          {openPanels.has("color") && (
            <ColorPanel
              brushColor={brushColor}
              onBrushColorChange={onBrushColorChange}
              onClose={() => togglePanel("color")}
            />
          )}

          {/* Swatches Panel */}
          {openPanels.has("swatches") && (
            <SwatchesPanel
              brushColor={brushColor}
              onBrushColorChange={onBrushColorChange}
              swatches={swatches}
              onAddSwatch={addSwatch}
              onRemoveSwatch={removeSwatch}
              onClose={() => togglePanel("swatches")}
            />
          )}

          {/* Histogram Panel */}
          {openPanels.has("histogram") && (
            <HistogramPanel
              mediaUrl={mediaUrl}
              onClose={() => togglePanel("histogram")}
            />
          )}

          {/* Transform Panel */}
          {openPanels.has("transform") && (
            <TransformPanel
              rotation={rotation}
              flipH={flipH}
              flipV={flipV}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              onRotationChange={onRotationChange}
              onFlipH={onFlipH}
              onFlipV={onFlipV}
              onClose={() => togglePanel("transform")}
            />
          )}

          {/* Info Panel */}
          {openPanels.has("info") && (
            <InfoPanel
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              mimeType={mimeType}
              zoom={zoom}
              sampledColor={sampledColor}
              canvasContainerRef={canvasContainerRef}
              onClose={() => togglePanel("info")}
            />
          )}

          {/* History Panel */}
          {openPanels.has("history") && (
            <HistoryPanel onClose={() => togglePanel("history")} />
          )}
        </div>
      )}

      {/* Rail */}
      <SidebarRail openPanels={openPanels} isOpen={isOpen} onTogglePanel={togglePanel} />
    </div>
  );
}
