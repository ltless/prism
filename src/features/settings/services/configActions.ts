"use server";

import { auth } from "@/auth";
import { db } from "@/services/db";
import { appConfig } from "@/services/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { AppAIConfig } from "@/features/ai/types";
import { sanitizeAppAIConfig } from "@/features/ai/services/aiSanitize";
import { safeAction } from "@/core/utils/action";

export async function getAppConfigAction() {
 return safeAction("getAppConfigAction", async () => {
 const [row] = await db.select({ ai: appConfig.ai })
 .from(appConfig)
 .where(eq(appConfig.id, "global"))
 .limit(1);

 return { config: sanitizeAppAIConfig(row?.ai) };
 });
}

export async function updateAppConfigAction(config: AppAIConfig) {
 const session = await auth();
 if (session?.user?.role !== "admin") {
 return { success: false, error: "Only admins can update app configuration" };
 }

 return safeAction("updateAppConfigAction", async () => {
 const clean = sanitizeAppAIConfig(config);

 await db.insert(appConfig)
 .values({
 id: "global",
 ai: clean,
 updatedAt: new Date(),
 updatedBy: session.user.id,
 })
 .onConflictDoUpdate({
 target: appConfig.id,
 set: {
 ai: clean,
 updatedAt: new Date(),
 updatedBy: session.user.id,
 },
 });

 revalidatePath("/dashboard");
 return {};
 });
}
