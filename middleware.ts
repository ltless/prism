import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isDev = process.env.NODE_ENV === "development";

// Rate limiting lives in Go (backend/internal/middleware/ratelimit.go).
// Duplicating it here is pointless: an in-memory Map dies on restart, is
// per-instance, and every /api/v1 request already passes through the Go
// limiter via the Next rewrite.

// Nonce-based CSP: 'unsafe-inline' in production would neutralize XSS
// mitigation, so every request gets a fresh nonce. Next.js reads the
// x-nonce request header and applies it to its inline bootstrap scripts
// (App Router pattern from the Next 16 CSP guide).
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    isDev
      ? `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
      : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    // style-src 'unsafe-inline' is a deliberate, separate tradeoff — inline
    // styles are a much weaker XSS vector and Next/Tailwind rely on them.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' ws: wss:",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
}

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

  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  response.headers.set("Content-Security-Policy", csp);
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
