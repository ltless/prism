"use client";

import { Ruler } from "../Ruler";
import { CanvasRenderer, type CanvasRendererHandle } from "../image-editor/canvas/CanvasRenderer";
import { DEFAULT_ADJUSTMENTS, useEditorState } from "../image-editor/state/editorState";

type Adjustments = ReturnType<typeof useEditorState.getState>["adjustments"];

function canvasCursor(activeTool: string, panning: boolean): string {
  if (activeTool === "eyedropper") return "crosshair";
  if (activeTool === "hand") return "grab";
  if (activeTool === "select") return "move";
  return panning ? "grabbing" : "default";
}

function imageTransform(pan: { x: number; y: number }, zoom: number, rotation: number, flip: { h: boolean; v: boolean }): string {
  let t = `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom}) rotate(${rotation}deg)`;
  if (flip.h) t += " scaleX(-1)";
  if (flip.v) t += " scaleY(-1)";
  return t;
}

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
  const transform = imageTransform(pan, zoom, rotation, flip);

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
          style={{ cursor: canvasCursor(activeTool, interaction.panning) }}
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
              transform,
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
              <div className="absolute top-3 left-3 z-20 px-2.5 py-1 rounded-full bg-[#0c0c0e] ring-1 ring-white/12 text-[10px] font-medium uppercase tracking-[0.16em] text-white/70 pointer-events-none">
                BEFORE
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
