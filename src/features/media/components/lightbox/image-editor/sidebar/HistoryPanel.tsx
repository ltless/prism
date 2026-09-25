"use client";

import { Clock } from "@phosphor-icons/react";
import { PanelHeader } from "../../EditorSidebar";

interface HistoryPanelProps {
  onClose: () => void;
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  return (
    <div>
      <PanelHeader icon={Clock} label="History" onClose={onClose} />
      <div className="px-3 pb-3 pt-2 space-y-1">
        <p className="text-xs italic text-muted-text/60 text-center py-2">
          Undo/redo history will appear here once you make edits.
        </p>
      </div>
    </div>
  );
}
