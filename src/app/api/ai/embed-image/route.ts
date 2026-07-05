import { NextResponse } from "next/server";
import path from "path";
import { sidecarEmbedImage } from "@/services/ai/sidecar-client";
import { withSidecarProxy } from "../_lib";
import { AiEmbedImageSchema } from "../schemas";
import { getUserPaths } from "@/services/db/multitenant";

export const POST = withSidecarProxy({
  rateLimit: ["ai:embed-image", 10, 60_000],
  schema: AiEmbedImageSchema,
  label: "AI embed image failed",
  onError: () => NextResponse.json({ error: "AI sidecar unreachable" }, { status: 502 }),
  handler: async ({ session, data }) => {
    const { filePath, variant } = data;
    const absolutePath = path.resolve(filePath);
    const userPaths = await getUserPaths(session.user.id);
    const userMediaDir = path.resolve(userPaths.mediaDir);
    if (!absolutePath.startsWith(userMediaDir + path.sep) && absolutePath !== userMediaDir) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const result = await sidecarEmbedImage(absolutePath, variant);
    return NextResponse.json({ embedding: result.embedding });
  },
});
