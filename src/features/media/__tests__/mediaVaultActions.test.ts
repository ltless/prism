import { describe, it, expect, vi, beforeEach } from "vitest";
import { toggleVaultAction, bulkSetVaultAction } from "../services/mediaVaultActions";

const mockSelect = vi.fn(() => Promise.resolve([{ id: "test-id", isVault: false }]));

const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: mockSelect,
      })),
    })),
  })),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve()),
    })),
  })),
};

vi.mock("@/services/db/multitenant", () => ({
  getUserDb: vi.fn(async () => ({
    db: mockDb,
    paths: { mediaDir: "/tmp", thumbDir: "/tmp/thumbs", dbPath: ":memory:" },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "test-user-id" } })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("vault actions", () => {
  describe("toggleVaultAction", () => {
    it("toggles isVault from false to true", async () => {
      const result = await toggleVaultAction("test-id");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isVault).toBe(true);
      }
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("toggles isVault from true to false", async () => {
      mockSelect.mockResolvedValueOnce([{ id: "test-id", isVault: true }]);

      const result = await toggleVaultAction("test-id");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.isVault).toBe(false);
      }
    });

    it("throws when item not found", async () => {
      mockSelect.mockResolvedValueOnce([]);

      const result = await toggleVaultAction("nonexistent");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Item not found");
      }
    });
  });

  describe("bulkSetVaultAction", () => {
    it("sets isVault=true on given ids, returns count", async () => {
      const result = await bulkSetVaultAction(["id-1", "id-2", "id-3"], true);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.count).toBe(3);
      }
      expect(mockDb.update).toHaveBeenCalled();
    });
  });
});
