import { describe, it, expect, vi, beforeEach } from "vitest";
import { bulkMoveToTrashAction } from "@/features/media/services/mediaTrashActions";
import { bulkSetFavoriteAction } from "@/features/media/services/mediaFavoriteActions";
import { createFolderAction, deleteFolderAction, moveMediaToFolderAction } from "@/features/media/services/mediaFolderActions";
import { goFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  goFetch: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockedGoFetch = vi.mocked(goFetch);

beforeEach(() => { vi.clearAllMocks(); });

describe("server actions", () => {
  describe("bulkMoveToTrashAction", () => {
    it("trash with empty ids is a no-op", async () => {
      const result = await bulkMoveToTrashAction([]);
      expect(result).toEqual({ success: true });
      expect(mockedGoFetch).not.toHaveBeenCalled();
    });

    it("calls bulk/trash endpoint", async () => {
      mockedGoFetch.mockResolvedValueOnce({ success: true });
      const result = await bulkMoveToTrashAction(["id-1", "id-2"]);
      expect(result).toEqual({ success: true });
      expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/bulk/trash", {
        method: "POST",
        body: { media_ids: ["id-1", "id-2"] },
      });
    });
  });

  describe("bulkSetFavoriteAction", () => {
    it("calls bulk/favorite endpoint and returns count", async () => {
      mockedGoFetch.mockResolvedValueOnce({ success: true });
      const result = await bulkSetFavoriteAction(["id-1"], true);
      expect(result).toEqual({ success: true, count: 1 });
      expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/bulk/favorite", {
        method: "POST",
        body: { media_ids: ["id-1"], is_favorite: true },
      });
    });

    it("returns count of updated items", async () => {
      mockedGoFetch.mockResolvedValueOnce({ success: true });
      const result = await bulkSetFavoriteAction(["a", "b", "c"], true);
      expect(result).toHaveProperty("success", true);
      expect(result).toHaveProperty("count", 3);
    });
  });

  describe("createFolderAction", () => {
    it("calls folders endpoint", async () => {
      mockedGoFetch.mockResolvedValueOnce({ id: "folder-1" });
      const result = await createFolderAction("Photos", "blue");
      expect(result).toEqual({ success: true });
      expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/folders", {
        method: "POST",
        body: { name: "Photos", color: "blue", folder_type: "regular" },
      });
    });

    it("creates smart folder with filter_query", async () => {
      mockedGoFetch.mockResolvedValueOnce({ id: "folder-2" });
      const result = await createFolderAction("Nature picks", "emerald", { categories: ["nature", "outdoor"], minScore: 0.6 });
      expect(result).toEqual({ success: true });
      expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/folders", {
        method: "POST",
        body: {
          name: "Nature picks",
          color: "emerald",
          folder_type: "smart",
          filter_query: JSON.stringify({ categories: ["nature", "outdoor"], minScore: 0.6 }),
        },
      });
    });

    it("rejects smart folder with no valid categories", async () => {
      const result = await createFolderAction("Bad", "blue", { categories: ["not-a-cat"], minScore: 0.6 });
      expect(result.success).toBe(false);
      expect(mockedGoFetch).not.toHaveBeenCalled();
    });

    it("clamps minScore into [0,1]", async () => {
      mockedGoFetch.mockResolvedValueOnce({ id: "folder-3" });
      await createFolderAction("Clamped", "blue", { categories: ["food"], minScore: 5 });
      const body = mockedGoFetch.mock.calls[0][1]?.body as { filter_query: string };
      expect(JSON.parse(body.filter_query).minScore).toBe(1);
    });

    it("rejects empty name", async () => {
      const result = await createFolderAction("   ", "blue");
      expect(result.success).toBe(false);
      expect(mockedGoFetch).not.toHaveBeenCalled();
    });
  });

  describe("deleteFolderAction", () => {
    it("calls delete folder endpoint", async () => {
      mockedGoFetch.mockResolvedValueOnce({ success: true });
      const result = await deleteFolderAction("folder-1");
      expect(result).toEqual({ success: true });
      expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/folders/folder-1", {
        method: "DELETE",
      });
    });
  });

  describe("moveMediaToFolderAction", () => {
    it("empty ids is no-op", async () => {
      const result = await moveMediaToFolderAction([], "folder-1");
      expect(result).toEqual({ success: true });
      expect(mockedGoFetch).not.toHaveBeenCalled();
    });

    it("calls bulk/move endpoint", async () => {
      mockedGoFetch.mockResolvedValueOnce({ success: true });
      const result = await moveMediaToFolderAction(["id-1"], "folder-1");
      expect(result).toEqual({ success: true });
      expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/bulk/move", {
        method: "PUT",
        body: { media_ids: ["id-1"], folder_id: "folder-1" },
      });
    });
  });
});
