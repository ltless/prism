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

  it("getGlobalDbPath returns ROOT/prism.db", async () => {
 vi.stubGlobal("process", { cwd: () => "/app" });
 const { getGlobalDbPath } = await import("@/core/utils/paths");
 expect(getGlobalDbPath()).toBe(path.join("/app", "prism.db"));
 });

 it("getDrizzleDir returns ROOT/drizzle", async () => {
 vi.stubGlobal("process", { cwd: () => "/app" });
 const { getDrizzleDir } = await import("@/core/utils/paths");
 expect(getDrizzleDir()).toBe(path.join("/app", "drizzle"));
 });
});
