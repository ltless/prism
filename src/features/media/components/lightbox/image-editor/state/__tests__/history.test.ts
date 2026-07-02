import { beforeEach, describe, expect, it } from "vitest";
import {
  useHistoryStore,
  initHistoryBaseline,
  getSnapshot,
  MAX_HISTORY,
  type EditorSnapshot,
} from "../history";
import { useEditorState, DEFAULT_ADJUSTMENTS } from "../editorState";

// Reset both stores between tests
beforeEach(() => {
  useHistoryStore.setState({ past: [], future: [] });
  useEditorState.setState({
    rotation: 0,
    flipH: false,
    flipV: false,
    adjustments: DEFAULT_ADJUSTMENTS,
    crop: null,
    isDirty: false,
    activeTool: "select",
  });
});

function makeSnapshot(overrides: Partial<EditorSnapshot> = {}): EditorSnapshot {
  return {
    rotation: 0,
    flipH: false,
    flipV: false,
    adjustments: structuredClone(DEFAULT_ADJUSTMENTS),
    crop: null,
    ...overrides,
  };
}

describe("history store", () => {
  describe("pushSnapshot", () => {
    it("appends to past and clears future", () => {
      useHistoryStore.getState().pushSnapshot(makeSnapshot());
      useHistoryStore.getState().pushSnapshot(
        makeSnapshot({ rotation: 90 })
      );

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(2);
      expect(future.length).toBe(0);
      expect(past[1].rotation).toBe(90);
    });

    it("skips duplicate consecutive snapshots", () => {
      const snap = makeSnapshot({ rotation: 45 });
      useHistoryStore.getState().pushSnapshot(snap);
      useHistoryStore.getState().pushSnapshot(snap);
      useHistoryStore.getState().pushSnapshot(snap);

      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(1);
    });

    it("evicts oldest when hitting MAX_HISTORY", () => {
      for (let i = 0; i < MAX_HISTORY + 10; i++) {
        useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: i }));
      }
      const { past } = useHistoryStore.getState();
      expect(past.length).toBe(MAX_HISTORY);
      // The oldest retained should be rotation=10 (0..9 evicted, 10..59 kept)
      expect(past[0].rotation).toBe(10);
      expect(past[MAX_HISTORY - 1].rotation).toBe(MAX_HISTORY + 9);
    });
  });

  describe("undo", () => {
    it("returns false when past has fewer than 2 entries", () => {
      useHistoryStore.getState().pushSnapshot(makeSnapshot());
      const result = useHistoryStore.getState().undo();
      expect(result).toBe(false);
    });

    it("restores previous snapshot and moves current to future", () => {
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 0 }));
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 90 }));
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 180 }));

      const result = useHistoryStore.getState().undo();
      expect(result).toBe(true);

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(2);
      expect(future.length).toBe(1);
      expect(future[0].rotation).toBe(180);

      // Live editor should have been restored to rotation=90
      expect(useEditorState.getState().rotation).toBe(90);
    });
  });

  describe("redo", () => {
    it("returns false when future is empty", () => {
      const result = useHistoryStore.getState().redo();
      expect(result).toBe(false);
    });

    it("pops future, pushes into past, applies to editor", () => {
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 0 }));
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 90 }));
      useHistoryStore.getState().undo();

      const result = useHistoryStore.getState().redo();
      expect(result).toBe(true);

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(2);
      expect(future.length).toBe(0);
      expect(useEditorState.getState().rotation).toBe(90);
    });

    it("pushSnapshot clears future (fork history)", () => {
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 0 }));
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 90 }));
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 180 }));
      useHistoryStore.getState().undo(); // future = [180]
      useHistoryStore.getState().undo(); // future = [180, 90]

      // New edit forks history — future cleared
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 270 }));
      const { future } = useHistoryStore.getState();
      expect(future.length).toBe(0);
    });
  });

  describe("initHistoryBaseline", () => {
    it("seeds past with current editor state snapshot", () => {
      useEditorState.setState({ rotation: 42, flipH: true });
      initHistoryBaseline();

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(1);
      expect(future.length).toBe(0);
      expect(past[0].rotation).toBe(42);
      expect(past[0].flipH).toBe(true);
    });
  });

  describe("canUndo / canRedo", () => {
    it("reflects stack state accurately", () => {
      expect(useHistoryStore.getState().canUndo()).toBe(false);
      expect(useHistoryStore.getState().canRedo()).toBe(false);

      useHistoryStore.getState().pushSnapshot(makeSnapshot());
      expect(useHistoryStore.getState().canUndo()).toBe(false); // need 2

      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 1 }));
      expect(useHistoryStore.getState().canUndo()).toBe(true);
      expect(useHistoryStore.getState().canRedo()).toBe(false);

      useHistoryStore.getState().undo();
      expect(useHistoryStore.getState().canUndo()).toBe(false);
      expect(useHistoryStore.getState().canRedo()).toBe(true);
    });
  });

  describe("resetHistory", () => {
    it("clears both stacks", () => {
      useHistoryStore.getState().pushSnapshot(makeSnapshot());
      useHistoryStore.getState().pushSnapshot(makeSnapshot({ rotation: 90 }));
      useHistoryStore.getState().undo();
      useHistoryStore.getState().resetHistory();

      const { past, future } = useHistoryStore.getState();
      expect(past.length).toBe(0);
      expect(future.length).toBe(0);
    });
  });

  describe("getSnapshot", () => {
    it("excludes UI state (activeTool, isDirty)", () => {
      useEditorState.setState({
        activeTool: "hand",
        isDirty: true,
      });
      const snap = getSnapshot(useEditorState.getState());
      // EditorSnapshot doesn't include these fields — verified by type
      expect(snap).not.toHaveProperty("activeTool");
      expect(snap).not.toHaveProperty("isDirty");
    });

    it("deep-clones adjustments so mutations don't leak", () => {
      const state = useEditorState.getState();
      const snap1 = getSnapshot(state);
      const snap2 = getSnapshot(state);
      expect(snap1.adjustments).not.toBe(snap2.adjustments);
    });
  });
});
