import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaSelection } from "@/features/media/hooks/useMediaSelection";
import type { MediaItem } from "@/features/media/types";
import { useRouter } from "next/navigation";

const mockBulkMoveToTrash = vi.fn();
const mockBulkSetFavorite = vi.fn();
const mockMoveToFolder = vi.fn();
const mockDeleteFolder = vi.fn();

vi.mock("@/features/media/services/mediaTrashActions", () => ({
	bulkMoveToTrashAction: (...args: unknown[]) => mockBulkMoveToTrash(...args),
}));
vi.mock("@/features/media/services/mediaFavoriteActions", () => ({
	bulkSetFavoriteAction: (...args: unknown[]) => mockBulkSetFavorite(...args),
}));
vi.mock("@/features/media/services/mediaFolderActions", () => ({
	moveMediaToFolderAction: (...args: unknown[]) => mockMoveToFolder(...args),
	deleteFolderAction: (...args: unknown[]) => mockDeleteFolder(...args),
}));

vi.mock("@/features/media/hooks/useLasso", () => ({
	useLasso: () => ({
		selectionBoxRef: { current: null },
		isSelecting: false,
	}),
}));

const mockConfirm = vi.fn();
vi.mock("../../shared/hooks/useConfirm", () => ({
	useConfirm: () => ({
		confirm: mockConfirm,
		ConfirmDialog: null,
	}),
}));

const items: MediaItem[] = [
  { id: "a", title: "A", filePath: "", mimeType: "", size: 0, hash: "", width: null, height: null },
  { id: "b", title: "B", filePath: "", mimeType: "", size: 0, hash: "", width: null, height: null },
  { id: "c", title: "C", filePath: "", mimeType: "", size: 0, hash: "", width: null, height: null },
];

function renderSelection(displayedItems = items, activeFolderId: string | null = null) {
  const ref = { current: null } as React.RefObject<HTMLDivElement | null>;
  return renderHook(() => useMediaSelection(displayedItems, activeFolderId, ref));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useMediaSelection", () => {
  describe("toggleSelect", () => {
  it("selects a single item on normal click", () => {
  const { result } = renderSelection();

  act(() => result.current.toggleSelect("a", false, false));

  expect([...result.current.selectedIds]).toEqual(["a"]);
  });

  it("replaces selection on normal click", () => {
  const { result } = renderSelection();

  act(() => result.current.toggleSelect("a", false, false));
  act(() => result.current.toggleSelect("b", false, false));

  expect([...result.current.selectedIds]).toEqual(["b"]);
  });

  it("adds to selection with ctrl+click", () => {
  const { result } = renderSelection();

  act(() => result.current.toggleSelect("a", false, false));
  act(() => result.current.toggleSelect("b", false, true));

  expect([...result.current.selectedIds].sort()).toEqual(["a", "b"]);
  });

  it("removes from selection with ctrl+click on selected item", () => {
  const { result } = renderSelection();

  act(() => result.current.toggleSelect("a", false, false));
  act(() => result.current.toggleSelect("a", false, true));

  expect([...result.current.selectedIds]).toEqual([]);
  });

  it("selects range with shift+click", () => {
  const { result } = renderSelection();

  act(() => result.current.toggleSelect("a", false, false));
  act(() => result.current.toggleSelect("c", true, false));

  const sorted = [...result.current.selectedIds].sort();
  expect(sorted).toEqual(["a", "b", "c"]);
  });
  });

 describe("handleBulkFavorite", () => {
		it("calls bulkSetFavoriteAction with selected ids", async () => {
			mockBulkSetFavorite.mockResolvedValue({ success: true });

			const { result } = renderSelection();
			act(() => result.current.toggleSelect("a", false, false));
			act(() => result.current.toggleSelect("b", false, true));

			await act(async () => result.current.handleBulkFavorite());

			expect(mockBulkSetFavorite).toHaveBeenCalledWith(["a", "b"], true);
		});

		it("clears selection after favorite", async () => {
			mockBulkSetFavorite.mockResolvedValue({ success: true });

			const { result } = renderSelection();
			act(() => result.current.toggleSelect("a", false, false));

			await act(async () => result.current.handleBulkFavorite());

			expect(result.current.selectedIds.size).toBe(0);
		});
	});

 describe("handleBulkTrash", () => {
		it("calls bulkMoveToTrashAction with selected ids", async () => {
			mockBulkMoveToTrash.mockResolvedValue({ success: true });
			mockConfirm.mockResolvedValue(true);

			const { result } = renderSelection();
			act(() => result.current.toggleSelect("a", false, false));

			await act(async () => result.current.handleBulkTrash());

			expect(mockConfirm).toHaveBeenCalled();
			expect(mockBulkMoveToTrash).toHaveBeenCalledWith(["a"]);
			expect(result.current.selectedIds.size).toBe(0);
		});

		it("skips trash when confirm is cancelled", async () => {
			mockConfirm.mockResolvedValue(false);

			const { result } = renderSelection();
			act(() => result.current.toggleSelect("a", false, false));

			await act(async () => result.current.handleBulkTrash());

			expect(mockConfirm).toHaveBeenCalled();
			expect(mockBulkMoveToTrash).not.toHaveBeenCalled();
		});

		it("triggers router.refresh on success", async () => {
			mockBulkMoveToTrash.mockResolvedValue({ success: true });
			mockConfirm.mockResolvedValue(true);

			const { result } = renderSelection();
			act(() => result.current.toggleSelect("a", false, false));

			await act(async () => result.current.handleBulkTrash());

			expect(useRouter().refresh).toHaveBeenCalled();
		});
	});

 describe("handlePaste", () => {
		it("calls moveMediaToFolderAction with clipboard ids and activeFolderId", async () => {
			mockMoveToFolder.mockResolvedValue({ success: true });

			const { result } = renderSelection();
			act(() => result.current.setClipboard({ ids: new Set(["a", "b"]), isCut: false }));

			await act(async () => result.current.handlePaste());

			expect(mockMoveToFolder).toHaveBeenCalledWith(["a", "b"], null);
		});

		it("triggers router.refresh on success", async () => {
			mockMoveToFolder.mockResolvedValue({ success: true });

			const { result } = renderSelection();
			act(() => result.current.setClipboard({ ids: new Set(["a"]), isCut: false }));

			await act(async () => result.current.handlePaste());

			expect(useRouter().refresh).toHaveBeenCalled();
		});

		it("does nothing when clipboard is null", async () => {
			const { result } = renderSelection();
			await act(async () => result.current.handlePaste());
			expect(mockMoveToFolder).not.toHaveBeenCalled();
		});
	});

  describe("keyboard shortcuts", () => {
  it("ctrl+a selects all items", () => {
  const { result } = renderSelection();

  act(() => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true }));
  });

  expect(result.current.selectedIds.size).toBe(3);
  });

  it("escape clears selection and clipboard", () => {
  const { result } = renderSelection();
  act(() => result.current.toggleSelect("a", false, false));
  act(() => result.current.setClipboard({ ids: new Set(["a"]), isCut: false }));

  act(() => {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  });

  expect(result.current.selectedIds.size).toBe(0);
  expect(result.current.clipboard).toBeNull();
  });
  });
});
