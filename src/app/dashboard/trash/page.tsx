import { auth } from "@/auth";
import TrashLibrary from "@/features/media/components/TrashLibrary";
import type { Folder, MediaItem } from "@/features/media/types";
import { goFetch } from "@/lib/api";
import { mediaListSchema } from "@/lib/apiSchemas";
import { mapFolder, type FolderListResponse } from "@/types/goApi";

export default async function TrashPage() {
  const session = await auth();
  if (!session?.user?.id) return <TrashLibrary initialItems={[]} />;

  const [res, folderRes] = await Promise.all([
    goFetch("/api/v1/media?trash=true&limit=200", undefined, mediaListSchema),
    goFetch<FolderListResponse>("/api/v1/folders"),
  ]);

  const folders = (folderRes.items ?? []).map(mapFolder) as Folder[];

  // Runtime-validated core fields; cast only narrows the zod passthrough type.
  return <TrashLibrary initialItems={(res.items ?? []) as MediaItem[]} folders={folders} />;
}