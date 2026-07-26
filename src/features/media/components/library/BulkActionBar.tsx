"use client";

import { motion, AnimatePresence } from "motion/react";
import { CheckCircle, Heart, Copy, Scissors, Trash, X, Download } from "@phosphor-icons/react";

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
 return (
 <AnimatePresence>
 {count > 0 && !isSelecting && (
 <motion.div
 initial={{ y: 100, opacity: 0 }}
 animate={{ y: 0, opacity: 1 }}
 exit={{ y: 100, opacity: 0 }}
  className="fixed bottom-4 md:bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 md:gap-2 p-1.5 bg-black/90 border border-white/10 rounded-2xl shadow-xl max-w-[calc(100vw-1rem)] md:max-w-none"
 >
 <div className="hidden md:flex px-3 md:px-4 py-2 items-center gap-3 border-r border-white/10">
 <div className="w-7 h-7 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
 <CheckCircle size={14} weight="fill" />
 </div>
 <div className="flex flex-col">
 <span className="text-xs font-semibold text-white ">{count} Selected</span>
 <span className="text-[11px] font-semibold text-white/40 ">Batch Operations</span>
 </div>
 </div>

 <div className="flex items-center gap-0 md:gap-1 px-1 md:px-2">
 <button
 onClick={onFavorite}
 aria-label="Favorite selected items"
 className="p-2 md:p-2.5 text-white/60 hover:text-rose-500 hover:bg-white/5 rounded-xl transition-all duration-300 ease-out-expo cursor-pointer "
 >
 <Heart size={15} weight="light" />
 </button>
 <button
 onClick={onCopy}
 aria-label="Copy selected items"
 className="p-2 md:p-2.5 text-white/60 hover:text-primary hover:bg-white/5 rounded-xl transition-all duration-300 ease-out-expo cursor-pointer "
 >
 <Copy size={15} weight="light" />
 </button>
 <button
 onClick={onCut}
 aria-label="Cut selected items"
 className="p-2 md:p-2.5 text-white/60 hover:text-amber-500 hover:bg-white/5 rounded-xl transition-all duration-300 ease-out-expo cursor-pointer "
 >
 <Scissors size={15} weight="light" />
 </button>
 <button
 onClick={onDownload}
 aria-label="Download selected items"
 className="p-2 md:p-2.5 text-white/60 hover:text-primary hover:bg-white/5 rounded-xl transition-all duration-300 ease-out-expo cursor-pointer "
 >
 <Download size={15} weight="light" />
 </button>
 <button
 onClick={onTrash}
 aria-label="Move selected items to trash"
 className="p-2 md:p-2.5 text-white/60 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all duration-300 ease-out-expo cursor-pointer "
 >
 <Trash size={15} weight="light" />
 </button>
 </div>

 <div className="h-6 w-px bg-white/10 mx-0.5 md:mx-1" />

 <button
 onClick={onClear}
 aria-label="Cancel selection"
 className="p-2 md:p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300 ease-out-expo cursor-pointer "
 >
 <X size={15} weight="light" />
 </button>
 </motion.div>
 )}
 </AnimatePresence>
 );
}
