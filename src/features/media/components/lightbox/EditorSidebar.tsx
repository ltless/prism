"use client";

import { useState, useEffect, useRef } from "react";
import type { EditorTool } from "./image-editor/state/editorState";
import { SliderRow } from "./image-editor/sidebar/SliderRow";
import { Histogram } from "./image-editor/sidebar/Histogram";
import { MiniPreview } from "./image-editor/sidebar/MiniPreview";
import { AdjustPanel } from "./image-editor/sidebar/AdjustPanel";
import {
  Palette,
  Info,
  ArrowsOut,
  Clock,
  X,
  FlipHorizontal,
  FlipVertical,
  Compass,
  Swatches,
  Plus,
  Trash,
  ChartBar,
  SlidersHorizontal,
  Lock,
  LockOpen,
} from "@phosphor-icons/react";

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

const panelItems: {
  id: PanelId;
  icon: typeof Palette;
  label: string;
}[] = [
  { id: "navigator", icon: Compass, label: "Navigator" },
  { id: "adjust", icon: SlidersHorizontal, label: "Adjust" },
  { id: "color", icon: Palette, label: "Color" },
  { id: "swatches", icon: Swatches, label: "Swatches" },
  { id: "histogram", icon: ChartBar, label: "Histogram" },
  { id: "transform", icon: ArrowsOut, label: "Transform" },
  { id: "info", icon: Info, label: "Info" },
  { id: "history", icon: Clock, label: "History" },
];

// ---------------------------------------------------------------------------
// Shared UI primitives
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



function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-[11px]">
      <span className="text-muted-text">{label}</span>
      <span className="font-mono text-main-text">{value}</span>
    </div>
  );
}

/**
 * Cursor X/Y display, driven by its own mousemove listener on the canvas
 * container + rAF-coalesced local state. Isolated so that mouse movement over
 * the canvas never re-renders ImageEditor or the rest of the sidebar — only
 * these two InfoRows update. Previously cursorPos lived in ImageEditor state,
 * which re-rendered the entire editor tree (CanvasRenderer, AdjustPanel, 47
 * SliderRows) on every pointermove (~100% CPU while the mouse was over the
 * canvas).
 */
function CursorPosInfo({
  containerRef,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      pendingRef.current = {
        x: Math.round(e.clientX - rect.left),
        y: Math.round(e.clientY - rect.top),
      };
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingRef.current) setPos(pendingRef.current);
      });
    };
    el.addEventListener("mousemove", onMove);
    return () => {
      el.removeEventListener("mousemove", onMove);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [containerRef]);

  return (
    <>
      <InfoRow label="Cursor X" value={String(pos.x)} />
      <InfoRow label="Cursor Y" value={String(pos.y)} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Color palette (shared between Color + Swatches panels)
// ---------------------------------------------------------------------------

const presetColors = [
  { name: "Black", hex: "#000000" },
  { name: "White", hex: "#FFFFFF" },
  { name: "Red", hex: "#EF4444" },
  { name: "Orange", hex: "#F97316" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Green", hex: "#22C55E" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Amber", hex: "#F59E0B" },
];

// ---------------------------------------------------------------------------
// Swatches localStorage
// ---------------------------------------------------------------------------

const STORAGE_KEY = "prism-editor-swatches:v1";
const ORDER_KEY = "prism-editor-panel-order:v1";
const LOCK_KEY = "prism-editor-panel-locked:v1";

function loadSwatches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSwatches(colors: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
}

function formatSize(w: number, h: number) {
  return !w || !h ? "—" : `${w} × ${h}`;
}

function formatMimeType(m: string) {
  if (!m) return "—";
  if (m.includes("jpeg") || m.includes("jpg")) return "JPEG";
  if (m.includes("png")) return "PNG";
  if (m.includes("webp")) return "WebP";
  if (m.includes("gif")) return "GIF";
  return m.split("/")[1]?.toUpperCase() || m;
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

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
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const hexInput = hexDraft ?? brushColor;
  const [swatches, setSwatches] = useState<string[]>(loadSwatches);

  useEffect(() => {
    saveSwatches(swatches);
  }, [swatches]);

  const panelItemMap = new Map(panelItems.map((item) => [item.id, item]));

  const [panelOrder, setPanelOrder] = useState<PanelId[]>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(ORDER_KEY);
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          return parsed.filter((id): id is PanelId => panelItemMap.has(id as PanelId));
        }
      }
    } catch { /* ignore corrupt storage */ }
    return panelItems.map((item) => item.id);
  });

  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLocked(localStorage.getItem(LOCK_KEY) === "true");
  }, []);

  useEffect(() => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(panelOrder));
  }, [panelOrder]);

  const toggleLock = () => {
    const next = !isLocked;
    setIsLocked(next);
    localStorage.setItem(LOCK_KEY, String(next));
  };

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isLocked) return;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (isLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetIndex(index);
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (isLocked) return;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDropTargetIndex(null);
      return;
    }
    const newOrder = [...panelOrder];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    setPanelOrder(newOrder);
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTargetIndex(null);
  };

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

  const handleHexChange = (val: string) => {
    setHexDraft(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) onBrushColorChange(val);
  };

  const addSwatch = () => {
    if (!swatches.includes(brushColor)) {
      setSwatches((prev) => [...prev, brushColor]);
    }
  };

  const removeSwatch = (color: string) => {
    setSwatches((prev) => prev.filter((c) => c !== color));
  };

  return (
    <div className="flex shrink-0 border-l border-main-border">
      {/* Panels */}
      {isOpen && openPanels.size > 0 && (
        <div className="w-64 flex flex-col gap-0 border-r border-main-border bg-app-bg overflow-y-auto custom-scroll">
          {/* Navigator Panel */}
          {openPanels.has("navigator") && (
            <div className="border-b border-main-border">
              <PanelHeader
                icon={Compass}
                label="Navigator"
                onClose={() => togglePanel("navigator")}
              />
              <div className="px-3 pb-3 pt-2 space-y-3">
                <MiniPreview
                  mediaUrl={mediaUrl}
                  pan={pan}
                  canvasContainerSize={canvasContainerSize}
                  imageWidth={imageWidth}
                  imageHeight={imageHeight}
                  zoom={zoom}
                />
                <SliderRow
                  label="Zoom"
                  value={Math.round(zoom * 100)}
                  min={10}
                  max={1000}
                  step={10}
                  onChange={(v) => onZoomChange(v / 100)}
                  unit="%"
                />
              </div>
            </div>
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
            <div className="border-b border-main-border">
              <PanelHeader
                icon={Palette}
                label="Color"
                onClose={() => togglePanel("color")}
              />
              <div className="px-3 pb-3 pt-2 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative w-10 h-10 shrink-0">
                    <div className="absolute inset-0 rounded-md border border-main-border bg-white" />
                    <div
                      className="absolute inset-1 rounded border border-main-border/60"
                      style={{ backgroundColor: brushColor }}
                    />
                  </div>
                  <div className="flex-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-text/70 font-semibold block mb-1">
                      Hex
                    </span>
                    <input
                      type="text"
                      value={hexInput}
                      onChange={(e) => handleHexChange(e.target.value)}
                      className="w-full bg-surface-bg border border-main-border rounded px-2 py-1 text-[11px] font-mono text-main-text outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {presetColors.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => {
                        onBrushColorChange(c.hex);
                        setHexDraft(c.hex);
                      }}
                      title={c.name}
                      style={{ backgroundColor: c.hex }}
                      className={`w-full aspect-square rounded border cursor-pointer transition-all ${
                        brushColor === c.hex
                          ? "border-primary ring-1 ring-primary/40 scale-110"
                          : "border-main-border hover:scale-105"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brushColor}
                    onChange={(e) => {
                      onBrushColorChange(e.target.value);
                      setHexDraft(e.target.value);
                    }}
                    className="w-7 h-7 rounded border border-main-border cursor-pointer"
                  />
                  <span className="text-xs text-muted-text uppercase tracking-wider font-semibold">
                    Custom color
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Swatches Panel */}
          {openPanels.has("swatches") && (
            <div className="border-b border-main-border">
              <PanelHeader
                icon={Swatches}
                label="Swatches"
                onClose={() => togglePanel("swatches")}
              />
              <div className="px-3 pb-3 pt-2 space-y-3">
                {swatches.length === 0 ? (
                  <p className="text-xs text-muted-text/70 text-center py-2">
                    No swatches saved yet
                  </p>
                ) : (
                  <div className="grid grid-cols-5 gap-1.5">
                    {swatches.map((color) => (
                      <div key={color} className="relative group">
                        <button
                          type="button"
                          onClick={() => {
                            onBrushColorChange(color);
                            setHexDraft(color);
                          }}
                          style={{ backgroundColor: color }}
                          className={`w-full aspect-square rounded border cursor-pointer transition-all ${
                            brushColor === color
                              ? "border-primary ring-1 ring-primary/40 scale-110"
                              : "border-main-border hover:scale-105"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => removeSwatch(color)}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                        >
                          <Trash size={8} weight="bold" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={addSwatch}
                  className="w-full py-1.5 border border-dashed border-main-border text-[11px] text-muted-text hover:text-main-text hover:border-primary rounded cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus size={12} weight="light" />
                  Add Current Color
                </button>
              </div>
            </div>
          )}

          {/* Histogram Panel */}
          {openPanels.has("histogram") && (
            <div className="border-b border-main-border">
              <PanelHeader
                icon={ChartBar}
                label="Histogram"
                onClose={() => togglePanel("histogram")}
              />
              <div className="px-3 pb-3 pt-2">
                <Histogram mediaUrl={mediaUrl} />
                <p className="text-[11px] text-muted-text/70 mt-2 uppercase tracking-wider">
                  RGB channel distribution
                </p>
              </div>
            </div>
          )}

          {/* Transform Panel */}
          {openPanels.has("transform") && (
            <div className="border-b border-main-border">
              <PanelHeader
                icon={ArrowsOut}
                label="Transform"
                onClose={() => togglePanel("transform")}
              />
              <div className="px-3 pb-3 pt-2 space-y-3">
                <SubHeader label="Dimensions" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-text/70 font-semibold">
                      Width
                    </span>
                    <input
                      type="number"
                      value={imageWidth}
                      readOnly
                      className="w-full bg-surface-bg border border-main-border rounded px-2 py-1 text-[11px] font-mono text-main-text outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wider text-muted-text/70 font-semibold">
                      Height
                    </span>
                    <input
                      type="number"
                      value={imageHeight}
                      readOnly
                      className="w-full bg-surface-bg border border-main-border rounded px-2 py-1 text-[11px] font-mono text-main-text outline-none"
                    />
                  </div>
                </div>

                <SubHeader label="Rotation" />
                <SliderRow
                  label="Angle"
                  value={rotation}
                  min={0}
                  max={360}
                  step={1}
                  onChange={(v) => onRotationChange(v)}
                  onReset={() => onRotationChange(0)}
                  unit="°"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onRotationChange((rotation - 90 + 360) % 360)
                    }
                    className="px-2 py-1.5 border border-main-border/60 bg-surface-bg/40 hover:bg-surface-bg rounded text-[11px] cursor-pointer text-muted-text hover:text-main-text transition-colors"
                  >
                    ↺ 90° CCW
                  </button>
                  <button
                    type="button"
                    onClick={() => onRotationChange((rotation + 90) % 360)}
                    className="px-2 py-1.5 border border-main-border/60 bg-surface-bg/40 hover:bg-surface-bg rounded text-[11px] cursor-pointer text-muted-text hover:text-main-text transition-colors"
                  >
                    ↻ 90° CW
                  </button>
                </div>

                <SubHeader label="Mirror" />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={onFlipH}
                    className={`py-1.5 border rounded text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      flipH
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-main-border/60 bg-surface-bg/40 text-muted-text hover:text-main-text hover:bg-surface-bg"
                    }`}
                  >
                    <FlipHorizontal size={14} weight="light" /> Horizontal
                  </button>
                  <button
                    type="button"
                    onClick={onFlipV}
                    className={`py-1.5 border rounded text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                      flipV
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-main-border/60 bg-surface-bg/40 text-muted-text hover:text-main-text hover:bg-surface-bg"
                    }`}
                  >
                    <FlipVertical size={14} weight="light" /> Vertical
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Info Panel */}
          {openPanels.has("info") && (
            <div className="border-b border-main-border">
              <PanelHeader
                icon={Info}
                label="Info"
                onClose={() => togglePanel("info")}
              />
              <div className="px-3 pb-3 pt-2 space-y-2">
                <InfoRow
                  label="Dimensions"
                  value={formatSize(imageWidth, imageHeight)}
                />
                <InfoRow label="Format" value={formatMimeType(mimeType)} />
                <div className="h-px bg-main-border/50 my-1" />
                <CursorPosInfo containerRef={canvasContainerRef} />
                <InfoRow label="Zoom" value={`${Math.round(zoom * 100)}%`} />
                {sampledColor && (
                  <>
                    <div className="h-px bg-main-border/50 my-1" />
                    <div className="flex items-center gap-2">
                      <div
                        className="w-5 h-5 rounded border border-main-border shrink-0"
                        style={{
                          backgroundColor: `rgb(${sampledColor.r},${sampledColor.g},${sampledColor.b})`,
                        }}
                      />
                      <div className="flex-1 space-y-0.5">
                        <InfoRow
                          label="Hex"
                          value={`#${sampledColor.r.toString(16).padStart(2, "0")}${sampledColor.g.toString(16).padStart(2, "0")}${sampledColor.b.toString(16).padStart(2, "0")}`}
                        />
                        <div className="text-xs text-muted-text font-mono">
                          R{sampledColor.r} G{sampledColor.g} B{sampledColor.b}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* History Panel */}
          {openPanels.has("history") && (
            <div className="border-b border-main-border">
              <PanelHeader
                icon={Clock}
                label="History"
                onClose={() => togglePanel("history")}
              />
              <div className="px-3 pb-3 pt-2 space-y-1">
                <p className="text-xs italic text-muted-text/60 text-center py-2">
                  Undo/redo history will appear here once you make edits.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rail */}
      <div className="w-10 shrink-0 flex flex-col items-center py-2 gap-0.5 bg-app-bg">
        {/* Lock toggle */}
        <button
          type="button"
          onClick={toggleLock}
          title={isLocked ? "Unlock panel order" : "Lock panel order"}
          className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer ${
            isLocked
              ? "text-primary bg-primary/10"
              : "text-muted-text hover:text-main-text hover:bg-surface-bg"
          }`}
        >
          {isLocked ? <Lock size={14} weight="bold" /> : <LockOpen size={14} weight="light" />}
        </button>
        <div className="w-6 h-px bg-main-border/30 my-0.5" />

        {panelOrder.map((id, index) => {
          const item = panelItemMap.get(id);
          if (!item) return null;
          const Icon = item.icon;
          const isActive = openPanels.has(item.id) && isOpen;
          const isDropTarget = dropTargetIndex === index;
          const isDragging = dragIndex === index;
          return (
            <button
              key={item.id}
              type="button"
              draggable={!isLocked}
              onClick={() => togglePanel(item.id)}
              title={item.label}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`w-8 h-8 flex items-center justify-center rounded transition-all cursor-pointer ${
                isActive
                  ? "text-primary bg-primary/10"
                  : isDragging
                    ? "opacity-30 text-muted-text"
                    : "text-muted-text hover:text-main-text hover:bg-surface-bg"
              } ${isDropTarget ? "ring-1 ring-primary" : ""}`}
            >
              <Icon size={16} weight="light" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
