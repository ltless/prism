import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { sidecarEmbedText } from "@/services/ai/sidecar-client";
import { AiEmbedTextSchema } from "../schemas";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`ai:embed-text:${session.user.id}`, 30, 60_000);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const parsed = AiEmbedTextSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const result = await sidecarEmbedText(parsed.data.text, parsed.data.variant);
    return NextResponse.json({ embedding: result.embedding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to embed text";
    logger.error("AI embed text failed", { error: message });
    return NextResponse.json({ error: "AI sidecar unreachable" }, { status: 502 });
  }
}
