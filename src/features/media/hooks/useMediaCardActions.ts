import { useState } from "react";
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

  const handleMoveToFolder = async (folderId: string | null) => {
    const result = await moveMediaToFolderAction([item.id], folderId);
    if (!result.success) {
      toast.error(result.error || "Failed to move file");
      return;
    }
    toast.success("File moved");
    router.refresh();
  };

  const handleDelete = async (e?: { stopPropagation?: () => void }) => {
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
  };

  const handleDownload = () => {
    downloadUrl(`/api/v1/media/files/${item.filePath}`, item.title);
  };

  const handleToggleFavorite = async (e?: { stopPropagation?: () => void }) => {
    e?.stopPropagation?.();
    const newVal = !isFav;
    setIsFav(newVal);
    const result = await toggleFavoriteAction(item.id);
    if (!result.success) {
      setIsFav(!newVal);
      toast.error(result.error || "Failed to update favorite");
    }
  };

  const handleRename = async (newTitle: string) => {
    const result = await renameMediaAction(item.id, newTitle);
    if (!result.success) {
      toast.error(result.error || "Failed to rename");
      return;
    }
    toast.success("File renamed");
    router.refresh();
  };

  const handleToggleVault = async () => {
    const isMovingToVault = !item.isVault;
    const result = await toggleVaultAction(item.id, isMovingToVault ? undefined : (vaultPin ?? undefined));
    if (!result.success) {
      toast.error(result.error || "Failed to update Vault status");
      return;
    }
    toast.success(isMovingToVault ? "Asset moved to secure Vault" : "Asset restored to Library");
    router.refresh();
  };

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
