import type { AIState } from "@/features/ai/store";

export function triggerConfigUpdate(ai: AIState, update: Record<string, unknown>) {
 import("@/features/settings/services/configActions").then(({ updateAppConfigAction }) => {
 updateAppConfigAction({
 enabled: ai.globalAIEnabled,
 variant: ai.variant,
 aestheticModel: ai.aestheticModel || "clip",
 aestheticEnabled: ai.aestheticEnabled,
 tagThreshold: ai.tagThreshold,
 autoFavoriteThreshold: ai.autoFavoriteThreshold,
 device: ai.device,
 ...update,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
 });
}
