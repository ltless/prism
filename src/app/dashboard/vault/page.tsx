import { auth } from "@/auth";
import VaultLibraryClient from "@/features/media/components/VaultLibraryClient";
import type { MediaItem } from "@/features/media/types";
import { goFetch } from "@/lib/api";
import { mediaListSchema } from "@/lib/apiSchemas";
import { getVaultPinStatusAction } from "@/features/profile/services/profileActions";
import { mapFolder, type FolderListResponse } from "@/types/goApi";

export default async function VaultPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [mediaRes, folderRes, statusRes] = await Promise.all([
    goFetch("/api/v1/media?vault=true", undefined, mediaListSchema),
    goFetch<FolderListResponse>("/api/v1/folders"),
    getVaultPinStatusAction(),
  ]);

  const hasPin = statusRes.success ? !!statusRes.hasPin : false;

  // Runtime-validated core fields; cast only narrows the zod passthrough type.
  const items = (mediaRes.items ?? []) as MediaItem[];
  return (
    <VaultLibraryClient
      initialItems={items}
      folders={(folderRes.items ?? []).map(mapFolder)}
      hasPin={hasPin}
    />
  );
}
