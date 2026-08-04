"use server";

import { auth } from "@/auth";
import { safeAction } from "@/core/utils/action";
import { goFetch } from "@/lib/api";

export interface UserPreferences {
  theme?: "dark" | "light";
}

interface UserProfileResponse {
  preferences: string | null;
}

async function getPreferencesAction() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { success: false, error: "Unauthorized" };

  return safeAction("getPreferencesAction", async () => {
    const profile = await goFetch<UserProfileResponse>("/api/v1/users/me");
    const raw = profile.preferences ? JSON.parse(profile.preferences) as Record<string, unknown> : null;
    return {
      preferences: {
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
    const profile = await goFetch<UserProfileResponse>("/api/v1/users/me");
    const current = profile.preferences ? JSON.parse(profile.preferences) as Record<string, unknown> : {};

    const next: Record<string, unknown> = { ...current };
    delete next.ai;
    if (preferences.theme !== undefined) {
      next.theme = preferences.theme || "dark";
    }

    await goFetch("/api/v1/users/me", {
      method: "PUT",
      body: { preferences: JSON.stringify(next) },
    });

    return {};
  });
}
