import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { sidecarEmbedImage } from "@/services/ai/sidecar-client";
import { AiEmbedImageSchema } from "../schemas";
import { getUserPaths } from "@/services/db/multitenant";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`ai:embed-image:${session.user.id}`, 10, 60_000);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const parsed = AiEmbedImageSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const { filePath, variant } = parsed.data;
    const absolutePath = path.resolve(filePath);
    const userPaths = await getUserPaths(session.user.id);
    const userMediaDir = path.resolve(userPaths.mediaDir);
    if (!absolutePath.startsWith(userMediaDir + path.sep) && absolutePath !== userMediaDir) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const result = await sidecarEmbedImage(absolutePath, variant);
    return NextResponse.json({ embedding: result.embedding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to embed image";
    logger.error("AI embed image failed", { error: message });
    return NextResponse.json({ error: "AI sidecar unreachable" }, { status: 502 });
  }
}
