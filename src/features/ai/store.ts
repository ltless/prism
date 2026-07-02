import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { UserAIPreferences, EffectiveAIConfig, AIStatus, AIModelVariant, AestheticModelType, AIDevice } from "@/features/ai/types";

export interface AIState {
 isEnabled: boolean;
 aestheticEnabled: boolean;
 aestheticModel: AestheticModelType;
 autoFavoriteEnabled: boolean;
 device: AIDevice;
 customTaxonomy?: Record<string, string[]>;

 globalAIEnabled: boolean;
 variant: AIModelVariant;
 tagThreshold: number;
 autoFavoriteThreshold: number;

 activeVariant: AIModelVariant | null;
 status: AIStatus;
 progress: number;
 error: string | null;
 loadedModels: AIModelVariant[];
 currentUserId: string | null;

 setEnabled: (enabled: boolean) => void;
 setGlobalAIEnabled: (enabled: boolean) => void;
 setVariant: (variant: AIModelVariant) => void;
 setAestheticModel: (model: AestheticModelType) => void;
 setDevice: (device: AIDevice) => void;
 setCustomTaxonomy: (taxonomy?: Record<string, string[]>) => void;
 setActiveVariant: (variant: AIModelVariant | null) => void;
 setStatus: (status: AIStatus) => void;
 setProgress: (progress: number) => void;
 setError: (error: string | null) => void;
 addLoadedModel: (variant: AIModelVariant) => void;
 removeLoadedModel: (variant: AIModelVariant) => void;
 setTagThreshold: (threshold: number) => void;
 setAestheticEnabled: (enabled: boolean) => void;
 setAutoFavoriteThreshold: (threshold: number) => void;
 setAutoFavoriteEnabled: (enabled: boolean) => void;
 syncUser: (userId: string) => void;
 syncFromServer: (config: EffectiveAIConfig) => void;
 toUserPreferences: () => UserAIPreferences;
 reset: () => void;
}

export const useAIStore = create<AIState>()(
 persist(
 (set, get) => ({
 isEnabled: false,
 globalAIEnabled: false,
 variant: 'standard',
 aestheticModel: 'clip',
 device: 'gpu',
 activeVariant: null,
 status: 'idle',
 progress: 0,
 error: null,
 loadedModels: [],
 currentUserId: null,
 tagThreshold: 0.12,
 aestheticEnabled: false,
 autoFavoriteThreshold: 0.75,
 autoFavoriteEnabled: false,
 customTaxonomy: undefined,

 setEnabled: (enabled) => set({ isEnabled: enabled }),
 setGlobalAIEnabled: (enabled) => set({ globalAIEnabled: enabled }),
 setVariant: (variant) => set({ variant }),
 setAestheticModel: (model) => set({ aestheticModel: model }),
 setDevice: (device) => set({ device }),
 setCustomTaxonomy: (taxonomy) => set({ customTaxonomy: taxonomy }),
 setActiveVariant: (variant) => set({ activeVariant: variant }),
 setStatus: (status) => set({ status }),
 setProgress: (progress) => set({ progress }),
 setError: (error) => set({ error }),
 setTagThreshold: (threshold) => set({ tagThreshold: threshold }),
 setAestheticEnabled: (enabled) => set({ aestheticEnabled: enabled }),
 setAutoFavoriteThreshold: (threshold) => set({ autoFavoriteThreshold: threshold }),
 setAutoFavoriteEnabled: (enabled) => set({ autoFavoriteEnabled: enabled }),

 addLoadedModel: (variant) => set((state) => ({
 loadedModels: state.loadedModels.includes(variant) ? state.loadedModels : [...state.loadedModels, variant]
 })),
 removeLoadedModel: (variant) => set((state) => ({
 loadedModels: state.loadedModels.filter(m => m !== variant)
 })),

  syncUser: (userId) => {
    const { currentUserId } = get();
    if (currentUserId !== userId) {
      // User changed (login/logout/switch on a shared machine). Reset the
      // runtime prefs so we don't briefly attribute the previous user's
      // settings to the new one before `syncFromServer` lands. `currentUserId`
      // is NOT persisted (see `partialize`), so a fresh page load always
      // starts from defaults rather than the previous user's localStorage.
      set({
        currentUserId: userId,
        isEnabled: false,
        aestheticEnabled: false,
        autoFavoriteEnabled: false,
        globalAIEnabled: false,
        activeVariant: null,
        status: 'idle',
        progress: 0,
        error: null,
        loadedModels: [],
        customTaxonomy: undefined,
      });
    }
  },

 syncFromServer: (config) => {
 set({
 globalAIEnabled: config.isEnabled,
 variant: config.variant,
 aestheticModel: config.aestheticModel || 'clip',
 tagThreshold: config.tagThreshold,
 autoFavoriteThreshold: config.autoFavoriteThreshold,
 isEnabled: config.userAIEnabled,
 aestheticEnabled: config.aestheticEnabled,
 autoFavoriteEnabled: config.autoFavoriteEnabled,
 device: config.device || 'gpu',
 customTaxonomy: config.customTaxonomy,
 });
 },

 toUserPreferences: () => {
 const s = get();
 return {
 enabled: s.isEnabled,
 aestheticEnabled: s.aestheticEnabled,
 autoFavoriteEnabled: s.autoFavoriteEnabled,
 };
 },

 reset: () => set({
 status: 'idle',
 progress: 0,
 error: null
 }),
 }),
  {
  name: 'prism-ai-settings',
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({
  // NOTE: `currentUserId` is intentionally NOT persisted. Persisting it would
  // let the previous user's prefs bleed into a new session on a shared
  // machine until `syncUser` runs. Runtime prefs below are persisted, but
  // `syncUser` wipes them on user change.
  isEnabled: state.isEnabled,
  globalAIEnabled: state.globalAIEnabled,
  variant: state.variant,
  aestheticModel: state.aestheticModel,
  tagThreshold: state.tagThreshold,
  aestheticEnabled: state.aestheticEnabled,
  autoFavoriteThreshold: state.autoFavoriteThreshold,
  autoFavoriteEnabled: state.autoFavoriteEnabled,
  device: state.device,
  customTaxonomy: state.customTaxonomy,
  }),
  }
 )
);
