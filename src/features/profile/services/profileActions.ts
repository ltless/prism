"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/core/utils/action";
import { goFetch, goFetchUpload } from "@/lib/api";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;
const PASSWORD_MIN = 8;

export async function updateProfileImageAction(formData: FormData, type: "image" | "coverImage") {
  return safeAction("updateProfileImageAction", async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");
    if (file.size > MAX_FILE_SIZE_BYTES) throw new Error("File too large (max 5MB)");

    const uploadBody = new FormData();
    uploadBody.append("file", file);
    uploadBody.append("type", type);

    const result = await goFetchUpload<{ path: string }>("/api/v1/users/me/profile-image", uploadBody);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");

    return { path: result.path };
  });
}

export async function changePasswordAction(oldPassword: string, newPassword: string) {
  return safeAction("changePasswordAction", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (newPassword.length < PASSWORD_MIN) {
      throw new Error(`Password must be at least ${PASSWORD_MIN} characters`);
    }

    await goFetch("/api/v1/auth/change-password", {
      method: "POST",
      body: { old_password: oldPassword, new_password: newPassword },
    });

    return {};
  });
}

export async function setVaultPinAction(pin: string) {
  return safeAction("setVaultPinAction", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (pin.length < 4 || pin.length > 10) {
      throw new Error("PIN must be 4-10 digits");
    }
    if (!/^\d+$/.test(pin)) {
      throw new Error("PIN must be numeric only");
    }

    await goFetch("/api/v1/users/me/vault-pin", {
      method: "POST",
      body: { pin },
    });

    return {};
  });
}

export async function changeVaultPinAction(oldPin: string, newPin: string) {
  return safeAction("changeVaultPinAction", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (newPin.length < 4 || newPin.length > 10) throw new Error("PIN must be 4-10 digits");
    if (!/^\d+$/.test(newPin)) throw new Error("PIN must be numeric only");

    const verifyRes = await goFetch<{ valid: boolean }>("/api/v1/users/me/vault-pin/verify", {
      method: "POST",
      body: { pin: oldPin },
    });
    if (!verifyRes.valid) throw new Error("Current PIN is incorrect");

    await goFetch("/api/v1/users/me/vault-pin", {
      method: "POST",
      body: { pin: newPin },
    });

    return {};
  });
}

export async function disableVaultPinAction(pin: string) {
  return safeAction("disableVaultPinAction", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const verifyRes = await goFetch<{ valid: boolean }>("/api/v1/users/me/vault-pin/verify", {
      method: "POST",
      body: { pin },
    });
    if (!verifyRes.valid) throw new Error("PIN is incorrect");

    await goFetch("/api/v1/users/me/vault-pin", {
      method: "DELETE",
    });

    return {};
  });
}

export async function getVaultPinStatusAction() {
  return safeAction("getVaultPinStatusAction", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const res = await goFetch<{ enabled: boolean }>("/api/v1/users/me/vault-pin/status");
    return { hasPin: res.enabled };
  });
}

export async function verifyVaultPinAction(pin: string) {
  return safeAction("verifyVaultPinAction", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const res = await goFetch<{ valid: boolean }>("/api/v1/users/me/vault-pin/verify", {
      method: "POST",
      body: { pin },
    });
    if (!res.valid) throw new Error("PIN is incorrect");

    return {};
  });
}

export async function updateUsernameAction(newUsername: string) {
  return safeAction("updateUsernameAction", async () => {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const name = newUsername.trim();
    if (!USERNAME_REGEX.test(name)) {
      throw new Error("Username must be 3-32 characters: letters, numbers, underscores only");
    }

    await goFetch("/api/v1/users/me/username", {
      method: "PUT",
      body: { username: name },
    });

    revalidatePath("/dashboard");
    return {};
  });
}
