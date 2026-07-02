"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/core/utils/action";
import { goFetch } from "@/lib/api";
import { formatBytes } from "@/core/utils/format";
import { effectiveStorageLimit } from "./storageQuota";

interface StorageUsageResponse {
  usage_bytes: number;
  image_bytes: number;
  video_bytes: number;
}

interface UserProfileResponse {
  role: string;
  storage_limit: number | null;
}

interface StorageDefaultResponse {
  storage_default_bytes: number | null;
}

export async function getUserStorageUsageAction() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  return safeAction("getUserStorageUsageAction", async () => {
    const [usage, profile, storageDefault] = await Promise.all([
      goFetch<StorageUsageResponse>("/api/v1/users/me/storage-usage"),
      goFetch<UserProfileResponse>("/api/v1/users/me"),
      goFetch<StorageDefaultResponse>("/api/v1/config/storage-default"),
    ]);

    const limitBytes = effectiveStorageLimit(
      profile.role,
      profile.storage_limit,
      storageDefault.storage_default_bytes,
    );

    return {
      usedBytes: usage.usage_bytes,
      limitBytes,
      remainingBytes: limitBytes !== null ? Math.max(0, limitBytes - usage.usage_bytes) : null,
      imageBytes: usage.image_bytes,
      videoBytes: usage.video_bytes,
      globalDefaultBytes: storageDefault.storage_default_bytes,
    };
  });
}

export async function getGlobalStorageDefaultAction() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "admin") return { success: false, error: "Forbidden" };

  return safeAction("getGlobalStorageDefaultAction", async () => {
    const res = await goFetch<StorageDefaultResponse>("/api/v1/config/storage-default");
    return { globalDefaultBytes: res.storage_default_bytes };
  });
}

export async function updateGlobalStorageDefaultAction(value: number | "unlimited") {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "admin") return { success: false, error: "Forbidden" };

  if (value !== "unlimited" && (!Number.isFinite(value) || value <= 0)) {
    return { success: false, error: "Limit must be a positive number of bytes" };
  }

  return safeAction("updateGlobalStorageDefaultAction", async () => {
    const bytes = value === "unlimited" ? -1 : value;
    await goFetch("/api/v1/config/storage-default", {
      method: "PUT",
      body: { storage_default_bytes: bytes },
    });
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return {};
  });
}

export async function updateStorageLimitAction(newLimitBytes: number | null) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "admin") return { success: false, error: "Forbidden" };

  if (newLimitBytes !== null && (!Number.isFinite(newLimitBytes) || newLimitBytes < 0)) {
    return { success: false, error: "Limit must be a positive number" };
  }

  return safeAction("updateStorageLimitAction", async () => {
    const usage = await goFetch<StorageUsageResponse>("/api/v1/users/me/storage-usage");
    if (newLimitBytes !== null && usage.usage_bytes > newLimitBytes) {
      throw new Error(`Cannot set limit below current usage (${formatBytes(usage.usage_bytes)})`);
    }

    await goFetch("/api/v1/users/me/storage-limit", {
      method: "PUT",
      body: { storage_limit: newLimitBytes },
    });

    revalidatePath("/dashboard");
    return {};
  });
}
