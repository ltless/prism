"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MediaItem } from "../../types";
import { EditorTopBar } from "./EditorTopBar";
import { EditorToolbar } from "./EditorToolbar";
import { EditorSidebar } from "./EditorSidebar";
import { Ruler } from "./Ruler";
import { LibraryPicker } from "./LibraryPicker";
import {
  CanvasRenderer,
  type CanvasRendererHandle,
} from "./image-editor/canvas/CanvasRenderer";
import { useEditorState, DEFAULT_ADJUSTMENTS } from "./image-editor/state/editorState";
import { saveEditorState } from "./image-editor/save";
import {
  useHistoryStore,
  initHistoryBaseline,
  getSnapshot,
} from "./image-editor/state/history";
import {
  useEditorActions,
  useDraggingStore,
  resetEditorActions,
} from "./image-editor/hooks/useEditorActions";
import { toast } from "sonner";

interface ImageEditorProps {
  item: MediaItem;
  onClose: () => void;
  /** Called after successful save (e.g., to refresh dashboard grid) */
  onSuccess?: () => void;
}

// Preview canvas resolution on the longest edge. During slider drags the
// canvas drops to a coarse proxy (9× fewer pixels → ~9× less CPU/RAM) and
// snaps back to full quality on release. Mirrors the Lightroom 1:4 proxy trick.
const FULL_PREVIEW_SIZE = 1920;
const DRAG_PREVIEW_SIZE = 640;

export function ImageEditor({ item: initialItem, onClose, onSuccess }: ImageEditorProps) {
  const [currentItem, setCurrentItem] = useState(initialItem);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showBefore, setShowBefore] = useState(false);
  const [sampledColor, setSampledColor] = useState<{
    r: number;
    g: number;
    b: number;
    a: number;
  } | null>(null);

  const [prevImageId, setPrevImageId] = useState(currentItem.id);
  // Reset ephemeral editor state when the edited image changes — set-state-during-render
  // (React-endorsed) instead of a set-state-in-effect.
  if (currentItem.id !== prevImageId) {
    setPrevImageId(currentItem.id);
    setSampledColor(null);
    setShowBefore(false);
  }

  const isDragging = useDraggingStore((s) => s.isDragging);
  const { commitEdit, rawSetAdjustment, setColorField } = useEditorActions();

  const maxPreviewSize = isDragging ? DRAG_PREVIEW_SIZE : FULL_PREVIEW_SIZE;

  const activeTool = useEditorState((s) => s.activeTool);
  const setActiveTool = useEditorState((s) => s.setActiveTool);
  const rotation = useEditorState((s) => s.rotation);
  const flipH = useEditorState((s) => s.flipH);
  const flipV = useEditorState((s) => s.flipV);
  const setTransform = useEditorState((s) => s.setTransform);
  const resetAll = useEditorState((s) => s.resetAll);
  const setImageId = useEditorState((s) => s.setImageId);
  const adjustments = useEditorState((s) => s.adjustments);

  const canvasRef = useRef<CanvasRendererHandle>(null);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [canvasContainerSize, setCanvasContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setCanvasContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [brushColor, setBrushColor] = useState("#F59E0B");
  const [brushSize, setBrushSize] = useState(10);

  // Color setters: drag via setColorField (throttled 30fps + 640px proxy +
  // one history snapshot per drag). setInvert stays commitEdit (click).
  const setInvert = (v: boolean) => commitEdit(() => rawSetAdjustment("invert", v));
  const setDuotoneColorA = (v: string) => {
    const d = useEditorState.getState().adjustments.duotone;
    setColorField("duotone", { colorA: v, colorB: d?.colorB ?? '#ffffff' });
  };
  const setDuotoneColorB = (v: string) => {
    const d = useEditorState.getState().adjustments.duotone;
    setColorField("duotone", { colorA: d?.colorA ?? '#000000', colorB: v });
  };
  const setTritoneColorA = (v: string) => {
    const d = useEditorState.getState().adjustments.tritone;
    setColorField("tritone", { colorA: v, colorB: d?.colorB ?? '#808080', colorC: d?.colorC ?? '#ffffff' });
  };
  const setTritoneColorB = (v: string) => {
    const d = useEditorState.getState().adjustments.tritone;
    setColorField("tritone", { colorA: d?.colorA ?? '#000000', colorB: v, colorC: d?.colorC ?? '#ffffff' });
  };
  const setTritoneColorC = (v: string) => {
    const d = useEditorState.getState().adjustments.tritone;
    setColorField("tritone", { colorA: d?.colorA ?? '#000000', colorB: d?.colorB ?? '#808080', colorC: v });
  };
  const setQuadtoneColorA = (v: string) => {
    const d = useEditorState.getState().adjustments.quadtone;
    setColorField("quadtone", { colorA: v, colorB: d?.colorB ?? '#404040', colorC: d?.colorC ?? '#bfbfbf', colorD: d?.colorD ?? '#ffffff' });
  };
  const setQuadtoneColorB = (v: string) => {
    const d = useEditorState.getState().adjustments.quadtone;
    setColorField("quadtone", { colorA: d?.colorA ?? '#000000', colorB: v, colorC: d?.colorC ?? '#bfbfbf', colorD: d?.colorD ?? '#ffffff' });
  };
  const setQuadtoneColorC = (v: string) => {
    const d = useEditorState.getState().adjustments.quadtone;
    setColorField("quadtone", { colorA: d?.colorA ?? '#000000', colorB: d?.colorB ?? '#404040', colorC: v, colorD: d?.colorD ?? '#ffffff' });
  };
  const setQuadtoneColorD = (v: string) => {
    const d = useEditorState.getState().adjustments.quadtone;
    setColorField("quadtone", { colorA: d?.colorA ?? '#000000', colorB: d?.colorB ?? '#404040', colorC: d?.colorC ?? '#bfbfbf', colorD: v });
  };

  // Transform commits
  const handleRotationChange = useCallback(
    (value: number) => commitEdit(() => setTransform({ rotation: value })),
    [commitEdit, setTransform]
  );

  const handleFlipH = useCallback(
    () =>
      commitEdit(() =>
        setTransform({ flipH: !useEditorState.getState().flipH })
      ),
    [commitEdit, setTransform]
  );

  const handleFlipV = useCallback(
    () =>
      commitEdit(() =>
        setTransform({ flipV: !useEditorState.getState().flipV })
      ),
    [commitEdit, setTransform]
  );

  const commitResetAll = useCallback(() => {
    commitEdit(() => resetAll());
  }, [commitEdit, resetAll]);

  const handleAutoAdjustStub = useCallback(
    (name: "Auto Tone" | "Auto Contrast" | "Auto Color") => {
      toast(`${name} coming soon — not wired up yet`, {
        description: "Tweak the sliders by hand for now. Auto-detection is on the maybe-someday list.",
        duration: 2000,
      });
    },
    []
  );

  const mediaUrl = `/api/v1/media/files/${currentItem.filePath}`;

  useEffect(() => {
    setImageId(currentItem.id);
    initHistoryBaseline();
    resetEditorActions();
  }, [currentItem.id, setImageId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const snap = getSnapshot(useEditorState.getState());
        useHistoryStore.getState().pushSnapshot(snap);
        useHistoryStore.getState().undo();
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      if (mod && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setShowRulers((prev) => !prev);
        return;
      }

      if (e.key === "F7") {
        e.preventDefault();
        setShowSidebar((prev) => !prev);
        return;
      }

      if (e.key === "'") {
        e.preventDefault();
        setShowGrid((prev) => !prev);
        return;
      }

      if (e.key === "\\") {
        e.preventDefault();
        setShowBefore((prev) => !prev);
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [saveLoading, setSaveLoading] = useState<"overwrite" | "copy" | null>(null);
  const isSaving = saveLoading !== null;

  const handleSave = useCallback(
    async (overwrite: boolean) => {
      if (isSaving) return;
      setSaveLoading(overwrite ? "overwrite" : "copy");
      try {
        const state = useEditorState.getState();
        const result = await saveEditorState(state, currentItem, { overwrite });
        if (result.success) {
          toast.success(overwrite ? "Image overwritten" : "Saved as copy", {
            duration: 1500,
          });
          onSuccess?.();
        } else {
          toast.error(result.error || "Save failed");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Unexpected save error"
        );
      } finally {
        setSaveLoading(null);
      }
    },
    [currentItem, onSuccess, isSaving]
  );

  const zoomRef = useRef(zoom);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  const handleWheel = useCallback((e: WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const container = canvasContainerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;

      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const prevZoom = zoomRef.current;
      const nextZoom = Math.min(10, Math.max(0.1, prevZoom + delta));
      const ratio = nextZoom / prevZoom;

      setZoom(nextZoom);
      setPan((prevPan) => ({
        x: cx - ratio * (cx - prevPan.x),
        y: cy - ratio * (cy - prevPan.y),
      }));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (activeTool === "eyedropper") {
        const color = canvasRef.current?.sampleColor(e.clientX, e.clientY);
        if (color) {
          const hex = `#${color.r.toString(16).padStart(2, "0")}${color.g.toString(16).padStart(2, "0")}${color.b.toString(16).padStart(2, "0")}`;
          setSampledColor(color);
          setBrushColor(hex);
          toast(`Sampled ${hex}`, {
            description: `R${color.r} G${color.g} B${color.b}`,
            duration: 1500,
          });
        }
        return;
      }

      if (activeTool === "hand" || activeTool === "select" || e.button === 1) {
        setIsPanning(true);
        panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      }
    },
    [activeTool, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanning) {
        setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
      }
      // Cursor X/Y lives in an isolated listener in EditorSidebar
      // (CursorPosInfo), so mousemove never re-renders this component.
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const imgDimensions = { width: 0, height: 0 };
  if (currentItem.metadata) {
    try {
      const meta =
        typeof currentItem.metadata === "string"
          ? JSON.parse(currentItem.metadata)
          : currentItem.metadata;
      imgDimensions.width = meta.width || 0;
      imgDimensions.height = meta.height || 0;
    } catch {
      // metadata parse failed; ignore
    }
  }

  const imageTransform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg) ${flipH ? "scaleX(-1)" : ""} ${flipV ? "scaleY(-1)" : ""}`;

  return (
    <div
      className="flex flex-col w-full h-full bg-app-bg"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top bar */}
      <div className="flex shrink-0 border-b border-main-border">
        <div className="w-10 shrink-0 border-r border-main-border" />
        <div className="flex-1">
          <EditorTopBar
            onClose={onClose}
            onOpenLibrary={() => setIsLibraryOpen(true)}
            showRulers={showRulers}
            onToggleRulers={() => setShowRulers((prev) => !prev)}
            onSaveCopy={() => handleSave(false)}
            onOverwrite={() => handleSave(true)}
            onResetAll={commitResetAll}
            onAutoTone={() => handleAutoAdjustStub("Auto Tone")}
            onAutoContrast={() => handleAutoAdjustStub("Auto Contrast")}
            onAutoColor={() => handleAutoAdjustStub("Auto Color")}
            isSaving={isSaving}
            savingMode={saveLoading}
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left toolbar */}
        <EditorToolbar
          activeTool={activeTool}
          onToolChange={(tool) => {
            setActiveTool(tool);
            if (tool !== "eyedropper") setSampledColor(null);
          }}
          showBefore={showBefore}
          onToggleBeforeAfter={() => setShowBefore((prev) => !prev)}
        />

        {/* Canvas area with rulers */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Ruler orientation="horizontal" visible={showRulers} />
          <div className="flex-1 flex overflow-hidden">
            <Ruler orientation="vertical" visible={showRulers} />
            <div
              ref={canvasContainerRef}
              className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              style={{
                cursor:
                  activeTool === "eyedropper"
                    ? "crosshair"
                    : activeTool === "hand"
                      ? "grab"
                      : activeTool === "select"
                        ? "move"
                        : isPanning
                          ? "grabbing"
                          : "default",
              }}
            >
              {showGrid && (
                <div
                  className="absolute inset-0 pointer-events-none z-10"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(128,128,128,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.2) 1px, transparent 1px)",
                    backgroundSize: "50px 50px",
                  }}
                />
              )}
              <div
                style={{
                  transform: imageTransform,
                  transition: isPanning
                    ? "none"
                    : "transform 0.1s ease-out",
                  borderRadius: "0.75rem",
                  overflow: "hidden",
                  maxWidth: "100%",
                  maxHeight: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  willChange: isPanning ? "transform" : "auto",
                }}
              >
                <CanvasRenderer
                  ref={canvasRef}
                  mediaUrl={mediaUrl}
                  adjustments={showBefore ? DEFAULT_ADJUSTMENTS : adjustments}
                  isDragging={isDragging}
                  maxPreviewSize={maxPreviewSize}
                />
                {showBefore && (
                  <div className="absolute top-3 left-3 z-20 px-2 py-0.5 bg-surface-bg/80 border border-main-border rounded text-xs font-semibold tracking-wide text-muted-text pointer-events-none">
                    BEFORE
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <EditorSidebar
          isOpen={showSidebar}
          onToggle={() => setShowSidebar((prev) => !prev)}
          activeTool={activeTool}
          zoom={zoom}
          onZoomChange={setZoom}
          brushColor={brushColor}
          onBrushColorChange={setBrushColor}
          brushSize={brushSize}
          onBrushSizeChange={setBrushSize}
          canvasContainerRef={canvasContainerRef}
          pan={pan}
          canvasContainerSize={canvasContainerSize}
          imageWidth={imgDimensions.width}
          imageHeight={imgDimensions.height}
          mimeType={currentItem.mimeType || ""}
          rotation={rotation}
          onRotationChange={handleRotationChange}
          flipH={flipH}
          flipV={flipV}
          onFlipH={handleFlipH}
          onFlipV={handleFlipV}
          mediaUrl={mediaUrl}
          sampledColor={sampledColor}
          onInvertChange={setInvert}
          onDuotoneColorAChange={setDuotoneColorA}
          onDuotoneColorBChange={setDuotoneColorB}
          onTritoneColorAChange={setTritoneColorA}
          onTritoneColorBChange={setTritoneColorB}
          onTritoneColorCChange={setTritoneColorC}
          onQuadtoneColorAChange={setQuadtoneColorA}
          onQuadtoneColorBChange={setQuadtoneColorB}
          onQuadtoneColorCChange={setQuadtoneColorC}
          onQuadtoneColorDChange={setQuadtoneColorD}
        />
      </div>

      {isLibraryOpen && (
        <LibraryPicker
          onSelect={(item) => {
            setCurrentItem(item);
            setIsLibraryOpen(false);
          }}
          onClose={() => setIsLibraryOpen(false)}
        />
      )}
    </div>
  );
}
