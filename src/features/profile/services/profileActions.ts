"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/core/utils/action";
import { goFetch } from "@/lib/api";
import { getUserPaths } from "@/services/db/multitenant";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { detectImageMime, extensionForMime } from "@/core/utils/fileMagic";

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

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const detectedMime = detectImageMime(buffer);
    if (!detectedMime) throw new Error("File content does not match an allowed image type");
    const ext = extensionForMime(detectedMime);
    if (!ext) throw new Error("Unsupported image type");

    const { mediaDir } = await getUserPaths(userId);
    const profileDir = path.join(mediaDir, ".profile");
    await fs.mkdir(profileDir, { recursive: true });

    const filename = `${type}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
    const filePath = path.join(".profile", filename);
    const absolutePath = path.join(mediaDir, filePath);

    await fs.writeFile(absolutePath, buffer);

    const goKey = type === "coverImage" ? "cover_image" : type;
    await goFetch("/api/v1/users/me", {
      method: "PUT",
      body: { [goKey]: filePath },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");

    return { path: filePath };
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
