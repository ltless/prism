"use client";

import { ArrowsOut, FlipHorizontal, FlipVertical } from "@phosphor-icons/react";
import { SliderRow } from "./SliderRow";
import { PanelHeader, SubHeader } from "../../EditorSidebar";

interface TransformPanelProps {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  imageWidth: number;
  imageHeight: number;
  onRotationChange: (v: number) => void;
  onFlipH: () => void;
  onFlipV: () => void;
  onClose: () => void;
}

export function TransformPanel({ rotation, flipH, flipV, imageWidth, imageHeight, onRotationChange, onFlipH, onFlipV, onClose }: TransformPanelProps) {
  return (
    <div>
      <PanelHeader icon={ArrowsOut} label="Transform" onClose={onClose} />
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
              aria-label="Image width"
              className="w-full bg-surface-bg border border-main-border rounded-md px-2 py-1 text-[11px] font-mono text-main-text outline-none"
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
              aria-label="Image height"
              className="w-full bg-surface-bg border border-main-border rounded-md px-2 py-1 text-[11px] font-mono text-main-text outline-none"
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
            onClick={() => onRotationChange((rotation - 90 + 360) % 360)}
            className="px-2 py-1.5 border border-main-border/60 bg-surface-bg/40 hover:bg-surface-bg rounded-md text-[11px] cursor-pointer text-muted-text hover:text-main-text transition-colors"
          >
            ↺ 90° CCW
          </button>
          <button
            type="button"
            onClick={() => onRotationChange((rotation + 90) % 360)}
            className="px-2 py-1.5 border border-main-border/60 bg-surface-bg/40 hover:bg-surface-bg rounded-md text-[11px] cursor-pointer text-muted-text hover:text-main-text transition-colors"
          >
            ↻ 90° CW
          </button>
        </div>

        <SubHeader label="Mirror" />
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onFlipH}
            className={`py-1.5 border rounded-md text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
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
            className={`py-1.5 border rounded-md text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
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
  );
}
