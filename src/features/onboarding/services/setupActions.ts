"use server";

import { auth } from "@/auth";
import { db } from "@/services/db";
import { users } from "@/services/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { safeAction } from "@/core/utils/action";
import { getUserPaths } from "@/services/db/multitenant";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import { MEDIA_LIMITS } from "@/core/constants";
import { checkMagicBytes } from "@/services/media/upload";

const ALLOWED_MIME_TYPES = new Set(MEDIA_LIMITS.ALLOWED_MIME_TYPES);
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function uploadSetupImageAction(formData: FormData, type: "image" | "coverImage") {
 return safeAction("uploadSetupImageAction", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 const file = formData.get("file") as File;
 if (!file) throw new Error("No file uploaded");

 if (file.size > MAX_FILE_SIZE_BYTES) throw new Error("File too large (max 10MB)");
 if (!ALLOWED_MIME_TYPES.has(file.type)) throw new Error("File type not allowed");

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (!checkMagicBytes(buffer)) {
      throw new Error("Invalid file signature");
    }

    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

 const { mediaDir } = await getUserPaths(userId);
 await fs.mkdir(mediaDir, { recursive: true });

 const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
 const filename = `system_${hash}.${ext}`;
 const absolutePath = path.join(mediaDir, filename);

 await fs.writeFile(absolutePath, buffer);

 await db.update(users)
 .set({ [type]: filename })
 .where(eq(users.id, userId));

 return { filename };
 });
}

export async function completeSetupAction() {
 const session = await auth();
 if (!session?.user?.id) {
 return { success: false, error: "Unauthorized" };
 }

 return safeAction("completeSetupAction", async () => {
 await db.update(users)
 .set({ hasCompletedSetup: true })
 .where(eq(users.id, session.user.id));

 revalidatePath("/dashboard");
 return {};
 });
}

export async function updateProfileAndCoverAction(profilePath: string | null, coverPath: string | null) {
 const session = await auth();
 if (!session?.user?.id) {
 return { success: false, error: "Unauthorized" };
 }

 return safeAction("updateProfileAndCoverAction", async () => {
 await db.update(users)
 .set({ 
 image: profilePath, 
 coverImage: coverPath 
 })
 .where(eq(users.id, session.user.id));

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
 const hashedPin = await bcrypt.hash(pin, 10);
 await db.update(users)
 .set({ vaultPin: hashedPin })
 .where(eq(users.id, session.user.id));

  return {};
  });
}

