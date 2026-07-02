import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMediaSearch } from "@/features/media/hooks/useMediaSearch";

const mockSearchMediaAction = vi.fn();

vi.mock("@/features/media/services/mediaSearch", () => ({
 searchMediaAction: (...args: unknown[]) => mockSearchMediaAction(...args),
}));

vi.mock("sonner", () => ({
 toast: { error: vi.fn() },
}));

import { toast } from "sonner";

beforeEach(() => {
 vi.clearAllMocks();
});

describe("useMediaSearch", () => {
 it("returns null state when q is null", () => {
 const { result } = renderHook(() => useMediaSearch(null, null));
 expect(result.current.searchResults).toBeNull();
 expect(result.current.searchLoading).toBe(false);
 expect(result.current.searchQuery).toBeNull();
 });

 it("triggers search when q changes", async () => {
 const items = [{ id: "1", title: "test", filePath: "", mimeType: "", size: 0, hash: "" }];
 mockSearchMediaAction.mockResolvedValue({ success: true, items });

 const { result, rerender } = renderHook(
 ({ q, f }: { q: string | null; f: string | null }) => useMediaSearch(q, f),
 { initialProps: { q: null as string | null, f: null as string | null } }
 );

 expect(result.current.searchQuery).toBeNull();

 rerender({ q: "test", f: null });

 expect(result.current.searchQuery).toBe("test");
 expect(result.current.searchLoading).toBe(true);
 expect(result.current.searchResults).toBeNull();

 // Wait for effect to settle
 await act(async () => {});
 // Wait for search promise
 await vi.waitFor(() => {
 expect(result.current.searchResults).toEqual(items);
 });
 expect(result.current.searchLoading).toBe(false);
 });

 it("calls toast.error on search failure", async () => {
 mockSearchMediaAction.mockResolvedValue({ success: false, error: "DB error" });

 const { result, rerender } = renderHook(
 ({ q, f }: { q: string | null; f: string | null }) => useMediaSearch(q, f),
 { initialProps: { q: null as string | null, f: null as string | null } }
 );

 rerender({ q: "fail", f: null });
 expect(result.current.searchLoading).toBe(true);

 await act(async () => {});
 await vi.waitFor(() => {
 expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("DB error"));
 });
 expect(result.current.searchLoading).toBe(false);
 });

 it("resets state when q becomes null", () => {
 const { result, rerender } = renderHook(
 ({ q, f }: { q: string | null; f: string | null }) => useMediaSearch(q, f),
 { initialProps: { q: "test" as string | null, f: null as string | null } }
 );

 // After first render with q, searchQuery should be set
 expect(result.current.searchQuery).toBe("test");

 rerender({ q: null, f: null });
 expect(result.current.searchResults).toBeNull();
 expect(result.current.searchQuery).toBeNull();
 expect(result.current.searchLoading).toBe(false);
 });

 it("cancels previous search when q changes mid-flight", async () => {
 let resolveSearch: (v: unknown) => void;
 const searchPromise = new Promise((resolve) => { resolveSearch = resolve; });
 mockSearchMediaAction.mockReturnValue(searchPromise);

 const { rerender } = renderHook(
 ({ q, f }: { q: string | null; f: string | null }) => useMediaSearch(q, f),
 { initialProps: { q: null as string | null, f: null as string | null } }
 );

 rerender({ q: "first", f: null });
 await vi.waitFor(() => {
 expect(mockSearchMediaAction).toHaveBeenCalledTimes(1);
 });
 expect(mockSearchMediaAction).toHaveBeenCalledWith("first", null, undefined);

 // Change q before first resolves
 rerender({ q: "second", f: null });
 expect(mockSearchMediaAction).toHaveBeenCalledTimes(1); // still 1, second search hasn't started yet

 await vi.waitFor(() => {
 expect(mockSearchMediaAction).toHaveBeenCalledTimes(2);
 });

 // Resolve the first (now-cancelled) search
 resolveSearch!({ success: true, items: [{ id: "1", title: "first", filePath: "", mimeType: "", size: 0, hash: "" }] });
 await act(async () => {});

 expect(mockSearchMediaAction).toHaveBeenLastCalledWith("second", null, undefined);
 });
});
