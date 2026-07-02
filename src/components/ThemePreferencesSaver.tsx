"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "./ThemeProvider";
import { updatePreferencesAction } from "@/features/settings/services/preferencesActions";
import { logger } from "@/core/utils/logger";

/**
 * listens to theme changes and yeets them to the server.
 * so when you switch to light mode at 3am, future-you will suffer too.
 */
export function ThemePreferencesSaver() {
 const { theme } = useTheme();
 const savedRef = useRef(theme);
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 useEffect(() => {
 if (savedRef.current === theme) return;
 savedRef.current = theme;

  if (timerRef.current) clearTimeout(timerRef.current);
  timerRef.current = setTimeout(async () => {
    try {
      // Send ONLY theme — the server action merges partial updates, so omitting
      // `ai` preserves the user's existing AI preferences instead of resetting them.
      await updatePreferencesAction({ theme });
    } catch (err) {
      logger.warn("Theme failed to save to server", { error: String(err) });
    }
  }, 1000);

 return () => {
 if (timerRef.current) clearTimeout(timerRef.current);
 };
 }, [theme]);

 return null;
}
