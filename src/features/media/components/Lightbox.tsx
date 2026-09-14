"use client";

import { m, AnimatePresence } from "motion/react";
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
            {/* layout prop: when the info panel mounts/unmounts, Motion animates
                this viewport's resize via transform (layout projection) instead
                of a per-frame flex reflow. */}
            <m.div
              layout
              role="button"
              tabIndex={0}
              aria-label="Image viewer"
              className="no-press-scale flex-1 relative flex items-center justify-center p-2 md:p-8 min-w-0"
              onMouseMove={showControls}
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
