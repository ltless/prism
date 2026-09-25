import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { moveToTrashAction } from "../services/mediaTrashActions";
import { toggleFavoriteAction } from "../services/mediaFavoriteActions";
import { toggleVaultAction } from "../services/mediaVaultActions";
import { useVaultPin } from "../context/VaultPinContext";
import { renameMediaAction } from "../services/mediaCrud";
import { moveMediaToFolderAction } from "../services/mediaFolderActions";
import { downloadUrl } from "@/core/utils/download";
import type { MediaItem } from "../types";

export function useMediaCardActions(item: MediaItem, onDelete?: (id: string) => void) {
  const router = useRouter();
  const vaultPin = useVaultPin();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFav, setIsFav] = useState(item.isFavorite ?? false);
  const [renameModalOpen, setRenameModalOpen] = useState(false);

  // Stable identities so MediaCard's context-menu items can be memoized — the
  // menu used to be rebuilt on every hover re-render of the card. Accepts the
  // full id list so the card can include the whole multi-selection when the
  // right-clicked card is part of it.
  const handleMoveToFolder = useCallback(async (mediaIds: string[], folderId: string | null) => {
    const ids = mediaIds.length > 0 ? mediaIds : [item.id];
    const result = await moveMediaToFolderAction(ids, folderId);
    if (!result.success) {
      toast.error(result.error || "Failed to move items");
      return;
    }
    toast.success(ids.length > 1 ? `${ids.length} items moved` : "File moved");
    router.refresh();
  }, [item.id, router]);

  const handleDelete = useCallback(async (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      const result = await moveToTrashAction(item.id);
      if (!result.success) {
        toast.error(result.error || "Failed to move to trash");
        return;
      }
      toast.success("File moved to trash");
      onDelete?.(item.id);
    } finally {
      setIsDeleting(false);
    }
  }, [item.id, onDelete, isDeleting]);

  const handleDownload = useCallback(() => {
    downloadUrl(`/api/v1/media/files/${item.filePath}`, item.title);
  }, [item.filePath, item.title]);

  const handleToggleFavorite = useCallback(async (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    const newVal = !isFav;
    setIsFav(newVal);
    const result = await toggleFavoriteAction(item.id);
    if (!result.success) {
      setIsFav(!newVal);
      toast.error(result.error || "Failed to update favorite");
    }
  }, [item.id, isFav]);

  const handleRename = useCallback(async (newTitle: string) => {
    const result = await renameMediaAction(item.id, newTitle);
    if (!result.success) {
      toast.error(result.error || "Failed to rename");
      return;
    }
    toast.success("File renamed");
    router.refresh();
  }, [item.id, router]);

  const handleToggleVault = useCallback(async () => {
    const isMovingToVault = !item.isVault;
    const result = await toggleVaultAction(item.id, isMovingToVault ? undefined : (vaultPin ?? undefined));
    if (!result.success) {
      toast.error(result.error || "Failed to update Vault status");
      return;
    }
    toast.success(isMovingToVault ? "Asset moved to secure Vault" : "Asset restored to Library");
    router.refresh();
  }, [item.id, item.isVault, vaultPin, router]);

  return {
    isDeleting,
    isFav,
    renameModalOpen,
    setRenameModalOpen,
    handleMoveToFolder,
    handleDelete,
    handleDownload,
    handleToggleFavorite,
    handleRename,
    handleToggleVault
  };
}