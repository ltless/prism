export type AIStatus = 'idle' | 'downloading' | 'downloaded' | 'loading' | 'ready' | 'processing' | 'error';
export type AIModelVariant = 'standard' | 'sharp' | 'high';
export type AestheticModelType = 'clip' | 'laion';
export type AIDevice = 'cpu' | 'gpu';

export interface AppAIConfig {
  enabled: boolean;
  aiActive: boolean;
  variant: AIModelVariant;
 aestheticModel: AestheticModelType;
 tagThreshold: number;
 autoFavoriteThreshold: number;
 device?: AIDevice;
 customTaxonomy?: Record<string, string[]>;
 aestheticEnabled?: boolean;
}

export interface UserAIPreferences {
  enabled: boolean;
  smartSearchEnabled?: boolean;
  aestheticEnabled: boolean;
  autoFavoriteEnabled: boolean;
}

export interface EffectiveAIConfig {
  isEnabled: boolean;
  userAIEnabled: boolean;
  aiActive: boolean;
  variant: AIModelVariant;
 aestheticModel: AestheticModelType;
 tagThreshold: number;
 aestheticEnabled: boolean;
 autoFavoriteEnabled: boolean;
 autoFavoriteThreshold: number;
 device: AIDevice;
 customTaxonomy?: Record<string, string[]>;
}

export interface UserPreferences {
  ai?: UserAIPreferences;
  theme?: "dark" | "light";
}

export const DEFAULT_APP_AI_CONFIG: AppAIConfig = {
  enabled: false,
  aiActive: false,
  variant: 'standard',
 aestheticModel: 'clip',
 tagThreshold: 0.12,
 autoFavoriteThreshold: 0.75,
 device: 'gpu',
};

export const DEFAULT_USER_AI_PREFERENCES: UserAIPreferences = {
 enabled: false,
 aestheticEnabled: false,
 autoFavoriteEnabled: false,
};

export const DEFAULT_PREFERENCES: UserPreferences = {
 ai: { ...DEFAULT_USER_AI_PREFERENCES },
 theme: "dark",
};

export interface AIProcessResult {
 embedding: number[] | null;
 tags: { tag: string; score: number }[] | null;
 aestheticScore: number | null;
 model: string;
}
