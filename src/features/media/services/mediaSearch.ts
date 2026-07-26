"use server";

import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";

interface GoSearchResponse {
  items: Array<{
    id: string;
    title: string;
    filePath: string;
    mimeType: string;
    size: number;
    width: number | null;
    height: number | null;
    hash: string;
    folderId: string | null;
    isFavorite: boolean;
    isTrash: boolean;
    isVault: boolean;
    capturedAt: number | null;
    updatedAt: number | null;
    createdAt: number | null;
    metadata: string | Record<string, unknown> | null;
    duration: number | null;
    transcodeStatus: string | null;
  }>;
  total: number;
}

export async function searchMediaAction(
  query: string,
  folderId?: string | null,
  filters?: { mimeType?: string | null; dateFrom?: string | null; dateTo?: string | null },
) {
  return safeAction("searchMedia", async () => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (folderId) params.set("folder_id", folderId);
    if (filters?.mimeType) params.set("mime_type", filters.mimeType);
    if (filters?.dateFrom) {
      params.set("date_from", String(new Date(filters.dateFrom).getTime()));
    }
    if (filters?.dateTo) {
      params.set("date_to", String(new Date(filters.dateTo).getTime()));
    }

    const resp = await goFetch<GoSearchResponse>(
      `/api/v1/media/search?${params.toString()}`,
    );

    // Go returns metadata as a raw JSON string; parse it.
    const items = resp.items.map((item) => ({
      ...item,
      metadata: typeof item.metadata === "string"
        ? (() => { try { return JSON.parse(item.metadata); } catch { return null; } })()
        : item.metadata,
    }));

    return { items, total: resp.total, query, mode: "keyword" as const };
  });
}
