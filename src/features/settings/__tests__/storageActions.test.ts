import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  updateStorageLimitAction,
  getGlobalStorageDefaultAction,
  updateGlobalStorageDefaultAction,
} from "../services/storageActions";
import { parseGlobalDefaultBytes, effectiveStorageLimit } from "../services/storageQuota";
import { DEFAULT_USER_QUOTA_BYTES } from "@/core/constants";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "test-user-id", role: "admin" } })),
}));

const goFetchMock = vi.hoisted(() => vi.fn(async (path: string) => {
  if (path === "/api/v1/users/me/storage-usage") {
    return { usage_bytes: 100, image_bytes: 50, video_bytes: 50 };
  }
  if (path === "/api/v1/users/me") {
    return { role: "admin", storage_limit: 1000 };
  }
  if (path === "/api/v1/config/storage-default") {
    return { storage_default_bytes: 2000 };
  }
  if (path === "/api/v1/config") {
    return { ai: null };
  }
  return { success: true };
}));

vi.mock("@/lib/api", () => ({
  goFetch: goFetchMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("parseGlobalDefaultBytes", () => {
  it("returns 10GB fallback for null/undefined", () => {
    expect(parseGlobalDefaultBytes(null)).toBe(DEFAULT_USER_QUOTA_BYTES);
    expect(parseGlobalDefaultBytes(undefined)).toBe(DEFAULT_USER_QUOTA_BYTES);
  });

  it("returns null for 'unlimited'", () => {
    expect(parseGlobalDefaultBytes("unlimited")).toBeNull();
  });

  it("parses numeric strings", () => {
    expect(parseGlobalDefaultBytes("123")).toBe(123);
    expect(parseGlobalDefaultBytes(String(5 * 1024 ** 3))).toBe(5 * 1024 ** 3);
  });

  it("falls back to 10GB for invalid input", () => {
    expect(parseGlobalDefaultBytes("abc")).toBe(DEFAULT_USER_QUOTA_BYTES);
    expect(parseGlobalDefaultBytes("-5")).toBe(DEFAULT_USER_QUOTA_BYTES);
  });
});

describe("effectiveStorageLimit", () => {
  it("explicit per-user limit wins over everything", () => {
    expect(effectiveStorageLimit("user", 1000, 2000)).toBe(1000);
    expect(effectiveStorageLimit("admin", 1000, 2000)).toBe(1000);
  });

  it("admin defaults to unlimited when no explicit limit", () => {
    expect(effectiveStorageLimit("admin", null, 2000)).toBeNull();
  });

  it("non-admin uses global default (null = unlimited)", () => {
    expect(effectiveStorageLimit("user", null, null)).toBeNull();
    expect(effectiveStorageLimit("user", null, 2000)).toBe(2000);
  });

  it("undefined role treated as non-admin", () => {
    expect(effectiveStorageLimit(undefined, null, 2000)).toBe(2000);
  });
});

describe("storageActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateStorageLimitAction", () => {
    it("fails when unauthenticated", async () => {
      const authModule = await import("@/auth");
      vi.mocked(authModule.auth).mockResolvedValueOnce(null as never);
      const result = await updateStorageLimitAction(2000);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Unauthorized");
    });

    it("fails when authenticated but not admin", async () => {
      const authModule = await import("@/auth");
      vi.mocked(authModule.auth).mockResolvedValueOnce({ user: { id: "user-1", role: "user" } } as never);
      const result = await updateStorageLimitAction(2000);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Forbidden");
    });

    it("succeeds when admin", async () => {
      const result = await updateStorageLimitAction(2000);
      expect(result.success).toBe(true);
    });
  });

  describe("getGlobalStorageDefaultAction", () => {
    it("fails when not admin", async () => {
      const authModule = await import("@/auth");
      vi.mocked(authModule.auth).mockResolvedValueOnce({ user: { id: "user-1", role: "user" } } as never);
      const result = await getGlobalStorageDefaultAction();
      expect(result.success).toBe(false);
    });

    it("succeeds when admin", async () => {
      const result = await getGlobalStorageDefaultAction();
      expect(result.success).toBe(true);
    });
  });

  describe("updateGlobalStorageDefaultAction", () => {
    it("fails when not admin", async () => {
      const authModule = await import("@/auth");
      vi.mocked(authModule.auth).mockResolvedValueOnce({ user: { id: "user-1", role: "user" } } as never);
      const result = await updateGlobalStorageDefaultAction(5000);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error).toBe("Forbidden");
    });

    it("rejects non-positive byte values", async () => {
      const result = await updateGlobalStorageDefaultAction(-1);
      expect(result.success).toBe(false);
    });

    it("accepts 'unlimited' when admin", async () => {
      const result = await updateGlobalStorageDefaultAction("unlimited");
      expect(result.success).toBe(true);
    });

    it("accepts positive bytes when admin", async () => {
      const result = await updateGlobalStorageDefaultAction(5 * 1024 ** 3);
      expect(result.success).toBe(true);
    });
  });
});
