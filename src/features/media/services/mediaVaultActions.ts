"use server";

import { media } from "@/services/db/schema";
import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getContext } from "./mediaContext";
import { safeAction } from "@/core/utils/action";

/**
 * Toggle whether a media item is in the Vault or normal Library
 */
export async function toggleVaultAction(id: string) {
 return safeAction("ToggleVaultAction", async () => {
 const { db } = await getContext();
 const [item] = await db.select().from(media).where(eq(media.id, id)).limit(1);
 if (!item) throw new Error("Item not found");

 const newVal = !item.isVault;
 await db.update(media)
 .set({ isVault: newVal, updatedAt: new Date() })
 .where(eq(media.id, id));

 revalidatePath("/dashboard");
 revalidatePath("/dashboard/vault");
 return { isVault: newVal };
 });
}

/**
 * Bulk move items in or out of the Vault
 */
export async function bulkSetVaultAction(ids: string[], isVault: boolean) {
 return safeAction("BulkSetVaultAction", async () => {
 const { db } = await getContext();

 await db.update(media)
 .set({ isVault, updatedAt: new Date() })
 .where(inArray(media.id, ids));

 revalidatePath("/dashboard");
 revalidatePath("/dashboard/vault");
 return { count: ids.length };
 });
}
