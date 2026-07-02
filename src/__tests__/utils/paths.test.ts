import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";

beforeEach(() => {
 vi.resetModules();
});

describe("paths", () => {
  it("getStorageRoot returns ROOT/storage", async () => {
  vi.stubGlobal("process", { cwd: () => "/app" });
  const { getStorageRoot } = await import("@/core/utils/paths");
  expect(getStorageRoot()).toBe(path.join("/app", "storage"));
  });

 it("getDrizzleDir returns ROOT/drizzle", async () => {
 vi.stubGlobal("process", { cwd: () => "/app" });
 const { getDrizzleDir } = await import("@/core/utils/paths");
 expect(getDrizzleDir()).toBe(path.join("/app", "drizzle"));
 });
});
