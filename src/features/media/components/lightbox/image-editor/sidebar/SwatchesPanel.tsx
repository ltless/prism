"use client";

import { Swatches, Trash, Plus } from "@phosphor-icons/react";
import { PanelHeader } from "../../EditorSidebar";

interface SwatchesPanelProps {
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  swatches: string[];
  onAddSwatch: () => void;
  onRemoveSwatch: (color: string) => void;
  onClose: () => void;
}

export function SwatchesPanel({ brushColor, onBrushColorChange, swatches, onAddSwatch, onRemoveSwatch, onClose }: SwatchesPanelProps) {
  return (
    <div className="border-b border-main-border">
      <PanelHeader icon={Swatches} label="Swatches" onClose={onClose} />
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
                  }}
                  aria-label={`Select color ${color}`}
                  style={{ backgroundColor: color }}
                  className={`w-full aspect-square rounded-md border cursor-pointer transition-[color,transform] ${
                    brushColor === color
                      ? "border-primary ring-1 ring-primary/40 scale-110"
                      : "border-main-border hover:scale-105"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => onRemoveSwatch(color)}
                  aria-label={`Remove swatch ${color}`}
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
          onClick={onAddSwatch}
          className="w-full py-1.5 border border-dashed border-main-border text-[11px] text-muted-text hover:text-main-text hover:border-primary rounded-md cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Plus size={12} weight="light" />
          Add Current Color
        </button>
      </div>
    </div>
  );
}
