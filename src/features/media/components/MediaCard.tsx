"use client";

import { useState, memo } from "react";
import Image from "next/image";
import { Folder, Trash, Heart, FolderSimple, Download, Hash, Star, Pencil, Play, Spinner, Warning, Lock, LockOpen, Image as ImageIcon, FileVideo } from "@phosphor-icons/react";
import { m, AnimatePresence } from "motion/react";
import { ContextMenu } from "./ContextMenu";
import { cn } from "@/core/utils/cn";
import { MediaItem, Folder as FolderType } from "../types";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

import { useTranscodePolling } from "../hooks/useTranscodePolling";
import { formatDuration } from "@/core/utils/format";
import { useMediaCardActions } from "../hooks/useMediaCardActions";
import { RenameModal } from "./RenameModal";
import { buildDragStack } from "../utils/dragGhost";

function handleDragEnd(e: React.DragEvent) {
  (e.target as HTMLElement).classList.remove("opacity-40");
}

export const MediaCard = memo(function MediaCard({
  item,
  isSelected,
  isCut,
  onSelect,
  onDelete,
  allSelectedIds = [],
  selectedThumbs = [],
  folders = [],
  priority = false
}: {
  item: MediaItem;
  isSelected?: boolean;
  isCut?: boolean;
  onSelect?: (isShift: boolean, isCtrl: boolean) => void;
  onDelete?: (id: string) => void;
  allSelectedIds?: string[];
  selectedThumbs?: string[];
  folders?: FolderType[];
  priority?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const reduced = useReducedMotion();
  const [isTapped, setIsTapped] = useState(false);
  const [transcodeStatus, setTranscodeStatus] = useState(item.transcodeStatus);
  const [prevTranscodeStatus, setPrevTranscodeStatus] = useState(item.transcodeStatus);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imageUrl = `/api/v1/media/files/${item.filePath}?thumb=1`;
  const isVideo = item.mimeType?.startsWith("video/");
  const formattedDuration = item.duration ? formatDuration(item.duration) : null;

  if (item.transcodeStatus !== prevTranscodeStatus) {
    setPrevTranscodeStatus(item.transcodeStatus);
    setTranscodeStatus(item.transcodeStatus);
  }

  useTranscodePolling(item.id, transcodeStatus, !!isVideo, setTranscodeStatus);

 // Because keeping 7 inline handler functions in this component was a crime against readability,
 // we outsource everything to our trusty custom hook.
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

  const menuItems = [
    { label: "Rename", icon: Pencil, onClick: () => setRenameModalOpen(true) },
    { label: isFav ? "Remove from Favorites" : "Add to Favorites", icon: Heart, onClick: () => handleToggleFavorite() },
    {
      label: "Relocate to Folder",
      icon: FolderSimple,
      onClick: () => { },
      divider: true,
      subItems: [
        { label: "Root Directory", icon: Folder, onClick: () => handleMoveToFolder(null) },
        ...folders.filter(f => !f.smartFilter).map(f => ({
          label: f.name,
          icon: Folder,
          onClick: () => handleMoveToFolder(f.id)
        }))
      ]
    },
 {
 label: item.isVault ? "Move out of Vault" : "Move to Vault",
 icon: item.isVault ? LockOpen : Lock,
 onClick: handleToggleVault,
 divider: true
 },
 { label: "Copy Hash String", icon: Hash, onClick: () => navigator.clipboard.writeText(item.hash || "") },
 { label: "Download Asset", icon: Download, onClick: handleDownload, divider: true },
 { label: "Relocate to Trash", icon: Trash, onClick: () => handleDelete(), variant: "danger" as const }
 ];

  const handleDragStart = (e: React.DragEvent) => {
    const idsToMove = isSelected ? allSelectedIds : [item.id];

    e.dataTransfer.setData("application/prism-media-ids", JSON.stringify(idsToMove));
    e.dataTransfer.effectAllowed = "move";

    const ghost = document.createElement("div");
    ghost.style.position = "absolute";
    ghost.style.top = "-1000px";

    if (idsToMove.length > 1) {
      const others = selectedThumbs.filter(t => t !== imageUrl).slice(0, 2);
      ghost.appendChild(buildDragStack(imageUrl, others, idsToMove.length));
    } else {
      ghost.className = "w-16 h-16 rounded-xl border border-white/20 shadow-2xl overflow-hidden bg-black/40";
      const img = document.createElement("img");
      img.src = imageUrl;
      img.className = "w-full h-full object-cover opacity-80";
      ghost.appendChild(img);
    }

    document.body.appendChild(ghost);
    // Center the ghost image on the cursor
    const xOffset = idsToMove.length > 1 ? 48 : 32;
    const yOffset = idsToMove.length > 1 ? 48 : 32;
    e.dataTransfer.setDragImage(ghost, xOffset, yOffset);
    setTimeout(() => ghost.remove(), 0);
  };

 return (
 <>
 <ContextMenu items={menuItems}>
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
  {imgError ? (
  <div className="absolute inset-0 flex items-center justify-center bg-surface-bg">
  <div className="flex flex-col items-center gap-1.5">
  {isVideo ? <FileVideo size={28} weight="light" className="text-muted-text/30" /> : <ImageIcon size={28} weight="light" className="text-muted-text/30" />}
  <span className="text-[11px] text-muted-text/40 font-bold uppercase tracking-wider">
  {isVideo ? "Video" : "Image"}
  </span>
  </div>
  </div>
  ) : (
  <>
  <Image
  src={imageUrl}
  alt={item.title}
  fill
  priority={priority}
  loading={priority ? "eager" : "lazy"}
  decoding="async"
  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
  onError={() => setImgError(true)}
  onLoad={() => setImgLoaded(true)}
  className={cn(
  "object-cover select-none pointer-events-none transition-[opacity,filter] duration-500 ease-out-expo",
  imgLoaded ? "opacity-100 blur-0" : "opacity-0 blur-sm",
  isDeleting ? "opacity-50 grayscale blur-sm" : isSelected ? "opacity-80" : "",
  isCut ? "opacity-40 grayscale" : ""
  )}
  unoptimized
  />
  {/* Blur placeholder while loading */}
  {!imgLoaded && (
  <div className="absolute inset-0 bg-surface-bg animate-pulse" />
  )}
  </>
  )}

 {/* Video Play Icon Overlay */}
 {isVideo && (
  <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
 <div className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
 <Play size={16} weight="fill" className="text-white ml-0.5" />
 </div>
 </div>
 )}

 {/* Video Duration Badge */}
 {isVideo && formattedDuration && (
 <div className="absolute bottom-2 left-2 z-10 px-1.5 py-0.5 rounded-lg bg-black/70 text-[11px] text-white tracking-wider tabular-nums">
 {formattedDuration}
 </div>
 )}

 {/* Video Transcode Status */}
 {isVideo && transcodeStatus === "processing" && (
 <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-full bg-violet-500/80 text-[11px] text-white flex items-center gap-1">
 <Spinner size={8} weight="bold" className="animate-spin" />
 Encoding
 </div>
 )}
 {isVideo && transcodeStatus === "failed" && (
 <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-full bg-rose-500/80 text-[11px] text-white flex items-center gap-1">
 <Warning size={8} weight="fill" />
 Failed
 </div>
 )}

 {/* Hover overlay */}
 <AnimatePresence>
 {(isHovered || isTapped) && (
 <m.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.15 }}
 className="absolute inset-0 bg-linear-to-t from-black/90 via-black/30 to-transparent flex items-end p-4"
 >
 <div className="flex flex-col gap-1 w-full">
 <p className="text-xs text-white font-bold truncate antialiased">
 {item.title}
 </p>
 <div className="flex items-center justify-between">
 <span className="text-[11px] text-white/70 font-bold antialiased">
 {item.width}x{item.height}
 </span>
 <div className="flex items-center gap-1">
 <button
 onClick={(e) => { e.stopPropagation(); handleDelete(e); }}
 disabled={isDeleting}
 type="button"
 className="text-white/40 hover:text-rose-500 transition-colors p-1"
 title="Move to Trash"
 >
 <Trash size={12} weight="light" />
 </button>
 <button
 onClick={(e) => handleToggleFavorite(e)}
 type="button"
 className={cn(
 "transition-colors p-1",
 isFav ? "text-yellow-400" : "text-white/40 hover:text-yellow-400"
 )}
 title={isFav ? "Remove from Favorites" : "Add to Favorites"}
 >
 <Star size={12} weight={isFav ? "fill" : "light"} />
 </button>
 </div>
 </div>
 </div>
 </m.div>
 )}
 </AnimatePresence>
  </m.div>
  </div>
  </ContextMenu>
 <RenameModal
 isOpen={renameModalOpen}
 onClose={() => setRenameModalOpen(false)}
 onRename={handleRename}
 initialTitle={item.title}
 />
 </>
 );
});
