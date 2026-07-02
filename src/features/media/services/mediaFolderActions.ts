"use server";

import { media, folders } from "@/services/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import crypto from "crypto";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";
import { FOLDER_COLORS } from "@/core/constants";
import { SmartFolderFilterSchema } from "../schemas";
import type { SmartFolderFilter } from "../types";

/**
 * Create a new folder
 */
export async function createFolderAction(name: string, color: string = "zinc") {
 return safeAction("CreateFolderAction", async () => {
 const trimmedName = name.trim();
 if (trimmedName.length === 0 || trimmedName.length > 100) {
 throw new Error("Folder name must be 1-100 characters");
 }
 if (!(color in FOLDER_COLORS)) {
 throw new Error("Invalid folder color");
 }

 const { db } = await getContext();
 await db.insert(folders).values({
 id: crypto.randomUUID(),
 name: trimmedName,
 color,
 createdAt: new Date(),
 });
 revalidatePath("/dashboard");
 return {};
 });
}

export async function createSmartFolderAction(
  name: string,
  color: string = "violet",
  filter: SmartFolderFilter
) {
  return safeAction("CreateSmartFolderAction", async () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw new Error("Folder name must be 1-100 characters");
    }
    if (!(color in FOLDER_COLORS)) {
      throw new Error("Invalid folder color");
    }
    const parsed = SmartFolderFilterSchema.safeParse(filter);
    if (!parsed.success) {
      throw new Error("Invalid smart folder filter");
    }
    const { db } = await getContext();
    await db.insert(folders).values({
      id: crypto.randomUUID(),
      name: trimmedName,
      color,
      folderType: "smart",
      filterQuery: JSON.stringify(parsed.data),
      createdAt: new Date(),
    });
    revalidatePath("/dashboard");
    return {};
  });
}

/**
 * Delete a folder
 */
export async function deleteFolderAction(id: string) {
 return safeAction("DeleteFolderAction", async () => {
 const { db } = await getContext();
 await db.update(media)
 .set({ folderId: null, updatedAt: new Date() })
 .where(eq(media.folderId, id));

 await db.delete(folders).where(eq(folders.id, id));

 revalidatePath("/dashboard");
 return {};
 });
}

/**
 * Rename a folder
 */
export async function renameFolderAction(id: string, name: string) {
  return safeAction("RenameFolderAction", async () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw new Error("Folder name must be 1-100 characters");
    }
    const { db } = await getContext();
    await db.update(folders)
      .set({ name: trimmedName })
      .where(eq(folders.id, id));

    revalidatePath("/dashboard");
    return {};
  });
}

/**
 * Move media items to a folder
 */
export async function moveMediaToFolderAction(mediaIds: string[], folderId: string | null) {
 if (mediaIds.length === 0) return { success: true as const };
 return safeAction("MoveMediaToFolderAction", async () => {
 const { db } = await getContext();
 await db.update(media)
 .set({ folderId, updatedAt: new Date() })
 .where(inArray(media.id, mediaIds));

 revalidatePath("/dashboard");
 return {};
 });
}
