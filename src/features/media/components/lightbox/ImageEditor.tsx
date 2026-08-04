"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MediaItem } from "../../types";
import { EditorTopBar } from "./EditorTopBar";
import { EditorToolbar } from "./EditorToolbar";
import { EditorSidebar } from "./EditorSidebar";
import { LibraryPicker } from "./LibraryPicker";
import { EditorCanvasArea } from "./image-editor/EditorCanvasArea";
import {
  CanvasRenderer,
  type CanvasRendererHandle,
} from "./image-editor/canvas/CanvasRenderer";
import { useEditorState } from "./image-editor/state/editorState";
import {
  useHistoryStore,
  initHistoryBaseline,
} from "./image-editor/state/history";
import {
  useEditorActions,
  useDraggingStore,
  resetEditorActions,
} from "./image-editor/hooks/useEditorActions";
import { useColorSetters } from "./image-editor/hooks/useColorSetters";
import { useEditorSave } from "./image-editor/hooks/useEditorSave";
import { useEditorShortcuts } from "./image-editor/hooks/useEditorShortcuts";
import { useEditorCanvas } from "./image-editor/hooks/useEditorCanvas";
import { parseImageDimensions } from "./image-editor/utils/parseImageDimensions";
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
  const { commitEdit } = useEditorActions();
  const {
    setInvert,
    setDuotoneColorA, setDuotoneColorB,
    setTritoneColorA, setTritoneColorB, setTritoneColorC,
    setQuadtoneColorA, setQuadtoneColorB, setQuadtoneColorC, setQuadtoneColorD,
  } = useColorSetters();
  const { saveLoading, isSaving, handleSave } = useEditorSave(currentItem, onSuccess);

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

  const {
    zoom, pan, isPanning, canvasContainerRef, canvasContainerSize,
    setZoom, setPan, setIsPanning, panStart,
    handleMouseDown: handleCanvasMouseDown,
    handleMouseMove: handleCanvasMouseMove, handleMouseUp: handleCanvasMouseUp,
  } = useEditorCanvas();

  const [brushColor, setBrushColor] = useState("#F59E0B");
  const [brushSize, setBrushSize] = useState(10);

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

  useEditorShortcuts({
    onToggleRulers: () => setShowRulers(prev => !prev),
    onToggleSidebar: () => setShowSidebar(prev => !prev),
    onToggleGrid: () => setShowGrid(prev => !prev),
    onToggleBefore: () => setShowBefore(prev => !prev),
  });

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
        handleCanvasMouseDown(e);
      }
    },
    [activeTool, handleCanvasMouseDown]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleCanvasMouseMove(e);
    },
    [handleCanvasMouseMove]
  );

  const handleMouseUp = useCallback(() => {
    handleCanvasMouseUp();
  }, [handleCanvasMouseUp]);

  const imgDimensions = parseImageDimensions(currentItem);

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
        <EditorCanvasArea
          view={{ rulers: showRulers, grid: showGrid, before: showBefore }}
          activeTool={activeTool}
          interaction={{ panning: isPanning, dragging: isDragging }}
          zoom={zoom}
          pan={pan}
          rotation={rotation}
          flip={{ h: flipH, v: flipV }}
          mediaUrl={mediaUrl}
          adjustments={adjustments}
          maxPreviewSize={maxPreviewSize}
          canvasRef={canvasRef}
          canvasContainerRef={canvasContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />

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
