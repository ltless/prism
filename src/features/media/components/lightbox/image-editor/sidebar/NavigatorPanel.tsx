"use client";

import { Compass } from "@phosphor-icons/react";
import { SliderRow } from "./SliderRow";
import { MiniPreview } from "./MiniPreview";
import { PanelHeader } from "../../EditorSidebar";

interface NavigatorPanelProps {
  mediaUrl: string;
  pan: { x: number; y: number };
  canvasContainerSize: { width: number; height: number };
  imageWidth: number;
  imageHeight: number;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onClose: () => void;
}

export function NavigatorPanel({ mediaUrl, pan, canvasContainerSize, imageWidth, imageHeight, zoom, onZoomChange, onClose }: NavigatorPanelProps) {
  return (
    <div>
      <PanelHeader icon={Compass} label="Navigator" onClose={onClose} />
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
  );
}
