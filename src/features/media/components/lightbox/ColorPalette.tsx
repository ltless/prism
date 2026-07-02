"use client";

import { memo, useState } from "react";
import { Palette as PaletteIcon } from "@phosphor-icons/react";
import { SectionCard } from "@/shared/components/SectionCard";

interface ColorPaletteProps {
  palette: string[];
}

export const ColorPalette = memo(function ColorPalette({ palette }: ColorPaletteProps) {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedColor(text);
    setTimeout(() => setCopiedColor(null), 2000);
  };

  if (palette.length === 0) return null;

  return (
    <SectionCard compact icon={PaletteIcon} title="Colors">
      <div className="flex flex-wrap gap-2">
        {palette.map((color: string) => (
          <button
            key={color}
            type="button"
            onClick={() => copyToClipboard(color)}
            className="group relative flex flex-col items-center gap-1.5 cursor-pointer"
          >
            <div
              className="w-9 h-9 rounded-lg border border-main-border/40 shadow-sm group-hover:scale-105 transition-transform"
              style={{ backgroundColor: color }}
            />
            <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-black text-white text-[11px] py-1 px-2 rounded-md font-mono font-medium whitespace-nowrap z-50 pointer-events-none shadow-md">
              {copiedColor === color ? "Copied" : color.toUpperCase()}
            </div>
          </button>
        ))}
      </div>
    </SectionCard>
  );
});
