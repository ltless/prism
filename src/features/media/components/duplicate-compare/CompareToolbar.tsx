"use client";

import { m } from "motion/react";
import { X, MagnifyingGlassPlus, MagnifyingGlassMinus, Sparkle, Info } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

interface CompareToolbarProps {
  activeIndex: number;
  totalItems: number;
  isBest: boolean;
  zoom: number;
  showInfo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleInfo: () => void;
  onClose: () => void;
}

export function CompareToolbar({ activeIndex, totalItems, isBest, zoom, showInfo, onZoomIn, onZoomOut, onToggleInfo, onClose }: CompareToolbarProps) {
  return (
    <m.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 px-2 py-1.5 bg-black/60 rounded-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Version Indicator */}
      <div className="flex items-center gap-1.5 px-2">
        <span className="text-[11px] font-medium text-white/90">
          {activeIndex + 1}<span className="text-white/40">/{totalItems}</span>
        </span>
        {isBest && (
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-primary/80 rounded">
            <Sparkle size={9} weight="fill" className="text-white" />
            <span className="text-[11px] font-medium text-white">Best</span>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-white/10" />

      {/* Zoom Controls */}
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= 1}
        aria-label="Zoom out"
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
      >
        <MagnifyingGlassMinus size={14} weight="light" className="text-white/70" />
      </button>
      <span className="text-xs text-white/50 min-w-[32px] text-center tabular-nums">
        {Math.round(zoom * 100)}%
      </span>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= 4}
        aria-label="Zoom in"
        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
      >
        <MagnifyingGlassPlus size={14} weight="light" className="text-white/70" />
      </button>

      <div className="w-px h-4 bg-white/10" />

      {/* Info Toggle */}
      <button
        type="button"
        onClick={onToggleInfo}
        aria-label="Toggle info"
        className={cn(
          "p-1.5 rounded-lg transition-colors cursor-pointer",
          showInfo ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/10 hover:text-white/70"
        )}
      >
        <Info size={14} weight="light" />
      </button>

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="p-1.5 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors cursor-pointer"
      >
        <X size={14} weight="light" />
      </button>
    </m.div>
  );
}
