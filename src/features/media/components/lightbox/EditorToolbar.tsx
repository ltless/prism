"use client";

import {
  Crop,
  SlidersHorizontal,
  PaintBrush,
  TextT,
  Eraser,
  Hand,
  MagnifyingGlass,
  Eyedropper,
  ArrowsOutCardinal,
  CopySimple,
} from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { EditorTool } from "./image-editor/state/editorState";

interface EditorToolbarProps {
  activeTool: EditorTool;
  onToolChange: (tool: EditorTool) => void;
  showBefore?: boolean;
  onToggleBeforeAfter?: () => void;
}

const tools: { id: EditorTool; icon: typeof Crop; label: string; shortcut?: string }[] = [
  { id: "select", icon: ArrowsOutCardinal, label: "Move", shortcut: "V" },
  { id: "hand", icon: Hand, label: "Pan", shortcut: "H" },
  { id: "crop", icon: Crop, label: "Crop", shortcut: "C" },
  { id: "adjust", icon: SlidersHorizontal, label: "Adjust", shortcut: "A" },
  { id: "paint", icon: PaintBrush, label: "Paint", shortcut: "P" },
  { id: "eraser", icon: Eraser, label: "Eraser", shortcut: "E" },
  { id: "text", icon: TextT, label: "Text", shortcut: "T" },
  { id: "eyedropper", icon: Eyedropper, label: "Eyedropper", shortcut: "I" },
  { id: "zoom", icon: MagnifyingGlass, label: "Zoom", shortcut: "Z" },
];

export function EditorToolbar({
  activeTool,
  onToolChange,
  showBefore = false,
  onToggleBeforeAfter,
}: EditorToolbarProps) {
  const btn = (on: boolean) => cn(
    "w-9 h-9 flex items-center justify-center rounded-full cursor-pointer active:scale-[0.96] transition-[transform,background-color,color] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
    on ? "bg-white text-[#0c0c0e]" : "text-white/60 hover:text-white hover:bg-white/10",
  );

  return (
    <div className="w-[4.25rem] shrink-0 flex flex-col items-center justify-center py-4">
      <div className="flex flex-col items-center gap-0.5 rounded-full bg-[#0c0c0e] p-1.5 ring-1 ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
            aria-pressed={isActive}
            className={btn(isActive)}
          >
            <Icon size={16} weight={isActive ? "fill" : "light"} />
          </button>
        );
      })}

      <span aria-hidden className="my-1.5 h-px w-5 bg-white/12" />

      <button
        type="button"
        onClick={onToggleBeforeAfter}
        title="Before/After ( \ )"
        aria-pressed={showBefore}
        className={btn(showBefore)}
      >
        <CopySimple size={16} weight={showBefore ? "fill" : "light"} />
      </button>
      </div>
    </div>
  );
}
