import { useEffect, useRef } from "react";
import { useAIStore } from "@/features/ai/store";
import { fetchAIStatus, reconcileLoadedModels } from "@/features/ai/services/aiStatusClient";
import { toast } from "sonner";
import { logger } from "@/core/utils/logger";

interface SyncParams {
 activeTab: string;
 isAdmin: boolean;
 setTagStats: (stats: { total: number; tagged: number } | null) => void;
 setScoreStats: (stats: { total: number; scored: number } | null) => void;
}

export function useAIConfigSync({ activeTab, isAdmin, setTagStats, setScoreStats }: SyncParams) {
 const configSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 // Sync global config + model status with server when entering AI tab
 useEffect(() => {
 if (activeTab !== 'ai') return;
 const syncWithServer = async () => {
 try {
 const store = useAIStore.getState();

 const { getAppConfigAction } = await import("@/features/settings/services/configActions");
 const configRes = await getAppConfigAction();
 if (configRes.success && configRes.config) {
 store.setGlobalAIEnabled(configRes.config.enabled);
 store.setVariant(configRes.config.variant);
 store.setTagThreshold(configRes.config.tagThreshold);
 store.setAutoFavoriteThreshold(configRes.config.autoFavoriteThreshold);
 }

  const statusRes = await fetchAIStatus();
  const { activeVariant, available } = statusRes;
  if (activeVariant) {
    store.setActiveVariant(activeVariant);
  }
  reconcileLoadedModels(available, store);

 const { countTaggedMediaAction, countScoredMediaAction } = await import("@/features/media/services/mediaAIActions");
 const [tagRes, scoreRes] = await Promise.all([countTaggedMediaAction(), countScoredMediaAction()]);
 if (tagRes.success) {
 setTagStats({ total: tagRes.total, tagged: tagRes.tagged });
 }
 if (scoreRes.success) {
 setScoreStats({ total: scoreRes.total, scored: scoreRes.scored });
 }
	} catch (err) {
		logger.warn("AI config sync failed", { error: String(err) });
	}
 };
 syncWithServer();
 }, [activeTab, setTagStats, setScoreStats]);

 // Auto-save global config when admin changes variant, threshold, or global AI toggle
 useEffect(() => {
 if (!isAdmin) return;

 const unsub = useAIStore.subscribe((state, prevState) => {
 const configChanged = state.variant !== prevState.variant
 || state.tagThreshold !== prevState.tagThreshold
 || state.autoFavoriteThreshold !== prevState.autoFavoriteThreshold
 || state.aestheticModel !== prevState.aestheticModel
 || state.aestheticEnabled !== prevState.aestheticEnabled
 || state.device !== prevState.device
 || state.globalAIEnabled !== prevState.globalAIEnabled;
 if (!configChanged) return;

 if (configSaveRef.current) clearTimeout(configSaveRef.current);
 configSaveRef.current = setTimeout(async () => {
 try {
 const { updateAppConfigAction } = await import("@/features/settings/services/configActions");
 await updateAppConfigAction({
 enabled: state.globalAIEnabled,
 variant: state.variant,
 aestheticModel: state.aestheticModel,
 aestheticEnabled: state.aestheticEnabled,
 tagThreshold: state.tagThreshold,
 autoFavoriteThreshold: state.autoFavoriteThreshold,
 device: state.device,
 });
 } catch {
 toast.error("Failed to save global AI config");
 }
 }, 1000);
 });

 return () => {
 unsub();
 if (configSaveRef.current) clearTimeout(configSaveRef.current);
 };
 }, [isAdmin]);
}
