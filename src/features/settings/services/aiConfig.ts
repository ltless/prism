"use server";

import { auth } from "@/auth";
import { db } from "@/services/db";
import { appConfig, users } from "@/services/db/schema";
import { eq } from "drizzle-orm";
import { sanitizeAppAIConfig, sanitizeUserAIPrefs } from "@/features/ai/services/aiSanitize";
import { safeAction } from "@/core/utils/action";

export async function getEffectiveAIConfig() {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) return { success: false, error: "Unauthorized" } as const;

 return safeAction("getEffectiveAIConfig", async () => {
 const [[configRow], [userRow]] = await Promise.all([
 db.select({ ai: appConfig.ai }).from(appConfig).where(eq(appConfig.id, "global")).limit(1),
 db.select({ preferences: users.preferences }).from(users).where(eq(users.id, userId)).limit(1),
 ]);

 const globalAI = sanitizeAppAIConfig(configRow?.ai);
 const userPrefs = userRow?.preferences as Record<string, unknown> | undefined;
 const userAI = sanitizeUserAIPrefs(userPrefs?.ai || {});

 return {
 config: {
 isEnabled: globalAI.enabled,
 userAIEnabled: userAI.enabled,
 variant: globalAI.variant,
 aestheticModel: globalAI.aestheticModel,
 tagThreshold: globalAI.tagThreshold,
 aestheticEnabled: userAI.aestheticEnabled || !!globalAI.aestheticEnabled,
 autoFavoriteEnabled: userAI.autoFavoriteEnabled,
 autoFavoriteThreshold: globalAI.autoFavoriteThreshold,
 device: globalAI.device || "gpu",
 customTaxonomy: globalAI.customTaxonomy,
 },
 };
 });
}
