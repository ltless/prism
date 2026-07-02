import { auth } from "@/auth";
import { db as globalDb } from "@/services/db";
import { users } from "@/services/db/schema";
import { eq } from "drizzle-orm";
import { getUserDb } from "@/services/db/multitenant";
import { NextRequest, NextResponse } from "next/server";
import { processMediaUpload } from "@/services/media/upload";
import { getUserPaths } from "@/services/db/multitenant";
import { getEffectiveAIConfig } from "@/features/settings/services/aiConfig";
import { processUploadAI } from "@/services/ai/sidecar-inference";
import { enqueueTranscodeJob } from "@/services/video/queue";
import { formatBytes } from "@/core/utils/format";
import { logger } from "@/core/utils/logger";
import { effectiveStorageLimit, getGlobalStorageDefaultBytes } from "@/features/settings/services/storageQuota";
import path from "path";

export async function POST(request: NextRequest) {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) return new Response("Unauthorized", { status: 401 });

 try {
 const formData = await request.formData();
 const file = formData.get("file") as File;
 if (!file) throw new Error("No file uploaded");

  // Check storage limit (effective: per-user explicit > admin unlimited > global default)
  const user = globalDb.select({ storageLimit: users.storageLimit, role: users.role }).from(users).where(eq(users.id, userId)).limit(1).get();
  const storageLimit = effectiveStorageLimit(user?.role, user?.storageLimit ?? null, getGlobalStorageDefaultBytes(globalDb));
  if (storageLimit !== null) {
 const { sqlite } = await getUserDb(userId);
 const row = sqlite.prepare("SELECT COALESCE(SUM(size), 0) as total FROM media").get() as { total: number };
 if (row.total + file.size > storageLimit) {
 return NextResponse.json({ success: false, error: `Storage limit exceeded (${formatBytes(storageLimit)})` }, { status: 413 });
 }
 }

 const { db, paths } = await getUserDb(userId);
 const { thumbDir } = await getUserPaths(userId);

 const result = await processMediaUpload(file, db, paths.mediaDir, thumbDir);
 if (!result.success) {
 return NextResponse.json({ success: false, error: result.error }, { status: 400 });
 }

 // Enqueue video transcode job if applicable
 if (!result.filename) throw new Error("upload returned no filename");
 if (result.isVideo && result.hash && result.mediaId) {
 enqueueTranscodeJob({
 userId,
 mediaId: result.mediaId,
 inputPath: path.join(paths.mediaDir, result.filename),
 outputDir: paths.mediaDir,
 thumbDir,
 dbPath: paths.dbPath,
 hash: result.hash,
 storageLimit,
 });
 }

 // Enqueue AI processing for images
 const aiCfg = await getEffectiveAIConfig();
 if (!aiCfg.success) {
 logger.warn("AI config load failed, skipping AI processing", { error: aiCfg.error });
 return NextResponse.json({
 success: true,
 isDuplicate: result.isDuplicate,
 filename: result.filename,
 mediaId: result.mediaId,
 aiStatus: "skipped",
 });
 }

 const aiEnabled = aiCfg.config.isEnabled;
 logger.info("Upload", { file: file.name, variant: aiCfg.config.variant });

  if (aiEnabled && result.filename && result.mediaId && !result.isVideo) {
    // fire-and-forget: sidecar does tag+score in the background.
    // upload response returns immediately. ai metadata lands when it lands.
    void processUploadAI({
      db,
      mediaDir: paths.mediaDir,
      mediaId: result.mediaId,
      filename: result.filename,
      variant: aiCfg.config.variant,
      tagThreshold: aiCfg.config.tagThreshold,
      aestheticEnabled: aiCfg.config.aestheticEnabled,
      aestheticModel: aiCfg.config.aestheticModel || "clip",
      autoFavoriteEnabled: aiCfg.config.autoFavoriteEnabled,
      autoFavoriteThreshold: aiCfg.config.autoFavoriteThreshold,
      customTaxonomy: aiCfg.config.customTaxonomy,
    }).catch((err) => {
      logger.error("sidecar.upload.fire-forget.fail", {
        mediaId: result.mediaId,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

 return NextResponse.json({
 success: true,
 isDuplicate: result.isDuplicate,
 filename: result.filename,
 mediaId: result.mediaId,
 isVideo: result.isVideo,
 aiStatus: aiEnabled && !result.isVideo ? "pending" : "skipped",
 transcodeStatus: result.isVideo ? "pending" : "skipped",
 });
 } catch (error: unknown) {
 logger.error("Upload API error", { error: String(error) });
 return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
 }
}
