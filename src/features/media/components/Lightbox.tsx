"use client";

import { m, AnimatePresence, MotionConfig } from "motion/react";
import { useState } from "react";
import { MediaItem, Folder } from "../types";
import { useRouter } from "next/navigation";
import { ImageEditor } from "./lightbox/ImageEditor";
import { useTranscodePolling } from "../hooks/useTranscodePolling";
import { useSlideshow } from "../hooks/useSlideshow";
import { useLightboxState } from "../hooks/useLightboxState";
import { useScrollLock } from "@/shared/hooks/useScrollLock";
import { LightboxInfoPanel } from "./lightbox/LightboxInfoPanel";
import { LightboxControls } from "./lightbox/LightboxControls";
import { LightboxMediaArea } from "./lightbox/LightboxMediaArea";

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
  const [prevId, setPrevId] = useState(item.id);
  const [prevTranscodeStatus, setPrevTranscodeStatus] = useState(item.transcodeStatus);
  const [transcodeStatus, setTranscodeStatus] = useState(item.transcodeStatus);
  const [isEditing, setIsEditing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

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

  const { isMobile, controlsVisible, showControls, handleTouchStart, handleTouchMove, handleTouchEnd } =
    useLightboxState({
      isVideo: !!isVideo,
      isInfoOpen,
      onClose,
      onToggleInfo: () => setIsInfoOpen(v => !v),
      onNext,
      onPrev,
    });

  useTranscodePolling(item.id, transcodeStatus, !!isVideo, setTranscodeStatus);
  useScrollLock(true);

  const hasCounter = currentIndex !== undefined && totalItems !== undefined;

  // Slideshow: photos only, stops at the end of the list (no wrap-around).
  const slideshowEnabled = !isVideo && !!onNext && hasCounter
    ? currentIndex! < totalItems! - 1
    : false;
  const [isSlideshow, toggleSlideshow] = useSlideshow(slideshowEnabled, onNext ?? (() => {}));

  return (
    <MotionConfig reducedMotion="user">
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-labelledby="lightbox-title"
      className="fixed inset-0 z-modal overflow-hidden flex bg-[#070708]"
      onMouseMove={showControls}
      onTouchStart={showControls}
    >
      {/* Stage wash. Fixed, pointer-events none. No scroll repaint. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[18%] h-[42vh] w-[68vw] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,255,255,0.055),transparent)]" />
        <div
          className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
          }}
        />
      </div>
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
            {/* Stage stays full-bleed. Details float over the right edge
                (or a bottom sheet on mobile) so the frame never reflows. */}
            <m.div
              role="button"
              tabIndex={0}
              aria-label="Image viewer"
              className="no-press-scale flex-1 relative z-[1] flex items-center justify-center px-3 pt-20 pb-16 md:px-8 md:pt-24 md:pb-20 min-w-0"
              onMouseMove={showControls}
              onClick={showControls}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <LightboxMediaArea
                  isVideo={!!isVideo}
                  mediaUrl={mediaUrl}
                  itemTitle={item.title}
                  itemId={item.id}
                  imgError={imgError}
                  imgLoaded={imgLoaded}
                  setImgError={setImgError}
                  setImgLoaded={setImgLoaded}
                />

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
                  slideshow={!isVideo && onNext && hasCounter ? { isPlaying: isSlideshow, onToggle: toggleSlideshow } : undefined}
                />
            </m.div>

            {/* Details overlay. Desktop floats right. Mobile is a bottom sheet. */}
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
    </MotionConfig>
  );
}
