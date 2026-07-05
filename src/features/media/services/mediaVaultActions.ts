"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";

interface MediaItem {
  isVault: boolean;
}

export async function toggleVaultAction(id: string) {
  return safeAction("ToggleVaultAction", async () => {
    const item = await goFetch<MediaItem>(`/api/v1/media/${id}`);
    const newVal = !item.isVault;
    await goFetch("/api/v1/media/bulk/vault", {
      method: "POST",
      body: { media_ids: [id], is_vault: newVal },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vault");
    return { isVault: newVal };
  });
}

export async function bulkSetVaultAction(ids: string[], isVault: boolean) {
  return safeAction("BulkSetVaultAction", async () => {
    await goFetch("/api/v1/media/bulk/vault", {
      method: "POST",
      body: { media_ids: ids, is_vault: isVault },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vault");
    return { count: ids.length };
  });
}
