"use client";

import { Info } from "@phosphor-icons/react";
import { PanelHeader, InfoRow, CursorPosInfo } from "../../EditorSidebar";

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

interface InfoPanelProps {
  imageWidth: number;
  imageHeight: number;
  mimeType: string;
  zoom: number;
  sampledColor?: { r: number; g: number; b: number; a: number } | null;
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

export function InfoPanel({ imageWidth, imageHeight, mimeType, zoom, sampledColor, canvasContainerRef, onClose }: InfoPanelProps) {
  return (
    <div className="border-b border-main-border">
      <PanelHeader icon={Info} label="Info" onClose={onClose} />
      <div className="px-3 pb-3 pt-2 space-y-2">
        <InfoRow label="Dimensions" value={formatSize(imageWidth, imageHeight)} />
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
  );
}
