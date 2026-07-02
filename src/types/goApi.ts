export type GoFolder = {
  id: string;
  name: string;
  color: string;
  folder_type: string;
  parent_id: string | null;
  filter_query?: string | null;
  created_at: number;
  updated_at?: number;
};

export type FolderListResponse = { items: GoFolder[] };

import type { Folder, MediaItem } from "@/features/media/types";

export function mapFolder(f: GoFolder): Folder {
  let smartFilter: Folder["smartFilter"] = undefined;
  if (f.folder_type === "smart" && f.filter_query) {
    try {
      const parsed = JSON.parse(f.filter_query) as { categories?: string[]; minScore?: number };
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        smartFilter = {
          categories: parsed.categories,
          minScore: typeof parsed.minScore === "number" ? parsed.minScore : 0,
        };
      }
    } catch {
      smartFilter = undefined;
    }
  }
  return {
    id: f.id,
    name: f.name,
    color: f.color || null,
    parentId: f.parent_id,
    createdAt: f.created_at ? new Date(f.created_at * 1000) : null,
    folderType: f.folder_type === "smart" ? "smart" : "regular",
    smartFilter,
  };
}

export type GoMedia = {
  createdAt?: number | null;
  capturedAt?: number | null;
  updatedAt?: number | null;
  [key: string]: unknown;
};

function toDateValue(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const ms = typeof v === "number" ? (v < 1e12 ? v * 1000 : v) : new Date(v as string).getTime();
  if (Number.isNaN(ms)) return null;
  return new Date(ms);
}

export function mapMedia(m: GoMedia): MediaItem {
  const raw = m as Record<string, unknown>;
  let metadata: MediaItem['metadata'];
  if (typeof raw.metadata === 'string') {
    try { metadata = JSON.parse(raw.metadata); } catch { metadata = undefined; }
  } else if (raw.metadata && typeof raw.metadata === 'object') {
    metadata = raw.metadata as MediaItem['metadata'];
  }
  return {
    ...(raw as unknown as MediaItem),
    metadata,
    createdAt: toDateValue(m.createdAt),
    capturedAt: toDateValue(m.capturedAt),
    updatedAt: toDateValue(m.updatedAt),
  };
}
