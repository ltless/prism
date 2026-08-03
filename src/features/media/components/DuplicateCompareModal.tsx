"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { m, AnimatePresence } from "motion/react";
import { X, CaretLeft, CaretRight, MagnifyingGlassPlus, MagnifyingGlassMinus, Check, Spinner, Sparkle, Info } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { formatBytes } from "@/core/utils/format";
import type { MediaItem } from "../types";
import type { DuplicateScore } from "../utils/duplicateScoring";

interface DuplicateCompareModalProps {
 isOpen: boolean;
 onClose: () => void;
 items: MediaItem[];
 scores: DuplicateScore[];
 bestIndex: number;
 folderMap: Record<string, string>;
 onKeep: (item: MediaItem) => void;
 isResolving: boolean;
}

export function DuplicateCompareModal({
 isOpen,
 onClose,
 items,
 scores,
 bestIndex,
 folderMap,
 onKeep,
 isResolving,
}: DuplicateCompareModalProps) {
 const [activeIndex, setActiveIndex] = useState(0);
 const [zoom, setZoom] = useState(1);
 const [position, setPosition] = useState({ x: 0, y: 0 });
 const [isDragging, setIsDragging] = useState(false);
 const dragStart = useRef({ x: 0, y: 0 });
 const [showInfo, setShowInfo] = useState(false);
 const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
 const [prevBestIndex, setPrevBestIndex] = useState(bestIndex);
 const containerRef = useRef<HTMLDivElement>(null);

 // Reset ephemeral state when the modal opens or bestIndex changes —
 // set-state-during-render (React-endorsed) instead of set-state-in-effect.
 if (isOpen && (isOpen !== prevIsOpen || bestIndex !== prevBestIndex)) {
   setPrevIsOpen(isOpen);
   setPrevBestIndex(bestIndex);
   setActiveIndex(bestIndex);
   setZoom(1);
   setPosition({ x: 0, y: 0 });
   setShowInfo(false);
 }

 const handlePrev = useCallback(() => {
 setActiveIndex(prev => (prev > 0 ? prev - 1 : items.length - 1));
 setZoom(1);
 setPosition({ x: 0, y: 0 });
 }, [items.length]);

 const handleNext = useCallback(() => {
 setActiveIndex(prev => (prev < items.length - 1 ? prev + 1 : 0));
 setZoom(1);
 setPosition({ x: 0, y: 0 });
 }, [items.length]);

 const handleZoomIn = useCallback(() => setZoom(prev => Math.min(prev + 0.5, 4)), []);
 const handleZoomOut = useCallback(() => {
 setZoom(prev => Math.max(prev - 0.5, 1));
 if (zoom <= 1.5) setPosition({ x: 0, y: 0 });
 }, [zoom]);

 const handleMouseDown = (e: React.MouseEvent) => {
   if (zoom > 1) {
     setIsDragging(true);
     dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
   }
 };

 const handleMouseMove = (e: React.MouseEvent) => {
   if (isDragging && zoom > 1) {
     setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
   }
 };

 const handleMouseUp = () => setIsDragging(false);

 const handleKeyDown = useCallback((e: KeyboardEvent) => {
 if (e.key === "Escape") onClose();
 if (e.key === "ArrowLeft") handlePrev();
 if (e.key === "ArrowRight") handleNext();
 if (e.key === "+" || e.key === "=") handleZoomIn();
 if (e.key === "-") handleZoomOut();
 if (e.key === "i") setShowInfo(prev => !prev);
 }, [onClose, handlePrev, handleNext, handleZoomIn, handleZoomOut]);

 useEffect(() => {
 if (isOpen) {
 document.addEventListener("keydown", handleKeyDown);
 document.body.style.overflow = "hidden";
 }
 return () => {
 document.removeEventListener("keydown", handleKeyDown);
 document.body.style.overflow = "";
 };
 }, [isOpen, handleKeyDown]);

 const item = items[activeIndex];
 const score = scores[activeIndex];
 const isBest = activeIndex === bestIndex;
  const folderName = item.folderId ? (folderMap[item.folderId] ?? "Unknown") : "Library";

 return (
 <AnimatePresence>
 {isOpen && (
 <m.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.15 }}
 role="dialog" aria-modal="true" aria-label="Duplicate comparison" className="fixed inset-0 z-modal bg-black flex flex-col"
 onClick={onClose}
 >
 {/* Floating Toolbar */}
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
 {activeIndex + 1}<span className="text-white/40">/{items.length}</span>
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
 onClick={handleZoomOut}
 disabled={zoom <= 1}
 className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
 >
 <MagnifyingGlassMinus size={14} weight="light" className="text-white/70" />
 </button>
 <span className="text-xs text-white/50 min-w-[32px] text-center tabular-nums">
 {Math.round(zoom * 100)}%
 </span>
 <button
 type="button"
 onClick={handleZoomIn}
 disabled={zoom >= 4}
 className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-30 cursor-pointer"
 >
 <MagnifyingGlassPlus size={14} weight="light" className="text-white/70" />
 </button>

 <div className="w-px h-4 bg-white/10" />

 {/* Info Toggle */}
 <button
 type="button"
 onClick={() => setShowInfo(prev => !prev)}
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
 className="p-1.5 rounded-lg text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors cursor-pointer"
 >
 <X size={14} weight="light" />
 </button>
 </m.div>

 {/* Image Area */}
 <div
 ref={containerRef}
 className="flex-1 relative flex items-center justify-center overflow-hidden"
 onMouseDown={handleMouseDown}
 onMouseMove={handleMouseMove}
 onMouseUp={handleMouseUp}
 onMouseLeave={handleMouseUp}
 style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
 onClick={(e) => e.stopPropagation()}
 >
 {/* Nav Buttons */}
 <button
 type="button"
 onClick={handlePrev}
 className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-colors cursor-pointer"
 >
 <CaretLeft size={20} weight="light" className="text-white" />
 </button>
 <button
 type="button"
 onClick={handleNext}
 className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-colors cursor-pointer"
 >
 <CaretRight size={20} weight="light" className="text-white" />
 </button>

 {/* Image */}
 <div
 className="relative transition-transform duration-200"
 style={{
 transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
 }}
 >
 <Image
 src={`/api/v1/media/files/${item.filePath}`}
 alt={item.title}
 width={800}
 height={600}
 className="max-h-[75vh] max-w-[85vw] object-contain"
 unoptimized
 />
 </div>
 </div>

 {/* Bottom Bar */}
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
 onClick={() => { setActiveIndex(idx); setZoom(1); setPosition({ x: 0, y: 0 }); }}
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
 <div className="absolute top-0.5 left-0.5 px-1 py-0.5 bg-primary rounded text-[11px] font-medium text-primary-foreground">
 Best
 </div>
 )}
 <div className={cn(
 "absolute bottom-0.5 right-0.5 px-1 py-0.5 rounded text-[11px] font-medium text-white",
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
 </m.div>
 )}
 </AnimatePresence>
 );
}
