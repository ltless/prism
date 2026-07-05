"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";

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
    const result = await goFetch<{ deleted: number }>("/api/v1/media/auto-cleanup", {
      method: "POST",
    });
    revalidatePath("/dashboard");
    return { cleanedCount: result.deleted };
  });
}
