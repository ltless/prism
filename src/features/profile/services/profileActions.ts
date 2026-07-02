"use server";

import { auth } from "@/auth";
import { db } from "@/services/db";
import { users } from "@/services/db/schema";
import { getUserPaths } from "@/services/db/multitenant";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { safeAction } from "@/core/utils/action";
import { detectImageMime, extensionForMime } from "@/core/utils/fileMagic";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB for profile/cover

/**
 * Update user profile picture or cover photo
 */
export async function updateProfileImageAction(formData: FormData, type: "image" | "coverImage") {
  return safeAction("updateProfileImageAction", async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    // Verify user exists in DB before writing (catches DB path mismatches early)
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) throw new Error("User not found in database — check that Go backend and Next.js share the same prism.db");

    const file = formData.get("file") as File;
    if (!file) throw new Error("No file uploaded");

    if (file.size > MAX_FILE_SIZE_BYTES) throw new Error("File too large (max 5MB)");

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Trust the bytes, not the client-supplied mime/extension. A disguised
    // .php/.html with type image/jpeg is rejected here, and the saved
    // extension always comes from the sniffed format.
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

    await db.update(users)
    .set({
    [type]: filePath,
    })
    .where(eq(users.id, userId));

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/profile");

    return { path: filePath };
  });
}

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;
const PASSWORD_MIN = 8;

export async function changePasswordAction(oldPassword: string, newPassword: string) {
 return safeAction("changePasswordAction", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 if (newPassword.length < PASSWORD_MIN) {
 throw new Error(`Password must be at least ${PASSWORD_MIN} characters`);
 }

 const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
 if (!user) throw new Error("User not found");

 const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
 if (!isValid) throw new Error("Current password is incorrect");

 const newHash = await bcrypt.hash(newPassword, 10);
 await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId));
 return {};
 });
}

export async function setVaultPinAction(pin: string) {
 return safeAction("setVaultPinAction", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 if (pin.length < 4 || pin.length > 10) {
 throw new Error("PIN must be 4-10 digits");
 }
 if (!/^\d+$/.test(pin)) {
 throw new Error("PIN must be numeric only");
 }

 const hashedPin = await bcrypt.hash(pin, 10);
 await db.update(users).set({ vaultPin: hashedPin }).where(eq(users.id, userId));
 return {};
 });
}

export async function changeVaultPinAction(oldPin: string, newPin: string) {
 return safeAction("changeVaultPinAction", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 if (newPin.length < 4 || newPin.length > 10) throw new Error("PIN must be 4-10 digits");
 if (!/^\d+$/.test(newPin)) throw new Error("PIN must be numeric only");

 const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
 if (!user) throw new Error("User not found");

 if (!user.vaultPin) throw new Error("No PIN set");
 const isValid = await bcrypt.compare(oldPin, user.vaultPin);
 if (!isValid) throw new Error("Current PIN is incorrect");

 const newHash = await bcrypt.hash(newPin, 10);
 await db.update(users).set({ vaultPin: newHash }).where(eq(users.id, userId));
 return {};
 });
}

export async function disableVaultPinAction(pin: string) {
 return safeAction("disableVaultPinAction", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
 if (!user) throw new Error("User not found");

 if (!user.vaultPin) throw new Error("No PIN set");
 const isValid = await bcrypt.compare(pin, user.vaultPin);
 if (!isValid) throw new Error("PIN is incorrect");

 await db.update(users).set({ vaultPin: null }).where(eq(users.id, userId));
 return {};
 });
}

export async function getVaultPinStatusAction() {
 return safeAction("getVaultPinStatusAction", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 const [user] = await db.select({ vaultPin: users.vaultPin }).from(users).where(eq(users.id, userId)).limit(1);
 if (!user) throw new Error("User not found");

 return { hasPin: !!user.vaultPin };
 });
}

export async function verifyVaultPinAction(pin: string) {
 return safeAction("verifyVaultPinAction", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 const [user] = await db.select({ vaultPin: users.vaultPin }).from(users).where(eq(users.id, userId)).limit(1);
 if (!user) throw new Error("User not found");
 if (!user.vaultPin) throw new Error("No PIN set");

  const isValid = await bcrypt.compare(pin, user.vaultPin);
  if (!isValid) throw new Error("PIN is incorrect");
  return {};
  });
}

export async function updateUsernameAction(newUsername: string) {
 return safeAction("updateUsernameAction", async () => {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) throw new Error("Unauthorized");

 const name = newUsername.trim();
 if (!USERNAME_REGEX.test(name)) {
 throw new Error("Username must be 3-32 characters: letters, numbers, underscores only");
 }

 const [existing] = await db.select().from(users).where(eq(users.username, name)).limit(1);
 if (existing && existing.id !== userId) {
 throw new Error("Username already taken");
 }

 await db.update(users).set({ username: name }).where(eq(users.id, userId));
 revalidatePath("/dashboard");
 return {};
 });
}
