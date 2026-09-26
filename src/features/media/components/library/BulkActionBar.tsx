"use client";

import { Heart, Copy, Scissors, Trash, X, Download } from "@phosphor-icons/react";

interface BulkActionBarProps {
 selectedIds: Set<string>;
 isSelecting: boolean;
 onFavorite: () => void;
 onCopy: () => void;
 onCut: () => void;
 onTrash: () => void;
 onClear: () => void;
 onDownload: () => void;
}

export function BulkActionBar({ selectedIds, isSelecting, onFavorite, onCopy, onCut, onTrash, onClear, onDownload }: BulkActionBarProps) {
 const count = selectedIds.size;
 if (count === 0 || isSelecting) return null;
 return (
 <div
   className="fixed bottom-[calc(var(--mobile-nav-h)+1rem)] left-1/2 z-40 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1 rounded-full bg-app-bg p-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.08)] ring-1 ring-main-text/10 md:bottom-8 md:max-w-none"
 >
 <div className="hidden items-center rounded-full bg-main-text px-4 py-2 text-app-bg md:flex">
 <span className="text-[12px] font-medium tabular-nums">{count} selected</span>
 </div>

 <div className="flex items-center gap-0 md:gap-1 px-1 md:px-2">
 <button
 type="button"
 onClick={onFavorite}
 aria-label="Favorite selected items"
 className="rounded-full p-2.5 text-muted-text hover:bg-panel-bg hover:text-rose-500 cursor-pointer"
 >
 <Heart size={15} weight="light" />
 </button>
 <button
 type="button"
 onClick={onCopy}
 aria-label="Copy selected items"
 className="rounded-full p-2.5 text-muted-text hover:bg-panel-bg hover:text-main-text cursor-pointer"
 >
 <Copy size={15} weight="light" />
 </button>
 <button
 type="button"
 onClick={onCut}
 aria-label="Cut selected items"
 className="rounded-full p-2.5 text-muted-text hover:bg-panel-bg hover:text-amber-600 cursor-pointer"
 >
 <Scissors size={15} weight="light" />
 </button>
 <button
 type="button"
 onClick={onDownload}
 aria-label="Download selected items"
 className="rounded-full p-2.5 text-muted-text hover:bg-panel-bg hover:text-main-text cursor-pointer"
 >
 <Download size={15} weight="light" />
 </button>
 <button
 type="button"
 onClick={onTrash}
 aria-label="Move selected items to trash"
 className="rounded-full p-2.5 text-muted-text hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
 >
 <Trash size={15} weight="light" />
 </button>
 </div>

 <div className="mx-1 h-5 w-px bg-main-text/10" />

 <button
 type="button"
 onClick={onClear}
 aria-label="Cancel selection"
 className="rounded-full p-2.5 text-muted-text hover:bg-panel-bg hover:text-main-text cursor-pointer"
 >
 <X size={15} weight="light" />
 </button>
 </div>
 );
}
