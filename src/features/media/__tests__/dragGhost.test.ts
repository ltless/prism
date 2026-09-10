import { describe, it, expect } from "vitest";
import { buildDragStack, THUMB_URL } from "../utils/dragGhost";

describe("buildDragStack", () => {
  it("shows 3 stacked thumbnails with +N badge when more than 3 selected", () => {
    const stack = buildDragStack("/a.jpg", ["/b.jpg", "/c.jpg"], 7);
    const imgs = stack.querySelectorAll("img");
    expect(imgs.length).toBe(3);
    // Back layers append first (highest offset first), front card last
    expect(imgs[0].getAttribute("src")).toBe("/c.jpg");
    expect(imgs[1].getAttribute("src")).toBe("/b.jpg");
    const badge = stack.lastElementChild!;
    expect(badge.textContent).toBe("+4");
  });

  it("shows no badge when 2 or 3 selected", () => {
    const stack = buildDragStack("/a.jpg", ["/b.jpg"], 2);
    expect(stack.querySelectorAll("img").length).toBe(2);
    expect(stack.lastElementChild?.textContent).not.toContain("+");
  });

  it("falls back to plain cards when back thumbnails missing", () => {
    const stack = buildDragStack("/a.jpg", [], 3);
    expect(stack.querySelectorAll("img").length).toBe(1);
  });
});

describe("THUMB_URL", () => {
  it("builds thumb URL from file path", () => {
    expect(THUMB_URL("u1/x.jpg")).toBe("/api/v1/media/files/u1/x.jpg?thumb=1");
  });
});
