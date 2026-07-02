import { auth } from "@/auth";
import VaultLibraryClient from "@/features/media/components/VaultLibraryClient";
import { goFetch } from "@/lib/api";
import { getVaultPinStatusAction } from "@/features/profile/services/profileActions";
import { mapFolder, type FolderListResponse } from "@/types/goApi";

// F1: vault items are NOT fetched here. The vault is locked server-side until
// the PIN is verified, so the list is fetched only after unlock (client-side,
// via getVaultMediaAction, which carries the unlock token).
export default async function VaultPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [folderRes, statusRes] = await Promise.all([
    goFetch<FolderListResponse>("/api/v1/folders"),
    getVaultPinStatusAction(),
  ]);

  const hasPin = statusRes.success ? !!statusRes.hasPin : false;

  return (
    <VaultLibraryClient
      initialItems={[]}
      folders={(folderRes.items ?? []).map(mapFolder)}
      hasPin={hasPin}
    />
  );
}