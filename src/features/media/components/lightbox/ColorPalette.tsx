"use client";

import { memo, useState } from "react";
import { Palette as PaletteIcon } from "@phosphor-icons/react";
import { LightboxSheet } from "./LightboxSheet";

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
    <LightboxSheet icon={PaletteIcon} title="Colors">
      <div className="flex flex-wrap gap-2">
        {palette.map((color: string) => (
          <button
            key={color}
            type="button"
            onClick={() => copyToClipboard(color)}
            aria-label={`Copy ${color}`}
            className="group relative flex h-9 w-9 cursor-pointer items-center justify-center rounded-full p-0.5 ring-1 ring-white/15 active:scale-[0.96]"
            style={{ transition: "transform 400ms cubic-bezier(0.32,0.72,0,1)" }}
          >
            <span
              className="h-full w-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
              style={{ backgroundColor: color }}
            />
            <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[#0c0c0e] px-2 py-1 font-mono text-[10px] text-white opacity-0 ring-1 ring-white/15 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
              {copiedColor === color ? "Copied" : color.toUpperCase()}
            </span>
          </button>
        ))}
      </div>
    </LightboxSheet>
  );
});
