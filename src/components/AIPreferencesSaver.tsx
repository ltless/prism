"use client";

import { useEffect, useRef } from "react";
import { useAIStore } from "@/features/ai/store";
import { updatePreferencesAction } from "@/features/settings/services/preferencesActions";
import { logger } from "@/core/utils/logger";

/**
 * Mounted at app-level via Providers. Saves user AI preferences to server
 * whenever they change in the Zustand store. Decoupled from page-level components
 * so it works even if a specific page fails to render.
 */
export function AIPreferencesSaver() {
 const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 useEffect(() => {
 const unsub = useAIStore.subscribe((state, prevState) => {
 const userPrefs = state.toUserPreferences();
 const prevPrefs = prevState.toUserPreferences();
 const changed = JSON.stringify(userPrefs) !== JSON.stringify(prevPrefs);
 if (!changed || !state.currentUserId) return;

 if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
 saveTimerRef.current = setTimeout(async () => {
 try {
 await updatePreferencesAction({ ai: userPrefs });
 } catch (err) {
 logger.warn("AIPreferencesSaver failed to save preferences", { error: String(err) });
 }
 }, 1000);
 });

 return () => {
 unsub();
 if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
 };
 }, []);

 return null;
}
