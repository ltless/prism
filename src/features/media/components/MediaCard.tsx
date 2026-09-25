"use client";

import { useState, memo, useMemo } from "react";
import { Folder, Trash, Heart, FolderSimple, Download, Hash, Pencil, Lock, LockOpen, Star, Check } from "@phosphor-icons/react";
import { ContextMenu } from "./ContextMenu";
import { cn } from "@/core/utils/cn";
import { MediaItem, Folder as FolderType } from "../types";

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
  handleMoveToFolder: (mediaIds: string[], folderId: string | null) => void;
  handleDelete: () => void;
  handleDownload: () => void;
  handleToggleFavorite: () => void;
  handleToggleVault: () => void;
};

function buildMenuItems(item: MediaItem, folders: FolderType[], isSelected: boolean, actions: CardActions) {
  // Mirrors the drag payload (startCardDrag): a right-click on a selected card
  // moves the whole selection, an unselected card moves only itself.
  const resolveMoveIds = (): string[] => {
    const sel = getDragSelection();
    return isSelected && sel.ids.length > 0 ? sel.ids : [item.id];
  };

  return [
    { label: "Rename", icon: Pencil, onClick: () => actions.setRenameModalOpen(true) },
    { label: actions.isFav ? "Remove from Favorites" : "Add to Favorites", icon: Heart, onClick: () => actions.handleToggleFavorite() },
    {
      label: "Relocate to Folder",
      icon: FolderSimple,
      onClick: () => { },
      divider: true,
      subItems: [
        { label: "Root Directory", icon: Folder, onClick: () => actions.handleMoveToFolder(resolveMoveIds(), null) },
        ...folders.filter(f => !f.smartFilter).map(f => ({
          label: f.name,
          icon: Folder,
          onClick: () => actions.handleMoveToFolder(resolveMoveIds(), f.id)
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
    () => hideContextMenu ? null : buildMenuItems(item, folders, !!isSelected, {
      isFav,
      setRenameModalOpen,
      handleMoveToFolder,
      handleDelete,
      handleDownload,
      handleToggleFavorite,
      handleToggleVault,
    }),
    [item, folders, isSelected, isFav, hideContextMenu, setRenameModalOpen, handleMoveToFolder, handleDelete, handleDownload, handleToggleFavorite, handleToggleVault],
  );

  const handleDragStart = (e: React.DragEvent) => {
    const sel = getDragSelection();
    const idsToMove = isSelected && sel.ids.length > 0 ? sel.ids : [item.id];
    startCardDrag(e, idsToMove, imageUrl, sel.thumbs);
  };

  const showOverlay = isHovered || isTapped;

  const cardBody = (
    <div className="rounded-[1.75rem] bg-main-text/[0.045] p-1.5 ring-1 ring-main-text/[0.06]">
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="h-full w-full"
    >
      <div
        className={cn(
          "group/card relative aspect-[4/5] cursor-pointer overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-surface-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
          isSelected && "ring-1 ring-main-text/70"
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

        {isSelected && (
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-main-text">
            <Check size={11} weight="bold" className="text-app-bg" />
          </div>
        )}

        {!showOverlay && (isFav || item.isVault) && (
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1 pointer-events-none">
            {item.isVault && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55">
                <Lock size={12} weight="fill" className="text-white/90" />
              </span>
            )}
            {isFav && (
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55">
                <Star size={12} weight="fill" className="text-yellow-400" />
              </span>
            )}
          </div>
        )}

        <CardHoverOverlay
          visible={showOverlay}
          title={item.title}
          dimensions={item.width ? `${item.width}x${item.height}` : ""}
          isFav={isFav}
          isDeleting={isDeleting}
          onDelete={(e) => { e.stopPropagation(); handleDelete(e); }}
          onToggleFavorite={(e) => handleToggleFavorite(e)}
        />
      </div>
    </div>
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