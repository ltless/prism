"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";
import { FOLDER_COLORS } from "@/core/constants";
import { SmartFolderFilterSchema } from "../schemas";
import type { SmartFolderFilter } from "../types";

export async function createFolderAction(name: string, color: string = "zinc") {
  return safeAction("CreateFolderAction", async () => {
    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw new Error("Folder name must be 1-100 characters");
    }
    if (!(color in FOLDER_COLORS)) {
      throw new Error("Invalid folder color");
    }
    await goFetch("/api/v1/folders", {
      method: "POST",
      body: { name: trimmedName, color, folder_type: "regular" },
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
    await goFetch("/api/v1/folders", {
      method: "POST",
      body: {
        name: trimmedName,
        color,
        folder_type: "smart",
        filter_query: JSON.stringify(parsed.data),
      },
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
      method: "POST",
      body: { media_ids: mediaIds, folder_id: folderId },
    });
    revalidatePath("/dashboard");
    return {};
  });
}
