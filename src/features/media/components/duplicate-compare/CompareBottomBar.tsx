"use client";

import Image from "next/image";
import { m, AnimatePresence } from "motion/react";
import { Check, Spinner } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { formatBytes } from "@/core/utils/format";
import type { MediaItem } from "../../types";
import type { DuplicateScore } from "../../utils/duplicateScoring";

interface CompareBottomBarProps {
  item: MediaItem;
  score: DuplicateScore;
  isBest: boolean;
  showInfo: boolean;
  items: MediaItem[];
  scores: DuplicateScore[];
  bestIndex: number;
  activeIndex: number;
  folderName: string;
  isResolving: boolean;
  onKeep: (item: MediaItem) => void;
  onSelectIndex: (idx: number) => void;
}

export function CompareBottomBar({ item, score, isBest, showInfo, items, scores, bestIndex, activeIndex, folderName, isResolving, onKeep, onSelectIndex }: CompareBottomBarProps) {
  return (
    <m.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="relative z-20"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Info Panel (collapsible) */}
      <AnimatePresence>
        {showInfo && (
          <m.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "bottom" }}
            className="overflow-hidden bg-black/80 border-t border-white/5"
          >
            <div className="px-6 py-4 flex gap-8">
              {/* Details */}
              <div className="flex-1 space-y-2">
                <p className="text-xs text-white/30 font-medium ">Details</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                  <div>
                    <span className="text-xs text-white/30">Title</span>
                    <p className="text-[11px] text-white/80 truncate">{item.title}</p>
                  </div>
                  <div>
                    <span className="text-xs text-white/30">Folder</span>
                    <p className="text-[11px] text-white/80">{folderName}</p>
                  </div>
                  <div>
                    <span className="text-xs text-white/30">Size</span>
                    <p className="text-[11px] text-white/80">{formatBytes(item.size)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-white/30">Format</span>
                    <p className="text-[11px] text-white/80 uppercase">{item.mimeType.split("/")[1]}</p>
                  </div>
                  {item.width && item.height && (
                    <>
                      <div>
                        <span className="text-xs text-white/30">Dimensions</span>
                        <p className="text-[11px] text-white/80">{item.width} x {item.height}</p>
                      </div>
                      <div>
                        <span className="text-xs text-white/30">Pixels</span>
                        <p className="text-[11px] text-white/80">{((item.width * item.height) / 1000000).toFixed(1)}MP</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="w-48 space-y-2">
                <p className="text-xs text-white/30 font-medium ">Quality Score</p>
                <div className="space-y-1.5">
                  {[
                    { label: "Resolution", value: score.resolution },
                    { label: "Compression", value: score.compression },
                    { label: "Format", value: score.format },
                    { label: "Metadata", value: score.metadata },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-xs text-white/40 w-16">{label}</span>
                      <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", value > 0.7 ? "bg-emerald-500" : value > 0.4 ? "bg-amber-500" : "bg-rose-500")}
                          style={{ width: `${Math.min(value * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-1.5 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-white/40">Total</span>
                  <span className="text-sm font-semibold text-primary">{(score.total * 100).toFixed(0)}%</span>
                </div>
              </div>

              {/* Keep Button */}
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => onKeep(item)}
                  disabled={isResolving}
                  className={cn(
                    "h-9 px-4 rounded-lg flex items-center justify-center gap-2 text-[11px] font-medium transition-colors duration-200 cursor-pointer",
                    isBest
                      ? "bg-primary text-primary-foreground"
                      : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
                  )}
                >
                  {isResolving ? (
                    <Spinner size={12} weight="light" className="animate-spin" />
                  ) : (
                    <Check size={12} weight="fill" />
                  )}
                  {isResolving ? "Resolving..." : isBest ? "Keep (Best)" : "Keep"}
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      {/* Thumbnail Strip */}
      <div className="flex items-center justify-center gap-1.5 px-4 py-3 bg-black/80">
        {items.map((thumb, idx) => {
          const thumbScore = scores[idx];
          return (
            <button
              key={thumb.id}
              type="button"
              onClick={() => onSelectIndex(idx)}
              className={cn(
                "relative rounded-lg overflow-hidden transition-[box-shadow,transform] duration-200",
                idx === activeIndex
                  ? "ring-2 ring-primary ring-offset-1 ring-offset-black scale-105"
                  : "opacity-50 hover:opacity-80"
              )}
            >
              <Image
                src={`/api/v1/media/files/${thumb.filePath}?thumb=1`}
                alt={thumb.title}
                width={56}
                height={56}
                className="w-14 h-14 object-cover"
                unoptimized
              />
              {idx === bestIndex && (
                <div className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-primary rounded-md text-[11px] font-medium text-primary-foreground">
                  Best
                </div>
              )}
              <div className={cn(
                "absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded-md text-[11px] font-medium text-white",
                thumbScore.total > 0.7 ? "bg-emerald-500/80" : thumbScore.total > 0.4 ? "bg-amber-500/80" : "bg-rose-500/80"
              )}>
                {(thumbScore.total * 100).toFixed(0)}
              </div>
            </button>
          );
        })}

        <div className="w-px h-8 bg-white/10 mx-2" />

        {/* Quick Keep */}
        <button
          type="button"
          onClick={() => onKeep(item)}
          disabled={isResolving}
          className={cn(
            "h-9 px-4 rounded-lg flex items-center justify-center gap-2 text-[11px] font-medium transition-colors duration-200 cursor-pointer",
            isBest
              ? "bg-primary text-primary-foreground"
              : "bg-white/10 text-white/60 hover:bg-white/15 hover:text-white/80"
          )}
        >
          {isResolving ? (
            <Spinner size={12} weight="light" className="animate-spin" />
          ) : (
            <Check size={12} weight="fill" />
          )}
          {isResolving ? "Resolving..." : isBest ? "Keep (Best)" : "Keep"}
        </button>
      </div>
    </m.div>
  );
}
