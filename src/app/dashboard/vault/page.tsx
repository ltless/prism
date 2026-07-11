import { auth } from "@/auth";
import VaultLibraryClient from "@/features/media/components/VaultLibraryClient";
import type { MediaItem } from "@/features/media/types";
import { goFetch } from "@/lib/api";
import { getVaultPinStatusAction } from "@/features/profile/services/profileActions";
import { mapFolder, type FolderListResponse } from "@/types/goApi";

type ListResponse = { items: MediaItem[]; total: number };

export default async function VaultPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [mediaRes, folderRes, statusRes] = await Promise.all([
    goFetch<ListResponse>("/api/v1/media?vault=true"),
    goFetch<FolderListResponse>("/api/v1/folders"),
    getVaultPinStatusAction(),
  ]);

  const hasPin = statusRes.success ? !!statusRes.hasPin : false;

  return (
    <VaultLibraryClient
      initialItems={mediaRes.items ?? []}
      folders={(folderRes.items ?? []).map(mapFolder)}
      hasPin={hasPin}
    />
  );
}
