/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSmartFolderAction } from "@/features/media/services/mediaFolderActions";
import { parseSmartFolderFilter } from "@/features/media/schemas";

let insertValues: unknown[] = [];

const mockDb = {
  insert: vi.fn(() => ({
    values: vi.fn((v: unknown) => {
      insertValues.push(v);
      return Promise.resolve();
    }),
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

beforeEach(() => {
  vi.clearAllMocks();
  insertValues = [];
});

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
  it("rejects an invalid filter and does not insert", async () => {
    const result = await createSmartFolderAction("Bad", "violet", {
      categories: ["x"],
      minScore: 5,
    } as any);
    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("rejects an invalid color and does not insert", async () => {
    const result = await createSmartFolderAction("Bad", "notacolor", {
      categories: ["x"],
      minScore: 0.1,
    });
    expect(result.success).toBe(false);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("inserts a valid smart folder with serialized filter", async () => {
    const result = await createSmartFolderAction("Pretty", "violet", {
      categories: ["Nature"],
      minScore: 0.3,
    });
    expect(result.success).toBe(true);
    expect(mockDb.insert).toHaveBeenCalled();
    expect((insertValues[0] as any).filterQuery).toBe(
      JSON.stringify({ categories: ["Nature"], minScore: 0.3 })
    );
  });
});
