"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MediaItem } from "../../types";
import { EditorTopBar } from "./EditorTopBar";
import { EditorToolbar } from "./EditorToolbar";
import { EditorSidebar } from "./EditorSidebar";
import { LibraryPicker } from "./LibraryPicker";
import { EditorCanvasArea } from "./image-editor/EditorCanvasArea";
import type { CanvasRendererHandle } from "./image-editor/canvas/CanvasRenderer";
import { useEditorState } from "./image-editor/state/editorState";
import {
  initHistoryBaseline,
} from "./image-editor/state/history";
import {
  useDraggingStore,
  resetEditorActions,
} from "./image-editor/hooks/useEditorActions";
import { useColorSetters } from "./image-editor/hooks/useColorSetters";
import { useEditorSave } from "./image-editor/hooks/useEditorSave";
import { useEditorShortcuts } from "./image-editor/hooks/useEditorShortcuts";
import { useEditorCanvas } from "./image-editor/hooks/useEditorCanvas";
import { useImageEditorUi } from "./image-editor/hooks/useImageEditorUi";
import { parseImageDimensions } from "./image-editor/utils/parseImageDimensions";

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
  const canvasRef = useRef<CanvasRendererHandle>(null);
  const [brushColor, setBrushColor] = useState("#F59E0B");

  const {
    isLibraryOpen, setIsLibraryOpen,
    showRulers, setShowRulers,
    showGrid, setShowGrid,
    showSidebar, setShowSidebar,
    showBefore, setShowBefore,
    sampledColor, setSampledColor,
    activeTool, setActiveTool,
    handleRotationChange, handleFlipH, handleFlipV,
    commitResetAll, handleAutoAdjustStub, handleSampledMouseDown,
  } = useImageEditorUi({
    canvasRef,
    onSampleColor: setBrushColor,
  });

  const [prevImageId, setPrevImageId] = useState(currentItem.id);
  // Reset ephemeral editor state when the edited image changes — set-state-during-render
  // (React-endorsed) instead of a set-state-in-effect.
  if (currentItem.id !== prevImageId) {
    setPrevImageId(currentItem.id);
    setSampledColor(null);
    setShowBefore(false);
  }

  const isDragging = useDraggingStore((s) => s.isDragging);
  const {
    setInvert,
    setDuotoneColorA, setDuotoneColorB,
    setTritoneColorA, setTritoneColorB, setTritoneColorC,
    setQuadtoneColorA, setQuadtoneColorB, setQuadtoneColorC, setQuadtoneColorD,
  } = useColorSetters();
  const { saveLoading, isSaving, handleSave } = useEditorSave(currentItem, onSuccess);

  const maxPreviewSize = isDragging ? DRAG_PREVIEW_SIZE : FULL_PREVIEW_SIZE;

  const rotation = useEditorState((s) => s.rotation);
  const flipH = useEditorState((s) => s.flipH);
  const flipV = useEditorState((s) => s.flipV);
  const setImageId = useEditorState((s) => s.setImageId);
  const adjustments = useEditorState((s) => s.adjustments);

  const {
    zoom, pan, isPanning, canvasContainerRef, canvasContainerSize,
    setZoom,
    handleMouseDown: handleCanvasMouseDown,
    handleMouseMove: handleCanvasMouseMove, handleMouseUp: handleCanvasMouseUp,
  } = useEditorCanvas();

  const [brushSize, setBrushSize] = useState(10);

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
      if (handleSampledMouseDown(e)) return;
      if (activeTool === "hand" || activeTool === "select" || e.button === 1) {
        handleCanvasMouseDown(e);
      }
    },
    [activeTool, handleCanvasMouseDown, handleSampledMouseDown]
  );

  const imgDimensions = parseImageDimensions(currentItem);

  return (
    <div
      className="flex flex-col w-full h-full bg-[#070708]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Top bar */}
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
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
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
