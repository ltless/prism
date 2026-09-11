"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";
import { FOLDER_COLORS } from "@/core/constants";
import { SMART_CATEGORIES } from "../utils/smartCategories";

export async function createFolderAction(name: string, color: string = "zinc", smart?: { categories: string[]; minScore: number }) {
  return safeAction("CreateFolderAction", async () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw new Error("Folder name must be 1-100 characters");
    }
    if (!(color in FOLDER_COLORS)) {
      throw new Error("Invalid folder color");
    }
    const body: Record<string, unknown> = { name: trimmedName, color, folder_type: "regular" };
    if (smart && smart.categories.length > 0) {
      const valid = smart.categories.filter(c => (SMART_CATEGORIES as readonly string[]).includes(c));
      if (valid.length === 0) throw new Error("No valid categories selected");
      const minScore = Math.min(Math.max(smart.minScore, 0), 1);
      body.folder_type = "smart";
      body.filter_query = JSON.stringify({ categories: valid, minScore });
    }
    await goFetch("/api/v1/folders", {
      method: "POST",
      body,
    });
    revalidatePath("/dashboard");
    return {};
  });
}

export async function deleteFolderAction(id: string) {
  return safeAction("DeleteFolderAction", async () => {
    await goFetch(`/api/v1/folders/${id}`, {
      method: "DELETE",
    });
    revalidatePath("/dashboard");
    return {};
  });
}

export async function renameFolderAction(id: string, name: string) {
  return safeAction("RenameFolderAction", async () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw new Error("Folder name must be 1-100 characters");
    }
    await goFetch(`/api/v1/folders/${id}`, {
      method: "PUT",
      body: { name: trimmedName },
    });
    revalidatePath("/dashboard");
    return {};
  });
}

export async function moveMediaToFolderAction(mediaIds: string[], folderId: string | null) {
  if (mediaIds.length === 0) return { success: true as const };
  return safeAction("MoveMediaToFolderAction", async () => {
    await goFetch("/api/v1/media/bulk/move", {
      method: "PUT",
      body: { media_ids: mediaIds, folder_id: folderId },
    });
    revalidatePath("/dashboard");
    return {};
  });
}
