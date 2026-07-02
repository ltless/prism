import { useCallback } from "react";
import { create } from "zustand";
import {
  useEditorState,
  type AdjustmentState,
} from "../state/editorState";
import {
  useHistoryStore,
  getSnapshot,
} from "../state/history";

const useDraggingStore = create<{ isDragging: boolean }>(() => ({
  isDragging: false,
}));

let dragActive = false;
let rafId: number | null = null;

// Throttle state for slider drags. Slider pointermove events fire far faster
// than 60fps; rAF coalesces to 60, but during a drag we deliberately cap the
// preview to ~30fps (Lightroom's proxy-update rate) to halve CPU/RAM. The
// latest pending value always applies on the next eligible frame, so the final
// position is never lost (trailing-edge guarantee).
let pendingKey: keyof AdjustmentState | null = null;
let pendingValue: unknown = undefined;
let lastApplyTs = 0;
const DRAG_FRAME_MS = 1000 / 30; // ~33ms

// Trailing end-drag timer for color picker drags. <input type=color> has no
// pointerup/drag-end event — it fires onChange continuously while the native
// picker is open. We end the drag session 400ms after the last change so the
// canvas snaps back to full res and the history snapshot closes.
let colorDragTimer: ReturnType<typeof setTimeout> | null = null;
const COLOR_DRAG_IDLE_MS = 400;

export function useEditorActions() {
  const rawSetAdjustment = useEditorState((s) => s.setAdjustment);

  const setAdjustment = useCallback(
    <K extends keyof AdjustmentState>(key: K, value: AdjustmentState[K]) => {
      // Store the latest value; a scheduled flush will pick it up.
      pendingKey = key;
      pendingValue = value;
      // Already scheduled — the pending rAF will apply the latest value.
      if (rafId) return;
      rafId = requestAnimationFrame(function flush(ts: number) {
        // Throttle: if we applied less than DRAG_FRAME_MS ago, reschedule and
        // wait. The pending value is retained until the next eligible frame.
        if (ts - lastApplyTs < DRAG_FRAME_MS) {
          rafId = requestAnimationFrame(flush);
          return;
        }
        if (pendingKey !== null) {
          rawSetAdjustment(pendingKey, pendingValue as AdjustmentState[typeof pendingKey]);
          lastApplyTs = ts;
          pendingKey = null;
          pendingValue = undefined;
        }
        rafId = null;
      });
    },
    [rawSetAdjustment]
  );

  const beginDragSession = useCallback(() => {
    useDraggingStore.setState({ isDragging: true });
    if (!dragActive) {
      dragActive = true;
      const snap = getSnapshot(useEditorState.getState());
      useHistoryStore.getState().pushSnapshot(snap);
    }
  }, []);

  const endDragSession = useCallback(() => {
    dragActive = false;
    useDraggingStore.setState({ isDragging: false });
  }, []);

  const commitEdit = useCallback((performEdit: () => void) => {
    const currentSnap = getSnapshot(useEditorState.getState());
    useHistoryStore.getState().pushSnapshot(currentSnap);
    performEdit();
  }, []);

  const setScalar = useCallback(
    <K extends keyof AdjustmentState>(key: K, value: AdjustmentState[K]) => {
      beginDragSession();
      setAdjustment(key, value);
    },
    [beginDragSession, setAdjustment]
  );

  const setMergeField = useCallback(
    <K extends keyof AdjustmentState>(
      key: K,
      patch: Partial<AdjustmentState[K]>,
      defaults?: object
    ) => {
      beginDragSession();
      const current = useEditorState.getState().adjustments[key];
      const merged = {
        ...defaults,
        ...(current as object),
        ...patch,
      } as AdjustmentState[K];
      setAdjustment(key, merged);
    },
    [beginDragSession, setAdjustment]
  );

  // Color picker drag (duotone/tritone/quadtone). <input type=color> fires
  // onChange continuously during picking with no drag-end event, so we:
  //   1. beginDragSession (sets isDragging → 640px proxy, one history snapshot)
  //   2. setAdjustment (rAF-throttled to 30fps)
  //   3. schedule a trailing endDragSession 400ms after the last change
  // This replaces the old commitEdit+rawSetAdjustment path which was unthrottled,
  // ran at 1920px (isDragging never set), and pushed a history snapshot every
  // pointermove (history bloat + 100% CPU during color picks).
  const setColorField = useCallback(
    <K extends keyof AdjustmentState>(key: K, value: AdjustmentState[K]) => {
      beginDragSession();
      setAdjustment(key, value);
      if (colorDragTimer) clearTimeout(colorDragTimer);
      colorDragTimer = setTimeout(() => {
        endDragSession();
        colorDragTimer = null;
      }, COLOR_DRAG_IDLE_MS);
    },
    [beginDragSession, setAdjustment, endDragSession]
  );

  return {
    beginDragSession,
    endDragSession,
    commitEdit,
    setAdjustment,
    rawSetAdjustment,
    setScalar,
    setMergeField,
    setColorField,
  };
}

export function resetEditorActions() {
  dragActive = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  pendingKey = null;
  pendingValue = undefined;
  lastApplyTs = 0;
  if (colorDragTimer) {
    clearTimeout(colorDragTimer);
    colorDragTimer = null;
  }
  useDraggingStore.setState({ isDragging: false });
}

export { useDraggingStore };
