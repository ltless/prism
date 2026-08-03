"use client";

import { m, AnimatePresence } from "motion/react";
import { X, Download, CaretLeft, CaretRight, Info, ImageBroken } from "@phosphor-icons/react";
import { LightboxInfo } from "./LightboxInfo";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/core/utils/cn";
import { MediaItem, Folder } from "../types";
import { VideoPlayer } from "./VideoPlayer";
import { useRouter } from "next/navigation";
import { ImageEditor } from "./lightbox/ImageEditor";
import { useTranscodePolling } from "../hooks/useTranscodePolling";
import { useScrollLock } from "@/shared/hooks/useScrollLock";

interface LightboxProps {
  item: MediaItem;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  currentIndex?: number;
  totalItems?: number;
  folders?: Folder[];
}

export function Lightbox({ item, onClose, onNext, onPrev, currentIndex, totalItems, folders }: LightboxProps) {
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [prevId, setPrevId] = useState(item.id);
  const [prevTranscodeStatus, setPrevTranscodeStatus] = useState(item.transcodeStatus);
  const [transcodeStatus, setTranscodeStatus] = useState(item.transcodeStatus);
  const [isEditing, setIsEditing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isZoomed, setIsZoomed] = useState(false);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const lastTap = useRef<number>(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset per-item UI state when the displayed item changes. Set-state-during-render
  // (React-endorsed for "reset on prop change") avoids the set-state-in-effect pattern.
  if (item.id !== prevId || item.transcodeStatus !== prevTranscodeStatus) {
    setPrevId(item.id);
    setPrevTranscodeStatus(item.transcodeStatus);
    setTranscodeStatus(item.transcodeStatus);
    setImgError(false);
    setImgLoaded(false);
    setIsZoomed(false);
    setPanPos({ x: 0, y: 0 });
  }

  const mediaUrl = `/api/v1/media/files/${item.filePath}`;
  const isVideo = item.mimeType?.startsWith("video/");
  const router = useRouter();

  useTranscodePolling(item.id, transcodeStatus, !!isVideo, setTranscodeStatus);
  useScrollLock(true);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const scheduleHideControls = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (!isInfoOpen) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
    }
  }, [isInfoOpen]);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => {
    scheduleHideControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [scheduleHideControls]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isInInput = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
      if (isInInput) {
        if (e.key === "Escape") onClose();
        return;
      }
      if (e.key === "Escape") {
        if (isZoomed) { setIsZoomed(false); setPanPos({ x: 0, y: 0 }); return; }
        if (isInfoOpen) { setIsInfoOpen(false); return; }
        onClose();
      }
      if (isZoomed || isInfoOpen) return;
      if (isVideo) return;
      if (e.key === "ArrowRight" && onNext) onNext();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "i" || e.key === "I") setIsInfoOpen(v => !v);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrev, isVideo, isZoomed, isInfoOpen]);

  // Swipe + double-tap
  const swipeState = useRef<{ startX: number; startY: number } | null>(null);
  const SWIPE_THRESHOLD = 30;

  const handleTouchStart = (e: React.TouchEvent) => {
    showControls();
    if (isVideo) return;
    const touch = e.touches[0];
    swipeState.current = { startX: touch.clientX, startY: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeState.current || isVideo || isZoomed) return;
    const touch = e.touches[0];
    const diffX = touch.clientX - swipeState.current.startX;
    const diffY = Math.abs(touch.clientY - swipeState.current.startY);
    if (diffY > Math.abs(diffX)) { swipeState.current = null; return; }
    if (Math.abs(diffX) > SWIPE_THRESHOLD) {
      if (diffX > 0 && onPrev) onPrev();
      else if (diffX < 0 && onNext) onNext();
      swipeState.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (swipeState.current) {
      const now = Date.now();
      if (now - lastTap.current < 300 && !isVideo) {
        setIsZoomed(z => !z);
        if (isZoomed) setPanPos({ x: 0, y: 0 });
      }
      lastTap.current = now;
    }
    swipeState.current = null;
  };

  // Zoom + pan (desktop)
  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isVideo) return;
    if (isZoomed) {
      setIsZoomed(false);
      setPanPos({ x: 0, y: 0 });
    } else {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 50;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 50;
        setPanPos({ x: -x, y: -y });
      }
      setIsZoomed(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isZoomed) return;
    e.preventDefault();
    dragStart.current = { x: e.clientX - panPos.x, y: e.clientY - panPos.y };
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    showControls();
    if (!isZoomed || !dragStart.current) return;
    setPanPos({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => { dragStart.current = null; setIsDragging(false); };

  const [isDragging, setIsDragging] = useState(false);

  const zoomStyle = isZoomed
    ? { transform: `scale(2) translate(${panPos.x / 2}px, ${panPos.y / 2}px)`, cursor: isDragging ? "grabbing" : "grab" }
    : { cursor: "zoom-in" };

  const hasCounter = currentIndex !== undefined && totalItems !== undefined;

  return (
    <AnimatePresence>
    <m.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    role="dialog" aria-modal="true" aria-labelledby="lightbox-title"
    className="fixed inset-0 z-modal bg-black overflow-hidden flex"
    onMouseMove={showControls}
    onTouchStart={showControls}
    >
    {isEditing ? (
    <ImageEditor
    item={item}
    onClose={() => setIsEditing(false)}
    onSuccess={() => router.refresh()}
    />
    ) : (
    <>
    {/* Image viewport — flex-1, shrinks when info panel opens */}
    <div
    ref={containerRef}
    className="flex-1 relative flex items-center justify-center p-2 md:p-8 min-w-0 transition-[flex-grow,flex-shrink] duration-300 ease-out-expo"
    onDoubleClick={handleDoubleClick}
    onMouseDown={handleMouseDown}
    onMouseMove={handleMouseMove}
    onMouseUp={handleMouseUp}
    onMouseLeave={handleMouseUp}
    onTouchStart={handleTouchStart}
    onTouchMove={handleTouchMove}
    onTouchEnd={handleTouchEnd}
    >
    <AnimatePresence mode="wait">
    {isVideo ? (
    <m.div
    key={item.id}
    initial={{ opacity: 0, x: 20, scale: 0.95 }}
    animate={{ opacity: 1, x: 0, scale: 1 }}
    exit={{ opacity: 0, x: -20, scale: 0.95 }}
    transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
    className="max-w-full max-h-full"
    >
    <VideoPlayer src={mediaUrl} autoPlay className="max-w-full max-h-full rounded-xl" />
    </m.div>
    ) : imgError ? (
    <div className="flex items-center justify-center w-full h-full">
    <div className="flex flex-col items-center gap-3">
    <ImageBroken size={48} weight="light" className="text-white/20" />
    <p className="text-xs text-white/30 font-medium">Failed to load image</p>
    </div>
    </div>
    ) : (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
    {!imgLoaded && (
    <div className="absolute inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
    </div>
    )}
    <m.img
    key={item.id}
    src={mediaUrl}
    alt={item.title}
    draggable={false}
    loading="eager"
    onError={() => setImgError(true)}
    onLoad={() => setImgLoaded(true)}
    initial={{ opacity: 0, x: 20, scale: 0.95 }}
    animate={{ opacity: 1, x: 0, scale: 1 }}
    exit={{ opacity: 0, x: -20, scale: 0.95 }}
    transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.3 } }}
    style={zoomStyle}
    className="max-w-full max-h-full object-contain shadow-2xl select-none transition-transform duration-200 ease-out"
    />
    </div>
    )}
    </AnimatePresence>

    {/* Nav arrows — inside image viewport so they shift with it */}
    <AnimatePresence>
    {controlsVisible && !isZoomed && (
    <>
    {onPrev && (
    <m.button
    key="prev"
    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
    transition={{ duration: 0.2 }}
    onClick={onPrev} aria-label="Previous"
    className="absolute left-2 md:left-4 top-1/2 -translate-y-1/2 p-2.5 md:p-3.5 hover:bg-white/25 rounded-full text-white z-20 bg-black/50 backdrop-blur-sm border border-white/20 transition-colors cursor-pointer"
    >
    <CaretLeft size={24} weight="light" />
    </m.button>
    )}
    {onNext && (
    <m.button
    key="next"
    initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
    transition={{ duration: 0.2 }}
    onClick={onNext} aria-label="Next"
    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-2.5 md:p-3.5 hover:bg-white/25 rounded-full text-white z-20 bg-black/50 backdrop-blur-sm border border-white/20 transition-colors cursor-pointer"
    >
    <CaretRight size={24} weight="light" />
    </m.button>
    )}
    </>
    )}
    </AnimatePresence>

    {/* Zoom hint — inside image viewport so it centers on image */}
    <AnimatePresence>
    {imgLoaded && !isZoomed && !isVideo && controlsVisible && (
    <m.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    transition={{ delay: 0.5, duration: 0.3 }}
    className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/40 z-20 pointer-events-none"
    >
    Double-click to zoom
    </m.div>
    )}
    </AnimatePresence>

    {/* Floating top bar — inside image viewport so it doesn't cover info panel */}
    <AnimatePresence>
    {controlsVisible && (
    <m.div
    initial={{ opacity: 0, y: -10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
    className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 md:px-6 z-20 bg-linear-to-b from-black/70 to-transparent pointer-events-none"
    >
    <div className="flex items-center gap-3 pointer-events-auto">
    <button type="button" onClick={onClose} aria-label="Close" className="p-2.5 hover:bg-white/15 rounded text-white transition-colors cursor-pointer">
    <X size={20} weight="light" />
    </button>
    <div className="flex flex-col">
    <h2 id="lightbox-title" className="text-xs text-white/90 font-medium truncate max-w-[200px] md:max-w-[400px]">{item.title}</h2>
    {hasCounter && (
    <span className="text-xs text-white/50">{currentIndex! + 1} / {totalItems}</span>
    )}
    </div>
    </div>
    <div className="flex items-center gap-1.5 pointer-events-auto">
    {!isVideo && (
    <button type="button" onClick={() => setIsEditing(true)} aria-label="Edit" className="px-3 py-2 hover:bg-white/15 rounded text-xs text-white transition-colors cursor-pointer border border-white/10">
    Edit
    </button>
    )}
    <a href={mediaUrl} download={item.title} aria-label="Download" className="p-2.5 hover:bg-white/15 rounded text-white transition-colors inline-flex items-center justify-center">
    <Download size={18} weight="light" />
    </a>
    <button
    type="button"
    onClick={() => setIsInfoOpen(v => !v)}
    aria-label={isInfoOpen ? "Close info" : "Open info"}
    aria-pressed={isInfoOpen}
    className={cn("p-2.5 rounded transition-colors cursor-pointer", isInfoOpen ? "bg-white text-black" : "text-white hover:bg-white/15")}
    >
    <Info size={18} weight="light" />
    </button>
    </div>
    </m.div>
    )}
    </AnimatePresence>
    </div>

    {/* Info panel — pushes image aside (desktop) / bottom sheet (mobile) */}
    <AnimatePresence>
    {isInfoOpen && (
      isMobile ? (
    <m.div
    key="info-mobile"
    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    className="absolute bottom-0 left-0 right-0 max-h-[55vh] bg-panel-bg rounded-t-2xl border-t border-main-border shadow-2xl z-30 flex flex-col overflow-hidden"
    >
    <div className="flex items-center justify-between px-4 h-11 border-b border-main-border shrink-0">
    <h3 className="text-xs text-muted-text font-medium">Details</h3>
    <button type="button" onClick={() => setIsInfoOpen(false)} aria-label="Close details" className="p-2 hover:bg-surface-bg rounded transition-colors cursor-pointer">
    <X size={16} weight="light" />
    </button>
    </div>
    <div className="flex-1 overflow-y-auto custom-scroll">
    <LightboxInfo item={{ ...item, transcodeStatus }} folders={folders} />
    </div>
    </m.div>
      ) : (
    <m.div
    key="info-desktop"
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    transition={{ type: "spring", stiffness: 300, damping: 30 }}
    className="shrink-0 w-[320px] overflow-hidden border-l border-white/10"
    >
    <div className="w-[320px] h-full bg-panel-bg flex flex-col overflow-hidden">
    <div className="flex items-center justify-between px-4 h-11 border-b border-main-border shrink-0">
    <h3 className="text-xs text-muted-text font-medium">Details</h3>
    <button type="button" onClick={() => setIsInfoOpen(false)} aria-label="Close details" className="p-2 hover:bg-surface-bg rounded transition-colors cursor-pointer">
    <X size={16} weight="light" />
    </button>
    </div>
    <div className="flex-1 overflow-y-auto custom-scroll">
    <LightboxInfo item={{ ...item, transcodeStatus }} folders={folders} />
    </div>
    </div>
    </m.div>
      )
    )}
    </AnimatePresence>
    </>
    )}
    </m.div>
    </AnimatePresence>
  );
}
