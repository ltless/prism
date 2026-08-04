import { useEffect } from "react";
import { useEditorState } from "../state/editorState";
import { useHistoryStore, getSnapshot } from "../state/history";

interface EditorShortcutsProps {
  onToggleRulers: () => void;
  onToggleSidebar: () => void;
  onToggleGrid: () => void;
  onToggleBefore: () => void;
}

export function useEditorShortcuts({ onToggleRulers, onToggleSidebar, onToggleGrid, onToggleBefore }: EditorShortcutsProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const snap = getSnapshot(useEditorState.getState());
        useHistoryStore.getState().pushSnapshot(snap);
        useHistoryStore.getState().undo();
        return;
      }

      if (mod && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        useHistoryStore.getState().redo();
        return;
      }

      if (mod && e.key.toLowerCase() === "r") {
        e.preventDefault();
        onToggleRulers();
        return;
      }

      if (e.key === "F7") {
        e.preventDefault();
        onToggleSidebar();
        return;
      }

      if (e.key === "'") {
        e.preventDefault();
        onToggleGrid();
        return;
      }

      if (e.key === "\\") {
        e.preventDefault();
        onToggleBefore();
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onToggleRulers, onToggleSidebar, onToggleGrid, onToggleBefore]);
}
