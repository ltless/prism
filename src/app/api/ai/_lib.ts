import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import type { ZodType } from "zod";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

type AuthedSession = { user: { id: string; role: string } };

interface SidecarProxyOptions<T> {
  rateLimit: [key: string, limit: number, windowMs: number];
  admin?: boolean;
  schema?: ZodType<T>;
  badRequestMessage?: string;
  label?: string;
  onError?: (message: string) => NextResponse;
  handler: (ctx: { session: AuthedSession; request?: NextRequest; data: T }) => Promise<NextResponse>;
}

export function withSidecarProxy<T = undefined>(options: SidecarProxyOptions<T>) {
  const {
    rateLimit: [rlKey, rlLimit, rlWindow],
    admin = false,
    schema,
    badRequestMessage,
    label = rlKey,
    onError = (message) => NextResponse.json({ error: message }, { status: 502 }),
    handler,
  } = options;

  return async (request?: NextRequest): Promise<NextResponse> => {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (admin && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rl = await rateLimit(`${rlKey}:${session.user.id}`, rlLimit, rlWindow);
    if (!rl.success) return rateLimitResponse(rl.reset);

    try {
      let data: T | undefined;
      if (schema && request) {
        const body = await request.json();
        const parsed = schema.safeParse(body);
        if (!parsed.success) {
          const message = badRequestMessage ?? parsed.error.issues.map((i) => i.message).join(", ");
          return NextResponse.json({ error: message }, { status: 400 });
        }
        data = parsed.data;
      }
      return await handler({ session: session as AuthedSession, request, data: data as T });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      logger.error(label, { error: message });
      return onError(message);
    }
  };
}
