"use server";

import { revalidatePath } from "next/cache";
import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";

export async function deleteMediaAction(id: string) {
  return safeAction("deleteMedia", async () => {
    await goFetch(`/api/v1/media/${id}`, {
      method: "DELETE",
    });
    revalidatePath("/dashboard");
    return {};
  });
}

export async function nukeLibraryAction(confirmUsername: string) {
  const name = confirmUsername.trim();
  if (!name) {
    return { success: false, error: "Type your username to confirm" };
  }
  return safeAction("nukeLibrary", async () => {
    // Go independently verifies the username against the JWT claims, so the
    // endpoint cannot be hit with a bare authenticated request.
    await goFetch("/api/v1/media/nuke", {
      method: "POST",
      body: { confirm_username: name },
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/duplicates");
    revalidatePath("/dashboard/trash");
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
