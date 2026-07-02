"use server";

import { revalidatePath } from "next/cache";
import { goFetch, goFetchWithSetCookie, mirrorVaultCookie } from "@/lib/api";
import { safeAction } from "@/core/utils/action";
import { mediaListSchema } from "@/lib/apiSchemas";
import { mapMedia, type GoMedia } from "@/types/goApi";
import type { MediaItem } from "../types";

export async function toggleVaultAction(id: string, pin?: string) {
  return safeAction("ToggleVaultAction", async () => {
    const item = await goFetch<MediaItem>(`/api/v1/media/${id}`);
    const newVal = !item.isVault;
    await goFetch("/api/v1/media/bulk/vault", {
      method: "POST",
      body: { media_ids: [id], is_vault: newVal, ...(newVal ? {} : { pin }) },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vault");
    return { isVault: newVal };
  });
}

export async function bulkSetVaultAction(ids: string[], isVault: boolean, pin?: string) {
  return safeAction("BulkSetVaultAction", async () => {
    await goFetch("/api/v1/media/bulk/vault", {
      method: "POST",
      body: { media_ids: ids, is_vault: isVault, ...(isVault ? {} : { pin }) },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/vault");
    return { count: ids.length };
  });
}

// F1: vault items are fetched only after the PIN unlock cookie is in place;
// a 403 means the unlock token is stale, not a hard error.
export async function getVaultMediaAction() {
  return safeAction("getVaultMediaAction", async () => {
    try {
      const res = await goFetch<{ items: GoMedia[]; total: number }>(
        "/api/v1/media?vault=true",
        undefined,
        mediaListSchema,
      );
      return { items: res.items.map((m) => mapMedia(m)), total: res.total, locked: false };
    } catch (err) {
      if (err instanceof Error && err.message === "vault locked") {
        return { items: [], total: 0, locked: true };
      }
      throw err;
    }
  });
}

// F1: expire the unlock token server-side AND in the browser cookie, so
// auto-lock (idle / tab switch) actually revokes access, not just the UI.
export async function lockVaultAction() {
  return safeAction("lockVaultAction", async () => {
    const res = await goFetchWithSetCookie<{ success: boolean }>("/api/v1/users/me/vault-lock", {
      method: "DELETE",
    });
    await mirrorVaultCookie(res.setCookie);
    revalidatePath("/dashboard/vault");
    return {};
  });
}
