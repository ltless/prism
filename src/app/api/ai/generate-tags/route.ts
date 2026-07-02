import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { sidecarGenerateTags } from "@/services/ai/sidecar-client";
import { AiGenerateTagsSchema } from "../schemas";
import { getUserPaths } from "@/services/db/multitenant";
import { getEffectiveAIConfig } from "@/features/settings/services/aiConfig";
import { logger } from "@/core/utils/logger";
import { rateLimit, rateLimitResponse } from "@/core/utils/rateLimit";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(`ai:generate-tags:${session.user.id}`, 10, 60_000);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const body = await request.json();
    const parsed = AiGenerateTagsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues.map(i => i.message).join(", ") }, { status: 400 });
    }

    const { filePath, variant, tagThreshold } = parsed.data;
    const absolutePath = path.resolve(filePath);
    const userPaths = await getUserPaths(session.user.id);
    const userMediaDir = path.resolve(userPaths.mediaDir);
    if (!absolutePath.startsWith(userMediaDir + path.sep) && absolutePath !== userMediaDir) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Fetch custom taxonomy so the sidecar uses the admin's tag candidate list.
    const aiCfg = await getEffectiveAIConfig();
    const customTaxonomy = aiCfg.success ? aiCfg.config.customTaxonomy : undefined;

    const result = await sidecarGenerateTags(absolutePath, variant, tagThreshold, customTaxonomy);
    return NextResponse.json({ tags: result.tags });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate tags";
    logger.error("AI generate tags failed", { error: message });
    return NextResponse.json({ error: "AI sidecar unreachable" }, { status: 502 });
  }
}
