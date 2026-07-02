import { describe, it, expect } from "vitest";
import { mapFolder, type GoFolder } from "@/types/goApi";

const base: GoFolder = {
  id: "f1",
  name: "Test",
  color: "blue",
  folder_type: "regular",
  parent_id: null,
  created_at: 1700000000,
};

describe("mapFolder", () => {
  it("maps a regular folder", () => {
    const f = mapFolder(base);
    expect(f.folderType).toBe("regular");
    expect(f.smartFilter).toBeUndefined();
  });

  it("parses smart folder filter_query", () => {
    const f = mapFolder({
      ...base,
      folder_type: "smart",
      filter_query: JSON.stringify({ categories: ["nature", "food"], minScore: 0.7 }),
    });
    expect(f.folderType).toBe("smart");
    expect(f.smartFilter).toEqual({ categories: ["nature", "food"], minScore: 0.7 });
  });

  it("defaults minScore to 0 when missing", () => {
    const f = mapFolder({
      ...base,
      folder_type: "smart",
      filter_query: JSON.stringify({ categories: ["nature"] }),
    });
    expect(f.smartFilter).toEqual({ categories: ["nature"], minScore: 0 });
  });

  it("ignores invalid JSON filter_query", () => {
    const f = mapFolder({ ...base, folder_type: "smart", filter_query: "not json{" });
    expect(f.folderType).toBe("smart");
    expect(f.smartFilter).toBeUndefined();
  });

  it("ignores empty categories", () => {
    const f = mapFolder({
      ...base,
      folder_type: "smart",
      filter_query: JSON.stringify({ categories: [], minScore: 0.5 }),
    });
    expect(f.smartFilter).toBeUndefined();
  });

  it("treats unknown folder_type as regular", () => {
    const f = mapFolder({ ...base, folder_type: "weird" });
    expect(f.folderType).toBe("regular");
  });
});
