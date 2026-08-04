"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";
import crypto from "crypto";

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
    await goFetch("/api/v1/media/nuke", { method: "POST" });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/duplicates");
    revalidatePath("/dashboard/trash");
    return {};
  });
}

async function updateMediaMetadataAction(filename: string, metadata: Record<string, unknown>) {
  return safeAction("updateMediaMetadata", async () => {
    const hash = filename.replace(/\.[^.]+$/, "");
    await goFetch(`/api/v1/media/hash/${hash}`, {
      method: "PATCH",
      body: { metadata: JSON.stringify(metadata) },
    });
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
