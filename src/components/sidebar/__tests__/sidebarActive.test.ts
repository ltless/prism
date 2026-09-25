import { describe, expect, it } from "vitest";

/** Mirrors SidebarNavItem active rule. Folder views must not light up Library. */
function isNavActive(opts: {
  pathname: string;
  viewParam: string | null;
  activeFolderId: string | null;
  itemPath: string;
}) {
  const itemPathBase = opts.itemPath.split("?")[0];
  const itemView = opts.itemPath.split("v=")[1];
  return itemView
    ? opts.pathname === itemPathBase && opts.viewParam === itemView
    : opts.pathname === opts.itemPath && !opts.activeFolderId && !opts.viewParam;
}

describe("sidebar nav active", () => {
  it("library is active only on plain /dashboard", () => {
    expect(isNavActive({
      pathname: "/dashboard",
      viewParam: null,
      activeFolderId: null,
      itemPath: "/dashboard",
    })).toBe(true);
  });

  it("library stays inactive inside a folder or a view", () => {
    expect(isNavActive({
      pathname: "/dashboard",
      viewParam: null,
      activeFolderId: "abc",
      itemPath: "/dashboard",
    })).toBe(false);
    expect(isNavActive({
      pathname: "/dashboard",
      viewParam: "recent",
      activeFolderId: null,
      itemPath: "/dashboard",
    })).toBe(false);
  });

  it("recent matches only its query", () => {
    expect(isNavActive({
      pathname: "/dashboard",
      viewParam: "recent",
      activeFolderId: null,
      itemPath: "/dashboard?v=recent",
    })).toBe(true);
    expect(isNavActive({
      pathname: "/dashboard",
      viewParam: "favorite",
      activeFolderId: null,
      itemPath: "/dashboard?v=recent",
    })).toBe(false);
  });
});
