import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { rateLimit } from "@/core/utils/rateLimit";

describe("rateLimit", () => {
 beforeEach(() => {
 vi.useFakeTimers();
 });

 afterEach(() => {
 vi.useRealTimers();
 });

 it("allows first request", async () => {
 const result = await rateLimit("test-first", 3, 60_000);
 expect(result.success).toBe(true);
 expect(result.limit).toBe(3);
 expect(result.remaining).toBe(2);
 });

 it("blocks when limit exceeded", async () => {
 const key = "test-block-" + Math.random();
 await rateLimit(key, 2, 60_000);
 await rateLimit(key, 2, 60_000);
 const result = await rateLimit(key, 2, 60_000);
 expect(result.success).toBe(false);
 expect(result.remaining).toBe(0);
 });

 it("resets after window expires", async () => {
 await rateLimit("test-reset", 1, 60_000);
 let result = await rateLimit("test-reset", 1, 60_000);
 expect(result.success).toBe(false);

 vi.advanceTimersByTime(60_001);
 result = await rateLimit("test-reset", 1, 60_000);
 expect(result.success).toBe(true);
 });

 it("tracks different keys independently", async () => {
 await rateLimit("key-a", 1, 60_000);
 const resultA = await rateLimit("key-a", 1, 60_000);
 expect(resultA.success).toBe(false);

 const resultB = await rateLimit("key-b", 1, 60_000);
 expect(resultB.success).toBe(true);
 });

 it("returns correct remaining count", async () => {
 const key = "test-remaining-" + Math.random();
 const r1 = await rateLimit(key, 5, 60_000);
 expect(r1.remaining).toBe(4);

 const r2 = await rateLimit(key, 5, 60_000);
 expect(r2.remaining).toBe(3);

 const r3 = await rateLimit(key, 5, 60_000);
 expect(r3.remaining).toBe(2);
 });
});
