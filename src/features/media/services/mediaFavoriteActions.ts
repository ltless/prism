"use server";

import { media } from "@/services/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";

/**
 * Resolve duplicates by keeping one and trashing others
 */
export async function resolveDuplicateAction(keepId: string, trashIds: string[]) {
 return safeAction("ResolveDuplicateAction", async () => {
 const { db } = await getContext();

 if (trashIds.length > 0) {
 await db.update(media)
 .set({ isTrash: true, updatedAt: new Date() })
 .where(inArray(media.id, trashIds));
 }

 await db.update(media)
 .set({ isTrash: false, updatedAt: new Date() })
 .where(eq(media.id, keepId));

 revalidatePath("/dashboard");
 revalidatePath("/dashboard/duplicates");
 return {};
 });
}

/**
 * Toggle favorite status of a media item
 */
export async function toggleFavoriteAction(id: string) {
 return safeAction("ToggleFavoriteAction", async () => {
 const { db } = await getContext();
 const [item] = await db.select().from(media).where(eq(media.id, id)).limit(1);
 if (!item) throw new Error("Item not found");

 const newVal = !item.isFavorite;
 await db.update(media)
 .set({ isFavorite: newVal, updatedAt: new Date() })
 .where(eq(media.id, id));

 revalidatePath("/dashboard");
 revalidatePath("/dashboard/duplicates");
 revalidatePath("/dashboard/trash");
 return { isFavorite: newVal };
 });
}

export async function bulkSetFavoriteAction(ids: string[], isFavorite: boolean) {
 return safeAction("BulkSetFavoriteAction", async () => {
 const { db } = await getContext();

 await db.update(media)
 .set({ isFavorite, updatedAt: new Date() })
 .where(inArray(media.id, ids));

 revalidatePath("/dashboard");
 revalidatePath("/dashboard/duplicates");
 revalidatePath("/dashboard/trash");
 return { count: ids.length };
 });
}
