import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInfiniteScroll } from "@/features/media/hooks/useInfiniteScroll";
import type { MediaItem } from "@/features/media/types";

const mockLoadMoreMediaAction = vi.fn();

vi.mock("@/features/media/services/mediaSearch", () => ({
 loadMoreMediaAction: (...args: unknown[]) => mockLoadMoreMediaAction(...args),
}));

vi.mock("sonner", () => ({
 toast: { error: vi.fn() },
}));

function makeItem(id: string, ts?: number): MediaItem {
 return {
 id, title: id, filePath: "", mimeType: "", size: 0, hash: "",
 width: null, height: null,
 createdAt: ts ? new Date(ts) : new Date(),
 updatedAt: new Date(),
 };
}

beforeEach(() => {
 vi.clearAllMocks();
});

describe("useInfiniteScroll", () => {
 it("hasMore is true when totalCount exceeds initial items", () => {
 const { result } = renderHook(() =>
 useInfiniteScroll([makeItem("1")], 5, 20, null, null, null)
 );
 expect(result.current.hasMore).toBe(true);
 });

 it("hasMore is false when allItems already match totalCount", () => {
 const items = [makeItem("1"), makeItem("2")];
 const { result } = renderHook(() =>
 useInfiniteScroll(items, 2, 20, null, null, null)
 );
 expect(result.current.hasMore).toBe(false);
 });

 it("handleLoadMore calls loadMoreMediaAction", async () => {
 mockLoadMoreMediaAction.mockResolvedValue({
 success: true,
 items: [makeItem("2", 200)],
 });

 const { result } = renderHook(() =>
 useInfiniteScroll([makeItem("1", 100)], 5, 20, null, null, null)
 );

 await act(async () => result.current.handleLoadMore());

 await vi.waitFor(() => {
 expect(mockLoadMoreMediaAction).toHaveBeenCalled();
 }, { timeout: 5000 });
 });

 it("handleLoadMore appends items", async () => {
 const items = [makeItem("1", 100)];
 mockLoadMoreMediaAction.mockResolvedValue({
 success: true,
 items: [makeItem("2", 200)],
 });

 const { result } = renderHook(() =>
 useInfiniteScroll(items, 5, 20, null, null, null)
 );

 expect(result.current.allItems).toHaveLength(1);

 await act(async () => {
 await result.current.handleLoadMore();
 });

 await act(async () => {});

 expect(result.current.allItems).toHaveLength(2);
 });

 it("deduplicates items with same id", async () => {
 const existing = makeItem("1", 100);
 mockLoadMoreMediaAction.mockResolvedValue({
 success: true,
 items: [existing], // same id as initial
 });

 const { result } = renderHook(() =>
 useInfiniteScroll([existing], 5, 20, null, null, null)
 );

 await act(async () => result.current.handleLoadMore());

 expect(result.current.allItems).toHaveLength(1);
 });

 it("sets exhausted when fewer items returned than pageSize", async () => {
 mockLoadMoreMediaAction.mockResolvedValue({
 success: true,
 items: [makeItem("2", 200)],
 });

 const { result } = renderHook(() =>
 useInfiniteScroll([makeItem("1", 100)], 10, 20, null, null, null)
 );

 // First load returns 1 item, pageSize is 20, so exhausted
 await act(async () => result.current.handleLoadMore());

 expect(result.current.hasMore).toBe(false);
 });

 it("loads more items", async () => {
 // Push allItems past exhausted check via lots of initial items
 const initial = [makeItem("1", 100), makeItem("2", 200)];
 const extra = makeItem("3", 300);
 mockLoadMoreMediaAction.mockResolvedValue({
 success: true,
 items: [extra],
 });

 const { result } = renderHook(() =>
 useInfiniteScroll(initial, 10, 3, null, null, null)
 );

 expect(result.current.hasMore).toBe(true);

 await act(async () => result.current.handleLoadMore());

 expect(result.current.allItems).toHaveLength(3);
 expect(result.current.allItems[2].id).toBe("3");
 });

 it("calls toast.error on failure", async () => {
 const { toast } = await import("sonner");
 mockLoadMoreMediaAction.mockResolvedValue({
 success: false,
 error: "DB fail",
 });

 const { result } = renderHook(() =>
 useInfiniteScroll([makeItem("1")], 5, 20, null, null, null)
 );

 await act(async () => result.current.handleLoadMore());

 expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("DB fail"));
 });
});
