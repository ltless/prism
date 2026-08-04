import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useEditorState } from "../state/editorState";
import { saveEditorState } from "../save";
import type { MediaItem } from "../../../../types";

export function useEditorSave(currentItem: MediaItem, onSuccess?: () => void) {
  const [saveLoading, setSaveLoading] = useState<"overwrite" | "copy" | null>(null);
  const isSaving = saveLoading !== null;

  const handleSave = useCallback(
    async (overwrite: boolean) => {
      if (isSaving) return;
      setSaveLoading(overwrite ? "overwrite" : "copy");
      try {
        const state = useEditorState.getState();
        const result = await saveEditorState(state, currentItem, { overwrite });
        if (result.success) {
          toast.success(overwrite ? "Image overwritten" : "Saved as copy", {
            duration: 1500,
          });
          onSuccess?.();
        } else {
          toast.error(result.error || "Save failed");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Unexpected save error"
        );
      } finally {
        setSaveLoading(null);
      }
    },
    [currentItem, onSuccess, isSaving]
  );

  return { saveLoading, isSaving, handleSave };
}
