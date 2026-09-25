import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchLibraryPageAction, searchMediaAction } from "../services/mediaSearch";
import { goFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  goFetch: vi.fn(),
}));

const mockedGoFetch = vi.mocked(goFetch);

beforeEach(() => { vi.clearAllMocks(); });

describe("fetchLibraryPageAction", () => {
  it("requests the dashboard endpoint with page and limit 200", async () => {
    mockedGoFetch.mockResolvedValueOnce({ items: [], total: 0 });
    const result = await fetchLibraryPageAction(null, false, null, 2);
    expect(result).toEqual({ success: true, items: [], total: 0 });
    expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/dashboard?page=2&limit=200",);
  });

  it("passes folder, favorite and smart params", async () => {
    mockedGoFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await fetchLibraryPageAction(
      "folder-1",
      true,
      { categories: ["nature"], minScore: 0.5 },
      3,
    );
    const url = mockedGoFetch.mock.calls[0][0] as string;
    expect(url).toContain("folder_id=folder-1");
    expect(url).toContain("is_favorite=true");
    expect(url).toContain("smart=true");
    expect(url).toContain("categories=nature");
    expect(url).toContain("minScore=0.5");
    expect(url).toContain("page=3");
  });

  it("parses string metadata like the search action", async () => {
    mockedGoFetch.mockResolvedValueOnce({
      items: [{ id: "m1", metadata: '{"make":"Canon"}' }],
      total: 1,
    });
    const result = await fetchLibraryPageAction(null, false, null, 1);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.items[0] as { metadata?: unknown }).metadata).toEqual({ make: "Canon" });
    }
  });

  it("returns error when the fetch fails", async () => {
    mockedGoFetch.mockRejectedValueOnce(new Error("boom"));
    const result = await fetchLibraryPageAction(null, false, null, 1);
    expect(result.success).toBe(false);
  });
});

describe("searchMediaAction", () => {
  it("still calls the search endpoint", async () => {
    mockedGoFetch.mockResolvedValueOnce({ items: [], total: 0 });
    const result = await searchMediaAction("cat", null);
    expect(result).toEqual({ success: true, items: [], total: 0, query: "cat", mode: "keyword" });
    expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/search?q=cat",);
  });

  it("sends mode=name when searching by file name", async () => {
    mockedGoFetch.mockResolvedValueOnce({ items: [], total: 0 });
    await searchMediaAction("cat", null, { mode: "name" });
    expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/media/search?q=cat&mode=name",);
  });
});
