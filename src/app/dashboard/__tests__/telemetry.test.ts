import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSystemStatsAction } from "../telemetry";

vi.mock("@/auth", () => ({
 auth: vi.fn(async () => ({ user: { id: "test-user-id" } })),
}));

vi.mock("@/core/utils/system", () => ({
 getSystemStats: vi.fn(() => ({ cpuLoad: 10, ramUsage: 50 })),
}));

describe("getSystemStatsAction", () => {
 beforeEach(() => {
 vi.clearAllMocks();
 });

 it("throws error when unauthenticated", async () => {
 const authModule = await import("@/auth");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(authModule.auth).mockResolvedValueOnce(null as any);

 await expect(getSystemStatsAction()).rejects.toThrow("Unauthorized");
 });

 it("returns system stats when authenticated", async () => {
 const result = await getSystemStatsAction();
 expect(result).toEqual({ cpuLoad: 10, ramUsage: 50 });
 });
});
