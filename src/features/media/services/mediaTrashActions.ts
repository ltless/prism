"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { media } from "@/services/db/schema";
import { eq, and, lt } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import { SECURITY } from "@/core/constants";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";
import { logger } from "@/core/utils/logger";

export async function moveToTrashAction(id: string) {
  return bulkMoveToTrashAction([id]);
}

export async function bulkMoveToTrashAction(ids: string[]) {
  if (ids.length === 0) return { success: true as const };
  return safeAction("BulkMoveToTrashAction", async () => {
    await goFetch("/api/v1/media/bulk/trash", {
      method: "POST",
      body: { media_ids: ids },
    });
    revalidatePath("/dashboard");
    return {};
  });
}

export async function restoreFromTrashAction(id: string) {
  return safeAction("RestoreFromTrashAction", async () => {
    await goFetch("/api/v1/media/bulk/restore", {
      method: "POST",
      body: { media_ids: [id] },
    });
    revalidatePath("/dashboard");
    return {};
  });
}

export async function emptyTrashAction() {
  return safeAction("EmptyTrashAction", async () => {
    const result = await goFetch<{ deleted: number }>("/api/v1/media/empty-trash", {
      method: "POST",
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/trash");
    return { count: result.deleted };
  });
}

export async function runAutoCleanupAction() {
  return safeAction("RunAutoCleanupAction", async () => {
  const { db, paths } = await getContext();
    const TRASH_RETENTION_DAYS = SECURITY.RETENTION_DAYS;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - TRASH_RETENTION_DAYS);

    const expiredMedia = await db.select().from(media).where(
    and(
    eq(media.isTrash, true),
    lt(media.updatedAt, cutoffDate)
    )
    );

    let count = 0;
    for (const item of expiredMedia) {
      await db.delete(media).where(eq(media.id, item.id));
      const fullPath = path.join(paths.mediaDir, item.filePath);
      try {
        await fs.unlink(fullPath);
      } catch (err) {
        logger.warn("AutoCleanup could not delete physical file", { fullPath, error: String(err) });
      }
      count++;
    }

  if (count > 0) {
  revalidatePath("/dashboard");
  }

  return { cleanedCount: count };
  });
}
