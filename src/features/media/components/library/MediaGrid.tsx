"use client";

import { useMemo, memo } from "react";
import { Check } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "framer-motion";
import { MediaCard } from "../MediaCard";
import { MediaItem, Folder } from "../../types";
import { cn } from "@/core/utils/cn";

export const MEDIA_GRID_CLASS = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2";

interface MediaGridProps {
  items: MediaItem[];
  selectedIds: Set<string>;
  clipboardIds: Set<string>;
  isCut: boolean;
  folders: Folder[];
  onItemClick: (item: MediaItem, e: React.MouseEvent) => void;
  onItemSelect: (id: string, isShift: boolean, isCtrl: boolean) => void;
  onDelete?: (id: string) => void;
}

export const MediaGrid = memo(function MediaGrid({
  items, selectedIds, clipboardIds, isCut, folders, onItemClick, onItemSelect, onDelete
}: MediaGridProps) {
  const allSelectedIds = useMemo(() => Array.from(selectedIds), [selectedIds]);

  return (
   <div className={cn(MEDIA_GRID_CLASS, "pb-0")}>
   <AnimatePresence initial={false}>
{items.map((item, index) => (
	<motion.div
	key={item.id}
	initial={{ opacity: 0, scale: 0.95 }}
	animate={{ opacity: 1, scale: 1 }}
	exit={{ opacity: 0, scale: 0.95 }}
	transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
	onClick={(e) => onItemClick(item, e)}
	data-media-id={item.id}
	className="relative group"
	>
	<MediaCard
	item={item}
	priority={index === 0}
	isSelected={selectedIds.has(item.id)}
	isCut={clipboardIds.has(item.id) && isCut}
	allSelectedIds={allSelectedIds}
	onSelect={(shift, ctrl) => onItemSelect(item.id, shift, ctrl)}
	onDelete={onDelete}
	folders={folders}
	/>
  <AnimatePresence>
  {selectedIds.has(item.id) && (
  <motion.div
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0, opacity: 0 }}
  transition={{ duration: 0.15 }}
  className="absolute top-3 left-3 z-10 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg border-2 border-white pointer-events-none"
  >
  <Check size={12} weight="bold" className="text-primary-foreground" />
  </motion.div>
  )}
  </AnimatePresence>
  </motion.div>
  ))}
  </AnimatePresence>
  </div>
  );
});
