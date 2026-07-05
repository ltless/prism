"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";

interface MediaItem {
  isFavorite: boolean;
}

export async function resolveDuplicateAction(keepId: string, trashIds: string[]) {
  return safeAction("ResolveDuplicateAction", async () => {
    await goFetch("/api/v1/media/resolve-duplicate", {
      method: "POST",
      body: { keep_id: keepId, delete_ids: trashIds },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/duplicates");
    return {};
  });
}

export async function toggleFavoriteAction(id: string) {
  return safeAction("ToggleFavoriteAction", async () => {
    const item = await goFetch<MediaItem>(`/api/v1/media/${id}`);
    const newVal = !item.isFavorite;
    await goFetch("/api/v1/media/bulk/favorite", {
      method: "POST",
      body: { media_ids: [id], is_favorite: newVal },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/duplicates");
    revalidatePath("/dashboard/trash");
    return { isFavorite: newVal };
  });
}

export async function bulkSetFavoriteAction(ids: string[], isFavorite: boolean) {
  return safeAction("BulkSetFavoriteAction", async () => {
    await goFetch("/api/v1/media/bulk/favorite", {
      method: "POST",
      body: { media_ids: ids, is_favorite: isFavorite },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/duplicates");
    revalidatePath("/dashboard/trash");
    return { count: ids.length };
  });
}
