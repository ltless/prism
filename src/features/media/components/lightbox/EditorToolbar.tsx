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
  return (
    <div className="w-10 shrink-0 flex flex-col items-center py-2 gap-0.5 border-r border-main-border">
      {tools.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeTool === tool.id;
        return (
          <button
            key={tool.id}
            onClick={() => onToolChange(tool.id)}
            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ""}`}
            className={`w-8 h-8 flex items-center justify-center rounded cursor-pointer transition-colors ${
              isActive ? "text-primary bg-primary/10" : "text-muted-text hover:text-main-text hover:bg-surface-bg"
            }`}
          >
            <Icon size={16} weight="light" />
          </button>
        );
      })}

      <div className="w-6 h-px bg-main-border/30 my-0.5" />

      <button
        onClick={onToggleBeforeAfter}
        title={`Before/After ( \ )`}
        className={`w-8 h-8 flex items-center justify-center rounded cursor-pointer transition-colors ${
          showBefore
            ? "text-primary bg-primary/10"
            : "text-muted-text hover:text-main-text hover:bg-surface-bg"
        }`}
      >
        <CopySimple size={16} weight={showBefore ? "fill" : "light"} />
      </button>
    </div>
  );
}
