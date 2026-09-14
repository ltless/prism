import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

const RATE_LIMITS = [
  { prefix: "/api/auth", limit: 10_000, window: 60_000 },
  { prefix: "/api/media/upload", limit: 10_000, window: 60_000 },
  { prefix: "/api/media/ai-status", limit: 10_000, window: 60_000 },
  { prefix: "/api/media/transcode-status", limit: 10_000, window: 60_000 },
  { prefix: "/api/media", limit: 10_000, window: 60_000 },
  { prefix: "/api/ai", limit: 10_000, window: 60_000 },
  { prefix: "/api/system", limit: 10_000, window: 60_000 },
  { prefix: "/api/log", limit: 10_000, window: 60_000 },
  { prefix: "/api/health", limit: 10_000, window: 60_000 },
  { prefix: "/login", limit: 10_000, window: 60_000 },
  { prefix: "/register", limit: 10_000, window: 60_000 },
];

const ipCounters = new Map<string, { count: number; resetAt: number }>();

// Mirror of the Go rate limiter's TRUST_PROXY rule (backend/internal/middleware/ratelimit.go):
// only honor X-Forwarded-For when the operator opted in — otherwise attackers
// rotate the header to mint unlimited rate-limit keys.
function clientIp(request: NextRequest): string {
  const xff = request.headers.get("x-forwarded-for");
  if (process.env.TRUST_PROXY === "true" && xff) {
    return xff.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "anonymous";
}

function getRateLimitConfig(pathname: string) {
  return RATE_LIMITS.find((r) => pathname.startsWith(r.prefix));
}

const CSP = [
  "default-src 'self'",
  isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth gating for protected routes
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/editor");
  if (isProtected && !request.cookies.has("auth_token")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect logged-in users away from login
  if (pathname === "/login" && request.cookies.has("auth_token")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // CSRF: same-origin browser fetches send Origin or Referer. no Origin AND
  // no Referer = something shady. reject it. Applies to ALL mutating
  // requests, including /api/v1/* (rewritten to the Go backend) — SameSite
  // cookies alone are not enough defense.
  if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = request.headers.get("host");

    const isValidOrigin = (url: string) => {
      try {
        return new URL(url).host === host;
      } catch {
        return false;
      }
    };

    if (!origin && !referer) {
      return csrfError();
    }

    if (origin && !isValidOrigin(origin)) {
      return csrfError();
    }

    if (!origin && referer && !isValidOrigin(referer)) {
      return csrfError();
    }
  }

  // rate limit — 10000 per minute per endpoint. basically "please don't spam".
  const rlConfig = getRateLimitConfig(pathname);
  if (rlConfig) {
    const key = `${rlConfig.prefix}:${clientIp(request)}`;
    const now = Date.now();

    // Sweep expired entries, then hard-evict the soonest-expiring if still
    // over cap — expired-only sweeps let a live-key flood grow the Map forever.
    if (ipCounters.size > 1000) {
      for (const [k, v] of ipCounters.entries()) {
        if (now > v.resetAt) {
          ipCounters.delete(k);
        }
      }
      if (ipCounters.size > 1000) {
        const oldest = [...ipCounters.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt);
        for (let i = 0; i < 100 && ipCounters.size > 900; i++) {
          ipCounters.delete(oldest[i][0]);
        }
      }
    }

    const record = ipCounters.get(key);

    if (!record || now > record.resetAt) {
      ipCounters.set(key, { count: 1, resetAt: now + rlConfig.window });
    } else {
      record.count++;
      if (record.count > rlConfig.limit) {
        const retryAfter = Math.ceil((record.resetAt - now) / 1000);
        return new NextResponse(
          JSON.stringify({ error: "Too many requests. Please try again later." }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": String(retryAfter),
            },
          }
        );
      }
    }
  }

  return response;
}

function csrfError() {
  return new NextResponse(
    JSON.stringify({ error: "CSRF validation failed" }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/media/upload).*)"],
};
