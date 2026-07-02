import { z } from "zod";
import type { AppAIConfig, UserAIPreferences } from "@/features/ai/types";
import { DEFAULT_APP_AI_CONFIG, DEFAULT_USER_AI_PREFERENCES } from "@/features/ai/types";

const appAIConfigSchema = z.object({
 enabled: z.boolean().default(DEFAULT_APP_AI_CONFIG.enabled),
 variant: z.enum(["standard", "sharp", "high"]).default(DEFAULT_APP_AI_CONFIG.variant),
 aestheticModel: z.enum(["clip", "laion"]).default(DEFAULT_APP_AI_CONFIG.aestheticModel),
 tagThreshold: z.number().default(DEFAULT_APP_AI_CONFIG.tagThreshold),
 autoFavoriteThreshold: z.number().default(DEFAULT_APP_AI_CONFIG.autoFavoriteThreshold),
 device: z.enum(["cpu", "gpu"]).default(DEFAULT_APP_AI_CONFIG.device ?? "gpu"),
  customTaxonomy: z.record(z.string(), z.array(z.string())).optional(),
 aestheticEnabled: z.boolean().default(false),
}).partial().default(DEFAULT_APP_AI_CONFIG);

const userAIPrefsSchema = z.object({
 enabled: z.boolean().default(DEFAULT_USER_AI_PREFERENCES.enabled),
 smartSearchEnabled: z.boolean().optional(),
 aestheticEnabled: z.boolean().default(DEFAULT_USER_AI_PREFERENCES.aestheticEnabled),
 autoFavoriteEnabled: z.boolean().default(DEFAULT_USER_AI_PREFERENCES.autoFavoriteEnabled),
}).partial().default(DEFAULT_USER_AI_PREFERENCES);

export function sanitizeAppAIConfig(raw: unknown): AppAIConfig {
 return appAIConfigSchema.parse(raw) as AppAIConfig;
}

export function sanitizeUserAIPrefs(raw: unknown): UserAIPreferences {
 const parsed = userAIPrefsSchema.parse(raw);
 return {
 enabled: parsed.enabled ?? parsed.smartSearchEnabled ?? DEFAULT_USER_AI_PREFERENCES.enabled,
 aestheticEnabled: parsed.aestheticEnabled ?? DEFAULT_USER_AI_PREFERENCES.aestheticEnabled,
 autoFavoriteEnabled: parsed.autoFavoriteEnabled ?? DEFAULT_USER_AI_PREFERENCES.autoFavoriteEnabled,
 };
}
