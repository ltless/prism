"use server";

import { goFetch } from "@/lib/api";
import { safeAction } from "@/core/utils/action";
import { mapMedia } from "@/types/goApi";

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

function parseMetadata(item: GoSearchResponse["items"][number]) {
  return {
    ...item,
    metadata: typeof item.metadata === "string"
      ? (() => { try { return JSON.parse(item.metadata); } catch { return null; } })()
      : item.metadata,
  };
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
    const items = resp.items.map(parseMetadata);

    return { items, total: resp.total, query, mode: "keyword" as const };
  });
}

// Infinite scroll for the library grid — the dashboard endpoint caps each
// page at 200 items, so the client pulls successive pages.
export async function fetchLibraryPageAction(
  folderId: string | null,
  favorite: boolean,
  smart: { categories: string[]; minScore: number } | null,
  page: number,
) {
  return safeAction("fetchLibraryPage", async () => {
    const params = new URLSearchParams({ page: String(page), limit: "200" });
    if (folderId) params.set("folder_id", folderId);
    if (favorite) params.set("is_favorite", "true");
    if (smart) {
      params.set("smart", "true");
      params.set("categories", smart.categories.join(","));
      params.set("minScore", String(smart.minScore));
    }

    const resp = await goFetch<GoSearchResponse>(`/api/v1/media/dashboard?${params.toString()}`);
    return { items: resp.items.map(mapMedia), total: resp.total };
  });
}
