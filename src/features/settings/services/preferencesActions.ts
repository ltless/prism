"use server";

import { auth } from "@/auth";
import { db } from "@/services/db";
import { users } from "@/services/db/schema";
import { eq } from "drizzle-orm";
import type { UserPreferences } from "@/features/ai/types";
import { sanitizeUserAIPrefs } from "@/features/ai/services/aiSanitize";
import { safeAction } from "@/core/utils/action";

export async function getPreferencesAction() {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) return { success: false, error: "Unauthorized" };

 return safeAction("getPreferencesAction", async () => {
 const [row] = await db.select({ preferences: users.preferences })
 .from(users)
 .where(eq(users.id, userId))
 .limit(1);

 const raw = row?.preferences as Record<string, unknown> | null;
 return {
 preferences: {
 ai: sanitizeUserAIPrefs(raw?.ai),
 theme: (raw?.theme as "dark" | "light") || "dark",
 } as UserPreferences,
 };
 });
}

export async function updatePreferencesAction(preferences: UserPreferences) {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) return { success: false, error: "Unauthorized" };

  return safeAction("updatePreferencesAction", async () => {
    const existing = await db.select({ preferences: users.preferences })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

    const current = (existing?.[0]?.preferences as Record<string, unknown>) ?? {};

    // Partial merge: only overwrite fields the caller actually sent. This
    // prevents a theme-only save from clobbering the user's AI preferences
    // (and vice versa).
    const next: Record<string, unknown> = { ...current };
    if (preferences.ai !== undefined) {
      next.ai = sanitizeUserAIPrefs(preferences.ai);
    }
    if (preferences.theme !== undefined) {
      next.theme = preferences.theme || "dark";
    }

    await db.update(users)
    .set({ preferences: next })
    .where(eq(users.id, userId));

    return {};
  });
}
