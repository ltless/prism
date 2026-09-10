"use client";

import { useState } from "react";
import { Palette, X } from "@phosphor-icons/react";
import { PanelHeader } from "../../EditorSidebar";

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

interface ColorPanelProps {
  brushColor: string;
  onBrushColorChange: (color: string) => void;
  onClose: () => void;
}

export function ColorPanel({ brushColor, onBrushColorChange, onClose }: ColorPanelProps) {
  const [hexDraft, setHexDraft] = useState<string | null>(null);
  const hexInput = hexDraft ?? brushColor;

  const handleHexChange = (val: string) => {
    setHexDraft(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) onBrushColorChange(val);
  };

  return (
    <div className="border-b border-main-border">
      <PanelHeader icon={Palette} label="Color" onClose={onClose} />
      <div className="px-3 pb-3 pt-2 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 shrink-0">
            <div className="absolute inset-0 rounded-md border border-main-border bg-white" />
            <div
              className="absolute inset-1 rounded-md border border-main-border/60"
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
              aria-label="Hex color"
              className="w-full bg-surface-bg border border-main-border rounded-md px-2 py-1 text-[11px] font-mono text-main-text outline-none focus:border-primary"
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
              className={`w-full aspect-square rounded-md border cursor-pointer transition-[color,transform] ${
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
            aria-label="Custom color picker"
            className="w-7 h-7 rounded-md border border-main-border cursor-pointer"
          />
          <span className="text-xs text-muted-text uppercase tracking-wider font-semibold">
            Custom color
          </span>
        </div>
      </div>
    </div>
  );
}
