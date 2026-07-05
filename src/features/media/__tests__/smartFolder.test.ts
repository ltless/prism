/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSmartFolderAction } from "@/features/media/services/mediaFolderActions";
import { parseSmartFolderFilter } from "@/features/media/schemas";
import { goFetch } from "@/lib/api";

vi.mock("@/lib/api", () => ({
  goFetch: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockedGoFetch = vi.mocked(goFetch);

beforeEach(() => { vi.clearAllMocks(); });

describe("parseSmartFolderFilter", () => {
  it("parses a valid filter", () => {
    expect(
      parseSmartFolderFilter('{"categories":["Nature","Water"],"minScore":0.25}')
    ).toEqual({ categories: ["Nature", "Water"], minScore: 0.25 });
  });

  it("returns null for non-json", () => {
    expect(parseSmartFolderFilter("not json")).toBeNull();
  });

  it("returns null for missing input", () => {
    expect(parseSmartFolderFilter(null)).toBeNull();
    expect(parseSmartFolderFilter(undefined)).toBeNull();
    expect(parseSmartFolderFilter("")).toBeNull();
  });

  it("rejects minScore out of range", () => {
    expect(parseSmartFolderFilter('{"categories":["x"],"minScore":5}')).toBeNull();
    expect(parseSmartFolderFilter('{"categories":["x"],"minScore":-1}')).toBeNull();
  });

  it("accepts empty categories", () => {
    expect(parseSmartFolderFilter('{"categories":[],"minScore":0}')).toEqual({
      categories: [],
      minScore: 0,
    });
  });
});

describe("createSmartFolderAction validation", () => {
  it("rejects an invalid filter and does not call goFetch", async () => {
    const result = await createSmartFolderAction("Bad", "violet", {
      categories: ["x"],
      minScore: 5,
    } as any);
    expect(result.success).toBe(false);
    expect(mockedGoFetch).not.toHaveBeenCalled();
  });

  it("rejects an invalid color and does not call goFetch", async () => {
    const result = await createSmartFolderAction("Bad", "notacolor", {
      categories: ["x"],
      minScore: 0.1,
    });
    expect(result.success).toBe(false);
    expect(mockedGoFetch).not.toHaveBeenCalled();
  });

  it("calls folders endpoint with serialized filter", async () => {
    mockedGoFetch.mockResolvedValueOnce({ id: "f-1" });
    const result = await createSmartFolderAction("Pretty", "violet", {
      categories: ["Nature"],
      minScore: 0.3,
    });
    expect(result).toEqual({ success: true });
    expect(mockedGoFetch).toHaveBeenCalledWith("/api/v1/folders", {
      method: "POST",
      body: {
        name: "Pretty",
        color: "violet",
        folder_type: "smart",
        filter_query: JSON.stringify({ categories: ["Nature"], minScore: 0.3 }),
      },
    });
  });
});
