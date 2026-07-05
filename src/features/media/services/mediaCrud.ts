"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { media, folders } from "@/services/db/schema";
import { eq } from "drizzle-orm";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";
import { logger } from "@/core/utils/logger";

export async function deleteMediaAction(id: string) {
  return safeAction("deleteMedia", async () => {
    await goFetch(`/api/v1/media/${id}`, {
      method: "DELETE",
    });
    revalidatePath("/dashboard");
    return {};
  });
}

export async function nukeLibraryAction(confirmToken?: string) {
  const expected = process.env.NUKE_CONFIRMATION_TOKEN;
  if (!expected) {
    return { success: false, error: "Nuke feature is disabled (no confirmation token configured)" };
  }
  const provided = confirmToken ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { success: false, error: "Invalid confirmation token" };
  }
  return safeAction("nukeLibrary", async () => {
  const { db, paths } = await getContext();

  await db.delete(media);
  await db.delete(folders);

  try {
await fs.rm(paths.mediaDir, { recursive: true, force: true });
      await fs.mkdir(paths.mediaDir, { recursive: true });
      await fs.mkdir(paths.thumbDir, { recursive: true });
  } catch (fsError) {
  logger.error("Nuke physical wipe failed", { error: String(fsError) });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/duplicates");
  revalidatePath("/dashboard/trash");

  return {};
  });
}

export async function updateMediaMetadataAction(filename: string, metadata: Record<string, unknown>) {
  return safeAction("updateMediaMetadata", async () => {
  const { db } = await getContext();
  const { name: hash } = path.parse(filename);

  await db.update(media)
  .set({ metadata, updatedAt: new Date() })
  .where(eq(media.hash, hash));

  revalidatePath("/dashboard");
  return {};
  });
}

export async function renameMediaAction(id: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) return { success: false, error: "Title cannot be empty" };

  return safeAction("renameMedia", async () => {
    await goFetch(`/api/v1/media/${id}`, {
      method: "PATCH",
      body: { title: trimmed },
    });
    revalidatePath("/dashboard");
    return {};
  });
}
