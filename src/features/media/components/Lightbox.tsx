"use client";

import { m, AnimatePresence } from "motion/react";
import { ImageBroken } from "@phosphor-icons/react";
import { useState, useEffect, useRef, useCallback, useEffectEvent } from "react";
import { MediaItem, Folder } from "../types";
import { VideoPlayer } from "./VideoPlayer";
import { useRouter } from "next/navigation";
import { ImageEditor } from "./lightbox/ImageEditor";
import { useTranscodePolling } from "../hooks/useTranscodePolling";
import { useScrollLock } from "@/shared/hooks/useScrollLock";
import { LightboxInfoPanel } from "./lightbox/LightboxInfoPanel";
import { LightboxControls } from "./lightbox/LightboxControls";

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
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset per-item UI state when the displayed item changes. Set-state-during-render
  // (React-endorsed for "reset on prop change") avoids the set-state-in-effect pattern.
  if (item.id !== prevId || item.transcodeStatus !== prevTranscodeStatus) {
    setPrevId(item.id);
    setPrevTranscodeStatus(item.transcodeStatus);
    setTranscodeStatus(item.transcodeStatus);
    setImgError(false);
    setImgLoaded(false);
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

  const onKeyAction = useEffectEvent((e: KeyboardEvent) => {
    const active = document.activeElement;
    const isInInput = active?.tagName === "INPUT" || active?.tagName === "TEXTAREA";
    if (isInInput) {
      if (e.key === "Escape") onClose();
      return;
    }
    if (e.key === "Escape") {
      if (isInfoOpen) { setIsInfoOpen(false); return; }
      onClose();
    }
    if (isInfoOpen) return;
    if (isVideo) return;
    if (e.key === "ArrowRight" && onNext) onNext();
    if (e.key === "ArrowLeft" && onPrev) onPrev();
    if (e.key === "i" || e.key === "I") setIsInfoOpen(v => !v);
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => onKeyAction(e);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Swipe navigation
  const swipeState = useRef<{ startX: number; startY: number } | null>(null);
  const SWIPE_THRESHOLD = 30;

  const handleTouchStart = (e: React.TouchEvent) => {
    showControls();
    if (isVideo) return;
    const touch = e.touches[0];
    swipeState.current = { startX: touch.clientX, startY: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeState.current || isVideo) return;
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
    swipeState.current = null;
  };

  const hasCounter = currentIndex !== undefined && totalItems !== undefined;

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-labelledby="lightbox-title"
      className="fixed inset-0 z-modal bg-black overflow-hidden flex"
      onMouseMove={showControls}
      onTouchStart={showControls}
    >
      <AnimatePresence mode="wait">
        {isEditing ? (
          <ImageEditor
            key="editor"
            item={item}
            onClose={() => setIsEditing(false)}
            onSuccess={() => router.refresh()}
          />
        ) : (
          <div key="viewer" className="contents">
            {/* Image viewport — flex-1, shrinks when info panel opens */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Image viewer"
              className="no-press-scale flex-1 relative flex items-center justify-center p-2 md:p-8 min-w-0"
              onMouseMove={showControls}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <AnimatePresence mode="wait">
                {isVideo ? (
                  <m.div
                    key={`video-${item.id}`}
                    initial={{ opacity: 0, x: 20, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -20, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.2 } }}
                    className="max-w-full max-h-full"
                  >
                    <VideoPlayer src={mediaUrl} autoPlay className="max-w-full max-h-full rounded-xl" />
                  </m.div>
                ) : imgError ? (
                  <m.div
                    key={`error-${item.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center justify-center w-full h-full"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <ImageBroken size={48} weight="light" className="text-white/20" />
                      <p className="text-xs text-white/30 font-medium">Failed to load image</p>
                    </div>
                  </m.div>
                ) : (
                  <m.div
                    key={`img-wrap-${item.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="relative w-full h-full flex items-center justify-center overflow-hidden"
                  >
                    {!imgLoaded && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-white/10 border-t-white/30 rounded-full animate-spin" />
                      </div>
                    )}
                    <m.img
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
                      className="max-w-full max-h-full object-contain shadow-2xl select-none"
                    />
                  </m.div>
                )}
              </AnimatePresence>

              <LightboxControls
                view={{ controls: controlsVisible, video: !!isVideo, imgLoaded }}
                counter={{ has: hasCounter, current: currentIndex, total: totalItems }}
                title={item.title}
                mediaUrl={mediaUrl}
                isInfoOpen={isInfoOpen}
                onClose={onClose}
                onEdit={() => setIsEditing(true)}
                onInfoToggle={() => setIsInfoOpen(v => !v)}
                onPrev={onPrev}
                onNext={onNext}
              />
            </div>

            {/* Info panel — pushes image aside (desktop) / bottom sheet (mobile) */}
            <AnimatePresence>
              {isInfoOpen ? (
                <LightboxInfoPanel
                  item={item}
                  transcodeStatus={transcodeStatus}
                  folders={folders}
                  isMobile={isMobile}
                  onClose={() => setIsInfoOpen(false)}
                />
              ) : null}
            </AnimatePresence>
          </div>
        )}
      </AnimatePresence>
    </m.div>
  );
}
