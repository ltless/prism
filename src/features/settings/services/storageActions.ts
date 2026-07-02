"use server";

import { auth } from "@/auth";
import { db } from "@/services/db";
import { users, appSettings } from "@/services/db/schema";
import { getUserDb } from "@/services/db/multitenant";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/core/utils/action";
import { formatBytes } from "@/core/utils/format";
import { logger } from "@/core/utils/logger";
import {
  getGlobalStorageDefaultBytes,
  effectiveStorageLimit,
  STORAGE_DEFAULT_KEY,
} from "./storageQuota";

async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

async function getStorageUsage(userId: string) {
  const { sqlite } = await getUserDb(userId);
  let usedBytes = 0;
  let imageBytes = 0;
  let videoBytes = 0;
  try {
    const total = sqlite.prepare("SELECT COALESCE(SUM(size), 0) as total FROM media").get() as { total: number };
    usedBytes = total.total;
    const image = sqlite.prepare("SELECT COALESCE(SUM(size), 0) as total FROM media WHERE mime_type LIKE 'image/%'").get() as { total: number };
    imageBytes = image.total;
    const video = sqlite.prepare("SELECT COALESCE(SUM(size), 0) as total FROM media WHERE mime_type LIKE 'video/%'").get() as { total: number };
    videoBytes = video.total;
  } catch (err) {
    if (!String(err).includes("no such table")) {
      logger.error("Storage failed to query media size", { error: String(err) });
    }
  }

  const user = db.select({ storageLimit: users.storageLimit, role: users.role }).from(users).where(eq(users.id, userId)).limit(1).get();
  const globalDefaultBytes = getGlobalStorageDefaultBytes(db);
  const limitBytes = effectiveStorageLimit(user?.role, user?.storageLimit ?? null, globalDefaultBytes);

  return {
    usedBytes,
    limitBytes,
    remainingBytes: limitBytes !== null ? Math.max(0, limitBytes - usedBytes) : null,
    imageBytes,
    videoBytes,
    globalDefaultBytes,
  };
}

export async function getUserStorageUsageAction() {
  const userId = await getUserId();
  if (!userId) return { success: false, error: "Unauthorized" };

  return safeAction("getUserStorageUsageAction", async () => {
    const usage = await getStorageUsage(userId);
    return { ...usage };
  });
}

export async function getGlobalStorageDefaultAction() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "admin") return { success: false, error: "Forbidden" };

  return safeAction("getGlobalStorageDefaultAction", async () => {
    const globalDefaultBytes = getGlobalStorageDefaultBytes(db);
    return { globalDefaultBytes };
  });
}

export async function updateGlobalStorageDefaultAction(value: number | "unlimited") {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "admin") return { success: false, error: "Forbidden" };

  if (value !== "unlimited" && (!Number.isFinite(value) || value <= 0)) {
    return { success: false, error: "Limit must be a positive number of bytes" };
  }

  const storedValue = value === "unlimited" ? "unlimited" : String(value);

  return safeAction("updateGlobalStorageDefaultAction", async () => {
    db.insert(appSettings)
      .values({ key: STORAGE_DEFAULT_KEY, value: storedValue })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: storedValue } })
      .run();
    revalidatePath("/dashboard");
    revalidatePath("/settings");
    return {};
  });
}

export async function updateStorageLimitAction(newLimitBytes: number | null) {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };
  if (session.user.role !== "admin") return { success: false, error: "Forbidden" };

  const userId = session.user.id;

  if (newLimitBytes !== null && (!Number.isFinite(newLimitBytes) || newLimitBytes < 0)) {
    return { success: false, error: "Limit must be a positive number" };
  }

  return safeAction("updateStorageLimitAction", async () => {
    const usage = await getStorageUsage(userId);
    if (newLimitBytes !== null && usage.usedBytes > newLimitBytes) {
      throw new Error(`Cannot set limit below current usage (${formatBytes(usage.usedBytes)})`);
    }

    db.update(users).set({ storageLimit: newLimitBytes }).where(eq(users.id, userId)).run();
    revalidatePath("/dashboard");
    return {};
  });
}
