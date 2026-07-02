"use server";

import { media } from "@/services/db/schema";
import { eq, and, lt, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
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
 const { db } = await getContext();
 await db.update(media)
 .set({ isTrash: true, updatedAt: new Date() })
 .where(inArray(media.id, ids));

 revalidatePath("/dashboard");
 return {};
 });
}

export async function restoreFromTrashAction(id: string) {
 return safeAction("RestoreFromTrashAction", async () => {
 const { db } = await getContext();
 await db.update(media)
 .set({ isTrash: false, updatedAt: new Date() })
 .where(eq(media.id, id));

 revalidatePath("/dashboard");
 return {};
 });
}

export async function emptyTrashAction() {
 return safeAction("EmptyTrashAction", async () => {
 const { db, paths } = await getContext();

 const trashedItems = await db.select().from(media).where(eq(media.isTrash, true));
 if (trashedItems.length === 0) return { count: 0 };

 const hashesToDelete = trashedItems.map(item => item.hash);

 // find files still in use outside trash so we don't nuke their assets
 const activeHashes = await db.select({ hash: media.hash })
 .from(media)
 .where(and(
 inArray(media.hash, hashesToDelete),
 eq(media.isTrash, false)
 ));

 const activeHashSet = new Set(activeHashes.map(r => r.hash));
 const deletedHashes = new Set<string>();

let count = 0;
	for (const item of trashedItems) {
	await db.delete(media).where(eq(media.id, item.id));
	if (!activeHashSet.has(item.hash) && !deletedHashes.has(item.hash)) {
	const fullPath = path.join(paths.mediaDir, item.filePath);
	try {
	await fs.unlink(fullPath);
	deletedHashes.add(item.hash);
	} catch (err) {
	logger.warn("EmptyTrash unable to delete file", { fullPath, error: String(err) });
	}
	}
	count++;
	}

	revalidatePath("/dashboard");
	revalidatePath("/dashboard/trash");
	return { count };
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
