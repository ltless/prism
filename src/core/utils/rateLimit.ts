import { NextRequest, NextResponse } from "next/server";

const store = new Map<string, { count: number; resetTime: number }>();

export async function rateLimit(
  reqOrKey: NextRequest | string,
  limit: number = 10,
  windowMs: number = 60 * 1000
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  // Mirror of the Go rate limiter's TRUST_PROXY rule: only honor
  // X-Forwarded-For when the operator opted in.
  const key =
    typeof reqOrKey === "string"
      ? reqOrKey
      : `${reqOrKey.nextUrl.pathname}:${
          process.env.TRUST_PROXY === "true"
            ? reqOrKey.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous"
            : "anonymous"
        }`;

  const now = Date.now();

  // Sweep expired entries, then hard-evict the soonest-expiring if still
  // over cap — expired-only sweeps let a live-key flood grow the Map forever.
  if (store.size > 1000) {
    for (const [k, r] of store) {
      if (now > r.resetTime) store.delete(k);
    }
    if (store.size > 1000) {
      const oldest = [...store.entries()].sort((a, b) => a[1].resetTime - b[1].resetTime);
      for (let i = 0; i < 100 && store.size > 900; i++) {
        store.delete(oldest[i][0]);
      }
    }
  }

  const record = store.get(key);

 if (!record || now > record.resetTime) {
 store.set(key, { count: 1, resetTime: now + windowMs });
 return { success: true, limit, remaining: limit - 1, reset: now + windowMs };
 }

 record.count++;

 if (record.count > limit) {
 return { success: false, limit, remaining: 0, reset: record.resetTime };
 }

 return { success: true, limit, remaining: limit - record.count, reset: record.resetTime };
}

function rateLimitResponse(reset: number) {
 return new NextResponse(
 JSON.stringify({ error: "Too many requests. Please try again later." }),
 {
 status: 429,
 headers: {
 "Content-Type": "application/json",
 "Retry-After": Math.ceil((reset - Date.now()) / 1000).toString(),
 },
 }
 );
}
