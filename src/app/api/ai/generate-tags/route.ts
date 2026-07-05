import { NextResponse } from "next/server";
import path from "path";
import { sidecarGenerateTags } from "@/services/ai/sidecar-client";
import { withSidecarProxy } from "../_lib";
import { AiGenerateTagsSchema } from "../schemas";
import { getUserPaths } from "@/services/db/multitenant";
import { getEffectiveAIConfig } from "@/features/settings/services/aiConfig";

export const POST = withSidecarProxy({
  rateLimit: ["ai:generate-tags", 10, 60_000],
  schema: AiGenerateTagsSchema,
  label: "AI generate tags failed",
  onError: () => NextResponse.json({ error: "AI sidecar unreachable" }, { status: 502 }),
  handler: async ({ session, data }) => {
    const { filePath, variant, tagThreshold } = data;
    const absolutePath = path.resolve(filePath);
    const userPaths = await getUserPaths(session.user.id);
    const userMediaDir = path.resolve(userPaths.mediaDir);
    if (!absolutePath.startsWith(userMediaDir + path.sep) && absolutePath !== userMediaDir) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const aiCfg = await getEffectiveAIConfig();
    const customTaxonomy = aiCfg.success ? aiCfg.config.customTaxonomy : undefined;

    const result = await sidecarGenerateTags(absolutePath, variant, tagThreshold, customTaxonomy);
    return NextResponse.json({ tags: result.tags });
  },
});
