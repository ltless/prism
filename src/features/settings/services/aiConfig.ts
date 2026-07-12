"use server";

import { auth } from "@/auth";
import { safeAction } from "@/core/utils/action";
import { goFetch } from "@/lib/api";
import { sanitizeAppAIConfig, sanitizeUserAIPrefs } from "@/features/ai/services/aiSanitize";

interface ConfigResponse {
  ai: string | null;
}

interface UserProfileResponse {
  preferences: string | null;
}

export async function getEffectiveAIConfig() {
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" } as const;

  return safeAction("getEffectiveAIConfig", async () => {
    const [configRes, profile] = await Promise.all([
      goFetch<ConfigResponse>("/api/v1/config"),
      goFetch<UserProfileResponse>("/api/v1/users/me"),
    ]);

    const globalAI = sanitizeAppAIConfig(configRes.ai ? JSON.parse(configRes.ai) : null);
    const rawPrefs = profile.preferences ? JSON.parse(profile.preferences) as Record<string, unknown> : undefined;
    const userAI = sanitizeUserAIPrefs(rawPrefs?.ai || {});

    return {
      config: {
        isEnabled: globalAI.enabled,
        userAIEnabled: userAI.enabled,
        aiActive: globalAI.aiActive,
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
