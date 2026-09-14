import { describe, it, expect, vi, beforeEach } from "vitest";

// next/server needs an edge-ish runtime; stub the pieces the middleware uses.
vi.mock("next/server", () => {
  class NextResponseStub extends Response {
    // middleware calls static methods and `new NextResponse(...)` (csrfError)
    static next() {
      return new NextResponseStub(null, { status: 200 });
    }
    static redirect(url: string | URL, status = 302) {
      return new NextResponseStub(null, { status, headers: { Location: String(url) } });
    }
    static json(body: unknown, init: ResponseInit) {
      return new NextResponseStub(JSON.stringify(body), {
        ...init,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
    }
  }
  return { NextResponse: NextResponseStub };
});

import { middleware } from "../../middleware";

type Req = {
  method: string;
  url: string;
  headers: Record<string, string>;
  cookies: { has: (name: string) => boolean };
};

function makeHeaders(h: Record<string, string>) {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(h)) lower[k.toLowerCase()] = v;
  return {
    get: (name: string) => lower[name.toLowerCase()] ?? null,
  };
}

function makeRequest(overrides: Partial<Req> = {}): Req {
  const url = overrides.url ?? "http://localhost:3000/dashboard";
  const raw = overrides.headers ?? { host: "localhost:3000" };
  const headers = makeHeaders(raw);
  return {
    method: overrides.method ?? "GET",
    url,
    headers: headers as unknown as Record<string, string>,
    cookies: { has: (name: string) => raw.cookie?.includes(name) ?? false },
  } as Req;
}

// nextUrl isn't on our plain object; middleware reads request.nextUrl.pathname.
function withNextUrl(req: Req, pathname: string) {
  (req as unknown as { nextUrl: { pathname: string } }).nextUrl = { pathname };
  return req;
}

beforeEach(() => {
  vi.resetModules();
});

describe("CSRF origin check in middleware", () => {
  const MUTATING = ["POST", "PUT", "PATCH", "DELETE"];

  it.each(MUTATING)("rejects %s to /api/v1/* with forged cross-origin Origin", (method) => {
    const req = withNextUrl(
      makeRequest({
        method,
        url: "http://localhost:3000/api/v1/media/bulk/trash",
        headers: {
          host: "localhost:3000",
          origin: "https://evil.attacker.example",
        },
      }),
      "/api/v1/media/bulk/trash"
    );
    const res = middleware(req as never);
    expect(res.status).toBe(403);
  });

  it("allows same-origin POST to /api/v1/media/bulk/trash", () => {
    const req = withNextUrl(
      makeRequest({
        method: "POST",
        url: "http://localhost:3000/api/v1/media/bulk/trash",
        headers: { host: "localhost:3000", origin: "http://localhost:3000" },
      }),
      "/api/v1/media/bulk/trash"
    );
    const res = middleware(req as never);
    expect(res.status).not.toBe(403);
  });

  it("allows same-origin referer when Origin is absent", () => {
    const req = withNextUrl(
      makeRequest({
        method: "POST",
        url: "http://localhost:3000/api/v1/auth/login",
        headers: { host: "localhost:3000", referer: "http://localhost:3000/login" },
      }),
      "/api/v1/auth/login"
    );
    const res = middleware(req as never);
    expect(res.status).not.toBe(403);
  });

  it("rejects POST to /api/v1/* with neither Origin nor Referer", () => {
    const req = withNextUrl(
      makeRequest({
        method: "POST",
        url: "http://localhost:3000/api/v1/auth/login",
        headers: { host: "localhost:3000" },
      }),
      "/api/v1/auth/login"
    );
    const res = middleware(req as never);
    expect(res.status).toBe(403);
  });

  it("rejects cross-origin referer fallback on /api/v1/*", () => {
    const req = withNextUrl(
      makeRequest({
        method: "POST",
        url: "http://localhost:3000/api/v1/auth/login",
        headers: { host: "localhost:3000", referer: "https://evil.example/login" },
      }),
      "/api/v1/auth/login"
    );
    const res = middleware(req as never);
    expect(res.status).toBe(403);
  });

  it("does not run CSRF check on GET requests", () => {
    const req = withNextUrl(
      makeRequest({ method: "GET", url: "http://localhost:3000/api/v1/media" }),
      "/api/v1/media"
    );
    const res = middleware(req as never);
    expect(res.status).not.toBe(403);
  });

  it("still rejects cross-origin POST on non-/api/v1 Next.js routes", () => {
    const req = withNextUrl(
      makeRequest({
        method: "POST",
        url: "http://localhost:3000/some-action",
        headers: { host: "localhost:3000", origin: "https://evil.example" },
      }),
      "/some-action"
    );
    const res = middleware(req as never);
    expect(res.status).toBe(403);
  });
});
