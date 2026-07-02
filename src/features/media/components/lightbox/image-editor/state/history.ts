import { create } from "zustand";
import { devtools } from "zustand/middleware";
import {
  useEditorState,
  type EditorState,
  type CropState,
} from "./editorState";

/**
 * What gets snapshot-ed for undo/redo history.
 *
 * We only snapshot state that represents a "meaningful edit":
 *   - Transform (rotation, flipH, flipV)
 *   - All adjustments
 *   - Crop
 *
 * We DON'T snapshot:
 *   - activeTool (UI state, shouldn't survive undo)
 *   - isDirty (regenerated from current vs snapshot-0 diff)
 */
export interface EditorSnapshot {
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  adjustments: EditorState["adjustments"];
  crop: CropState | null;
}

export const MAX_HISTORY = 50;

/** Extract the snapshot-relevant slice from the live editor state. */
export function getSnapshot(state: EditorState): EditorSnapshot {
  return {
    rotation: state.rotation,
    flipH: state.flipH,
    flipV: state.flipV,
    adjustments: structuredClone(state.adjustments),
    crop: state.crop ? structuredClone(state.crop) : null,
  };
}

interface HistoryState {
  past: EditorSnapshot[];
  future: EditorSnapshot[];
  /**
   * Push a snapshot onto the past stack. Clears the future stack
   * (new edit forks history). Caps past at MAX_HISTORY, evicting oldest.
   *
   * Call this on semantic commits — not on every slider drag, but on:
   *   - slider mouseUp / onChangeCommitted
   *   - button clicks (flip, reset, auto)
   *   - confirm crop
   */
  pushSnapshot: (snap: EditorSnapshot) => void;

  /**
   * Undo: move the most-recent past snapshot into future, then restore
   * the new most-recent past into the live editor state.
   *
   * Returns true if undo actually happened (past had >=2 entries:
   * we need current + at least one prior to restore to).
   */
  undo: () => boolean;

  /**
   * Redo: pop future, push into past, apply to live editor state.
   * Returns true if redo happened.
   */
  redo: () => boolean;

  canUndo: () => boolean;
  canRedo: () => boolean;

  /** Clear all history. Called on image swap / editor close. */
  resetHistory: () => void;
}

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      past: [],
      future: [],

      pushSnapshot: (snap) =>
        set((state) => {
          // Skip if identical to most recent past (idempotent)
          const last = state.past[state.past.length - 1];
          if (last && JSON.stringify(last) === JSON.stringify(snap)) {
            return state;
          }
          const newPast = [...state.past, snap];
          if (newPast.length > MAX_HISTORY) newPast.shift();
          return { past: newPast, future: [] };
        }),

      undo: () => {
        const { past, future } = get();
        // past[0] = initial baseline; past[last] = "current" state from
        // user's perspective. To undo, pop past's top into future, restore
        // the new top into live state.
        if (past.length < 2) return false;

        const newPast = [...past];
        const popped = newPast.pop()!;
        const restored = newPast[newPast.length - 1];
        applySnapshotToEditor(restored);
        set({ past: newPast, future: [popped, ...future] });
        return true;
      },

      redo: () => {
        const { past, future } = get();
        if (future.length === 0) return false;

        const newFuture = [...future];
        const restored = newFuture.shift()!;
        applySnapshotToEditor(restored);
        set({ past: [...past, restored], future: newFuture });
        return true;
      },

      canUndo: () => get().past.length >= 2,
      canRedo: () => get().future.length > 0,

      resetHistory: () => set({ past: [], future: [] }),
    }),
    { name: "prism-editor-history" }
  )
);

/** Apply an EditorSnapshot back into the live editor state. */
function applySnapshotToEditor(snap: EditorSnapshot) {
  const editor = useEditorState.getState();
  // Use Zustand's set method with merge to avoid wiping other UI state
  useEditorState.setState({
    rotation: snap.rotation,
    flipH: snap.flipH,
    flipV: snap.flipV,
    adjustments: structuredClone(snap.adjustments),
    crop: snap.crop ? structuredClone(snap.crop) : null,
  });
  // Mark dirty true (user now has un-saved changes relative to base)
  if (!editor.isDirty) editor.setDirty(true);
}

/**
 * Initialize history with the current editor state as the baseline.
 * Call once when editor mounts with a new image.
 */
export function initHistoryBaseline() {
  const snap = getSnapshot(useEditorState.getState());
  useHistoryStore.setState({ past: [snap], future: [] });
}
