"use server";

import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { safeAction } from "@/core/utils/action";
import { goFetch } from "@/lib/api";
import type { AppAIConfig } from "@/features/ai/types";
import { sanitizeAppAIConfig } from "@/features/ai/services/aiSanitize";

interface ConfigResponse {
  ai: string | null;
}

export async function getAppConfigAction() {
  return safeAction("getAppConfigAction", async () => {
    const res = await goFetch<ConfigResponse>("/api/v1/config");
    return { config: sanitizeAppAIConfig(res.ai ? JSON.parse(res.ai) : null) };
  });
}

export async function updateAppConfigAction(config: AppAIConfig) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return { success: false, error: "Only admins can update app configuration" };
  }

  return safeAction("updateAppConfigAction", async () => {
    const clean = sanitizeAppAIConfig(config);
    await goFetch("/api/v1/config", {
      method: "PUT",
      body: { ai: JSON.stringify(clean) },
    });
    revalidatePath("/dashboard");
    return {};
  });
}
