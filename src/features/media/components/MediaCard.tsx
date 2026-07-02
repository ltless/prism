"use client";

import { useState, memo, useMemo } from "react";
import { Folder, Trash, Heart, FolderSimple, Download, Hash, Pencil, Lock, LockOpen } from "@phosphor-icons/react";
import { m } from "motion/react";
import { ContextMenu } from "./ContextMenu";
import { cn } from "@/core/utils/cn";
import { MediaItem, Folder as FolderType } from "../types";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

import { useTranscodePolling } from "../hooks/useTranscodePolling";
import { formatDuration } from "@/core/utils/format";
import { useMediaCardActions } from "../hooks/useMediaCardActions";
import { RenameModal } from "./RenameModal";
import { startCardDrag, getDragSelection } from "../utils/dragGhost";
import { MediaCardThumb, VideoBadges, CardHoverOverlay } from "./MediaCardOverlays";

function handleDragEnd(e: React.DragEvent) {
  (e.target as HTMLElement).classList.remove("opacity-40");
}

type CardActions = {
  isFav: boolean;
  setRenameModalOpen: (open: boolean) => void;
  handleMoveToFolder: (folderId: string | null) => void;
  handleDelete: () => void;
  handleDownload: () => void;
  handleToggleFavorite: () => void;
  handleToggleVault: () => void;
};

function buildMenuItems(item: MediaItem, folders: FolderType[], actions: CardActions) {
  return [
    { label: "Rename", icon: Pencil, onClick: () => actions.setRenameModalOpen(true) },
    { label: actions.isFav ? "Remove from Favorites" : "Add to Favorites", icon: Heart, onClick: () => actions.handleToggleFavorite() },
    {
      label: "Relocate to Folder",
      icon: FolderSimple,
      onClick: () => { },
      divider: true,
      subItems: [
        { label: "Root Directory", icon: Folder, onClick: () => actions.handleMoveToFolder(null) },
        ...folders.filter(f => !f.smartFilter).map(f => ({
          label: f.name,
          icon: Folder,
          onClick: () => actions.handleMoveToFolder(f.id)
        }))
      ]
    },
    {
      label: item.isVault ? "Move out of Vault" : "Move to Vault",
      icon: item.isVault ? LockOpen : Lock,
      onClick: actions.handleToggleVault,
      divider: true
    },
    { label: "Copy Hash String", icon: Hash, onClick: () => navigator.clipboard.writeText(item.hash || "") },
    { label: "Download Asset", icon: Download, onClick: actions.handleDownload, divider: true },
    { label: "Move to Trash", icon: Trash, onClick: () => actions.handleDelete(), variant: "danger" as const }
  ];
}

export const MediaCard = memo(function MediaCard({
  item,
  isSelected,
  isCut,
  onSelect,
  onDelete,
  folders = [],
  priority = false,
  hideContextMenu = false
}: {
  item: MediaItem;
  isSelected?: boolean;
  isCut?: boolean;
  onSelect?: (isShift: boolean, isCtrl: boolean) => void;
  onDelete?: (id: string) => void;
  folders?: FolderType[];
  priority?: boolean;
  hideContextMenu?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const reduced = useReducedMotion();
  const [isTapped, setIsTapped] = useState(false);
  const [transcodeStatus, setTranscodeStatus] = useState(item.transcodeStatus);
  const [prevTranscodeStatus, setPrevTranscodeStatus] = useState(item.transcodeStatus);
  const imageUrl = `/api/v1/media/files/${item.filePath}?thumb=1`;
  const isVideo = item.mimeType?.startsWith("video/");
  const formattedDuration = item.duration ? formatDuration(item.duration) : null;

  if (item.transcodeStatus !== prevTranscodeStatus) {
    setPrevTranscodeStatus(item.transcodeStatus);
    setTranscodeStatus(item.transcodeStatus);
  }

  useTranscodePolling(item.id, transcodeStatus, !!isVideo, setTranscodeStatus);

  const {
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
  } = useMediaCardActions(item, onDelete);

  const handleClick = (e: React.MouseEvent) => {
    if (onSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      e.stopPropagation();
      onSelect(e.shiftKey, e.ctrlKey || e.metaKey);
      return;
    }
    // Toggle overlay on tap for mobile
    setIsTapped(!isTapped);
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => { setIsHovered(false); setIsTapped(false); };

  const menuItems = useMemo(
    () => hideContextMenu ? null : buildMenuItems(item, folders, {
      isFav,
      setRenameModalOpen,
      handleMoveToFolder,
      handleDelete,
      handleDownload,
      handleToggleFavorite,
      handleToggleVault,
    }),
    [item, folders, isFav, hideContextMenu, setRenameModalOpen, handleMoveToFolder, handleDelete, handleDownload, handleToggleFavorite, handleToggleVault],
  );

  const handleDragStart = (e: React.DragEvent) => {
    const sel = getDragSelection();
    const idsToMove = isSelected && sel.ids.length > 0 ? sel.ids : [item.id];
    startCardDrag(e, idsToMove, imageUrl, sel.thumbs);
  };

  const cardBody = (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="h-full w-full"
    >
      <m.div
        whileTap={reduced ? {} : { scale: 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        className={cn(
          "aspect-square bg-surface-bg rounded-xl overflow-hidden group relative cursor-pointer border shadow-sm",
          isSelected ? "border-primary ring-2 ring-primary/10 scale-[0.98]" : "border-transparent hover:border-main-border/40"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <MediaCardThumb
          imageUrl={imageUrl}
          title={item.title}
          isVideo={!!isVideo}
          priority={priority}
          isDeleting={isDeleting}
          isSelected={!!isSelected}
          isCut={!!isCut}
        />

        <VideoBadges
          isVideo={!!isVideo}
          duration={formattedDuration}
          transcodeStatus={transcodeStatus}
        />

        <CardHoverOverlay
          visible={isHovered || isTapped}
          title={item.title}
          dimensions={item.width ? `${item.width}x${item.height}` : ""}
          isFav={isFav}
          isDeleting={isDeleting}
          onDelete={(e) => { e.stopPropagation(); handleDelete(e); }}
          onToggleFavorite={(e) => handleToggleFavorite(e)}
        />
      </m.div>
    </div>
  );

  if (hideContextMenu) return cardBody;

  return (
    <>
      <ContextMenu items={menuItems!}>{cardBody}</ContextMenu>
      <RenameModal
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        onRename={handleRename}
        initialTitle={item.title}
      />
    </>
  );
});