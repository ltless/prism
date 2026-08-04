"use client";

import { useRef, useCallback } from "react";
import { m } from "motion/react";
import { Ruler } from "../Ruler";
import { CanvasRenderer, type CanvasRendererHandle } from "../image-editor/canvas/CanvasRenderer";
import { DEFAULT_ADJUSTMENTS, useEditorState } from "../image-editor/state/editorState";

type Adjustments = ReturnType<typeof useEditorState.getState>["adjustments"];

interface EditorCanvasAreaProps {
  view: { rulers: boolean; grid: boolean; before: boolean };
  activeTool: string;
  interaction: { panning: boolean; dragging: boolean };
  zoom: number;
  pan: { x: number; y: number };
  rotation: number;
  flip: { h: boolean; v: boolean };
  mediaUrl: string;
  adjustments: Adjustments;
  maxPreviewSize: number;
  canvasRef: React.RefObject<CanvasRendererHandle | null>;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
}

export function EditorCanvasArea({
  view, activeTool, interaction, zoom, pan, rotation, flip, mediaUrl, adjustments, maxPreviewSize,
  canvasRef, canvasContainerRef, onMouseDown, onMouseMove, onMouseUp,
}: EditorCanvasAreaProps) {
  const imageTransform = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg) ${flip.h ? "scaleX(-1)" : ""} ${flip.v ? "scaleY(-1)" : ""}`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Ruler orientation="horizontal" visible={view.rulers} />
      <div className="flex-1 flex overflow-hidden">
        <Ruler orientation="vertical" visible={view.rulers} />
        <div
          ref={canvasContainerRef}
          role="button"
          tabIndex={0}
          className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden relative"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{
            cursor:
              activeTool === "eyedropper"
                ? "crosshair"
                : activeTool === "hand"
                  ? "grab"
                  : activeTool === "select"
                    ? "move"
                    : interaction.panning
                      ? "grabbing"
                      : "default",
          }}
        >
          {view.grid && (
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
              transition: interaction.panning
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
              willChange: interaction.panning ? "transform" : "auto",
            }}
          >
            <CanvasRenderer
              ref={canvasRef}
              mediaUrl={mediaUrl}
              adjustments={view.before ? DEFAULT_ADJUSTMENTS : adjustments}
              isDragging={interaction.dragging}
              maxPreviewSize={maxPreviewSize}
            />
            {view.before && (
              <div className="absolute top-3 left-3 z-20 px-2 py-0.5 bg-surface-bg/80 border border-main-border rounded text-xs font-semibold tracking-wide text-muted-text pointer-events-none">
                BEFORE
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
