export type GoFolder = {
  id: string;
  name: string;
  color: string;
  folder_type: string;
  parent_id: string | null;
  filter_query: string | null;
  created_at: number;
  updated_at?: number;
};

export type FolderListResponse = { items: GoFolder[] };

import type { Folder } from "@/features/media/types";

export function mapFolder(f: GoFolder): Folder {
  return {
    id: f.id,
    name: f.name,
    color: f.color || null,
    folderType: f.folder_type || null,
    parentId: f.parent_id,
    filterQuery: f.filter_query,
    createdAt: f.created_at ? new Date(f.created_at * 1000) : null,
  };
}
