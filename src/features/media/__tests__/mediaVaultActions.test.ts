import { describe, it, expect, vi, beforeEach } from "vitest";
import { toggleVaultAction, bulkSetVaultAction } from "../services/mediaVaultActions";
import { goFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  goFetch: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockedGoFetch = vi.mocked(goFetch);

beforeEach(() => { vi.clearAllMocks(); });

describe("vault actions", () => {
  describe("toggleVaultAction", () => {
    it("toggles isVault from false to true", async () => {
      mockedGoFetch
        .mockResolvedValueOnce({ isVault: false })
        .mockResolvedValueOnce({ success: true });

      const result = await toggleVaultAction("test-id");
      expect(result).toEqual({ success: true, isVault: true });
      expect(mockedGoFetch).toHaveBeenCalledTimes(2);
      expect(mockedGoFetch).toHaveBeenNthCalledWith(1, "/api/v1/media/test-id");
      expect(mockedGoFetch).toHaveBeenNthCalledWith(2, "/api/v1/media/bulk/vault", {
        method: "POST",
        body: { media_ids: ["test-id"], is_vault: true },
      });
    });

    it("toggles isVault from true to false", async () => {
      mockedGoFetch
        .mockResolvedValueOnce({ isVault: true })
        .mockResolvedValueOnce({ success: true });

      const result = await toggleVaultAction("test-id");
      expect(result).toEqual({ success: true, isVault: false });
    });

    it("returns error when item not found", async () => {
      mockedGoFetch.mockRejectedValueOnce(new Error("Not found"));
      const result = await toggleVaultAction("nonexistent");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toMatch(/not found/i);
      }
    });
  });

  describe("bulkSetVaultAction", () => {
    it("returns count and success", async () => {
      mockedGoFetch.mockResolvedValueOnce({ success: true });
      const result = await bulkSetVaultAction(["id-1", "id-2", "id-3"], true);
      expect(result).toEqual({ success: true, count: 3 });
      expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/bulk/vault", {
        method: "POST",
        body: { media_ids: ["id-1", "id-2", "id-3"], is_vault: true },
      });
    });
  });
});
