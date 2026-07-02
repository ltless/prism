/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";
import { NextRequest } from "next/server";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "test-user-id", role: "standard" } })),
}));

function makeMockDb(items: any[]) {
  const calls: { limit?: number; offset?: number } = {};
  const chain: any = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: (n: number) => {
      calls.limit = n;
      return chain;
    },
    offset: (n: number) => {
      calls.offset = n;
      return chain;
    },
    all: () => items,
  };
  return { db: chain, calls };
}

let lastCalls: { limit?: number; offset?: number } = {};

vi.mock("@/services/db/multitenant", () => ({
  getUserDb: vi.fn(async () => {
    const mock = makeMockDb([{ id: "a" }, { id: "b" }]);
    lastCalls = mock.calls;
    return { db: mock.db };
  }),
}));

function req(url: string) {
  return new NextRequest(url, { method: "GET" });
}

describe("media list pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastCalls = {};
  });

  it("returns 401 when unauthenticated", async () => {
    const authModule = await import("@/auth");
    vi.mocked(authModule.auth).mockResolvedValueOnce(null as any);

    const response = await GET(req("http://localhost/api/media/list"));
    expect(response.status).toBe(401);
  });

  it("honors page + limit from query params", async () => {
    const response = await GET(req("http://localhost/api/media/list?page=2&limit=10"));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.items).toHaveLength(2);
    expect(lastCalls.limit).toBe(10);
    expect(lastCalls.offset).toBe(10);
  });

  it("clamps an absurd limit down to the cap", async () => {
    const response = await GET(req("http://localhost/api/media/list?page=1&limit=999999"));
    expect(response.status).toBe(200);
    expect(lastCalls.limit).toBeLessThanOrEqual(200);
    expect(lastCalls.offset).toBe(0);
  });

  it("defaults to page 1 when no params given", async () => {
    const response = await GET(req("http://localhost/api/media/list"));
    expect(response.status).toBe(200);
    expect(lastCalls.limit).toBe(60);
    expect(lastCalls.offset).toBe(0);
  });
});
