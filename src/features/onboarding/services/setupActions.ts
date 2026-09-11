"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/core/utils/action";
import { goFetch, goFetchUpload } from "@/lib/api";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function uploadSetupImageAction(formData: FormData, type: "image" | "coverImage") {
  return safeAction("uploadSetupImageAction", async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");
    if (file.size > MAX_FILE_SIZE_BYTES) throw new Error("File too large (max 10MB)");

    const uploadBody = new FormData();
    uploadBody.append("file", file);
    uploadBody.append("type", type);

    const result = await goFetchUpload<{ path: string }>("/api/v1/users/me/profile-image", uploadBody);

    return { filename: result.path };
  });
}

export async function completeSetupAction() {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  return safeAction("completeSetupAction", async () => {
    await goFetch("/api/v1/users/me/setup-complete", { method: "POST" });
    revalidatePath("/dashboard");
    return {};
  });
}

export async function saveVaultPinAction(pin: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  if (!/^\d{4,10}$/.test(pin)) {
    return { success: false, error: "PIN must be 4-10 numeric digits" };
  }

  return safeAction("saveVaultPinAction", async () => {
    await goFetch("/api/v1/users/me/vault-pin", {
      method: "POST",
      body: { pin },
    });
    return {};
  });
}
