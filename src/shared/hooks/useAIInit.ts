import { useEffect } from "react";
import { useAIStore } from "@/features/ai/store";
import { fetchAIStatus, loadModelOnServer, reconcileLoadedModels } from "@/features/ai/services/aiStatusClient";
import { logger } from "@/core/utils/logger";

export function useAIInit() {
  useEffect(() => {
    const verifyModel = async () => {
      try {
        const { activeVariant, available } = await fetchAIStatus();
        const { status, variant, setActiveVariant, setStatus } = useAIStore.getState();
        reconcileLoadedModels(available);
        if (activeVariant) {
          setActiveVariant(activeVariant);
          if (status !== 'ready') setStatus('ready');
        } else if (useAIStore.getState().loadedModels.length > 0) {
          const v = variant || available[0];
          if (v && available.includes(v)) {
            setStatus('loading');
            const { success } = await loadModelOnServer(v);
            if (success) {
              setActiveVariant(v);
              setStatus('ready');
            } else {
              setStatus('idle');
            }
          }
        }
      } catch (err) {
        logger.warn("AI init failed", { error: String(err) });
      }
    };
    verifyModel();
  }, []);
}
