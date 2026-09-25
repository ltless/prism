import { describe, it, expect, vi, beforeEach } from "vitest";

// next/server needs an edge-ish runtime; stub the pieces the middleware uses.
vi.mock("next/server", () => {
  // jsdom's Response headers don't reliably round-trip .set(); use a plain
  // Map-backed Headers so tests can read what middleware set.
  class StubHeaders {
    private map = new Map<string, string>();
    constructor(init?: Record<string, string> | StubHeaders) {
      if (!init) return;
      if (init instanceof StubHeaders) {
        for (const [k, v] of init.map) this.map.set(k, v);
      } else {
        for (const [k, v] of Object.entries(init)) this.map.set(k, v);
      }
    }
    get(name: string) {
      return this.map.get(name.toLowerCase()) ?? null;
    }
    set(name: string, value: string) {
      this.map.set(name.toLowerCase(), value);
    }
    has(name: string) {
      return this.map.has(name.toLowerCase());
    }
  }
  class NextResponseStub {
    headers: StubHeaders = new StubHeaders();
    status: number;
    constructor(_body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      this.status = init.status ?? 200;
      if (init.headers) this.headers = new StubHeaders(init.headers);
    }
    static next(init?: { request?: { headers?: unknown } }) {
      const res = new NextResponseStub(null, { status: 200 });
      if (init?.request?.headers) {
        res.forwardedRequestHeaders = init.request.headers as StubHeaders;
      }
      return res;
    }
    static redirect(url: string | URL, status = 302) {
      return new NextResponseStub(null, {
        status,
        headers: { Location: String(url) },
      });
    }
    static json(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
      return new NextResponseStub(JSON.stringify(body), {
        status: init.status,
        headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      });
    }
    forwardedRequestHeaders?: StubHeaders;
  }
  return { NextResponse: NextResponseStub, NextRequest: class {} };
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
  // Object literal (not class instance) so `new Headers(request.headers)`
  // in the middleware can consume it as an init record; get() kept for
  // direct request.headers.get calls.
  return {
    ...lower,
    get: (name: string) => lower[name.toLowerCase()] ?? null,
    has: (name: string) => lower[name.toLowerCase()] !== undefined,
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

describe("CSP nonce in middleware", () => {
  function cspFor(req: Req) {
    const res = middleware(req as never) as unknown as {
      headers: { get(name: string): string | null };
    };
    return { header: res.headers.get("Content-Security-Policy"), res };
  }

  it("sets script-src with a nonce, no 'unsafe-inline' in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { middleware: mw } = await import("../../middleware");
    const req = withNextUrl(makeRequest({ url: "http://localhost:3000/login" }), "/login");
    const res = mw(req as never) as unknown as {
      headers: { get(name: string): string | null };
    };
    const csp = res.headers.get("Content-Security-Policy") ?? "";
    vi.resetModules();
    vi.unstubAllEnvs();

    expect(csp).toMatch(/script-src 'self' 'nonce-[0-9a-f]+' 'strict-dynamic'/);
    expect(csp).not.toContain("'unsafe-eval'");
  });

  it("limits connect-src to the same origin", () => {
    const { header } = cspFor(
      withNextUrl(makeRequest({ url: "http://localhost:3000/login" }), "/login")
    );
    expect(header).toContain("connect-src 'self'");
    expect(header).not.toMatch(/connect-src[^;]*\bws:/);
  });

  it("keeps style-src 'unsafe-inline' (separate, accepted tradeoff)", () => {
    const { header } = cspFor(
      withNextUrl(makeRequest({ url: "http://localhost:3000/login" }), "/login")
    );
    expect(header).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("generates a unique nonce per request and forwards x-nonce", () => {
    const reqA = withNextUrl(makeRequest({ url: "http://localhost:3000/login" }), "/login");
    const reqB = withNextUrl(makeRequest({ url: "http://localhost:3000/login" }), "/login");
    const resA = middleware(reqA as never) as unknown as {
      headers: { get(name: string): string | null };
      forwardedRequestHeaders?: Headers;
    };
    const resB = middleware(reqB as never) as unknown as {
      headers: { get(name: string): string | null };
    };
    const cspA = resA.headers.get("Content-Security-Policy") ?? "";
    const cspB = resB.headers.get("Content-Security-Policy") ?? "";
    const nonceA = cspA.match(/'nonce-([0-9a-f]+)'/)?.[1];
    const nonceB = cspB.match(/'nonce-([0-9a-f]+)'/)?.[1];

    expect(nonceA).toBeTruthy();
    expect(nonceA).not.toBe(nonceB);
    expect(resA.forwardedRequestHeaders?.get("x-nonce")).toBe(nonceA);
  });
});
