"use client";

import { m, AnimatePresence } from "motion/react";
import { ImageBroken } from "@phosphor-icons/react";
import { VideoPlayer } from "../VideoPlayer";

/**
 * The <AnimatePresence mode="wait"> media switcher: video player, image, or
 * the broken-image fallback. One branch per media kind, extracted so the
 * Lightbox shell stays about layout and controls.
 */
export function LightboxMediaArea({
  isVideo, mediaUrl, itemTitle, itemId, imgError, imgLoaded, setImgError, setImgLoaded,
}: {
  isVideo: boolean;
  mediaUrl: string;
  itemTitle: string;
  itemId: string;
  imgError: boolean;
  imgLoaded: boolean;
  setImgError: (v: boolean) => void;
  setImgLoaded: (v: boolean) => void;
}) {
  return (
    <AnimatePresence mode="wait">
      {isVideo ? (
        <m.div
          key={`video-${itemId}`}
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
          key={`error-${itemId}`}
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
          key={`img-wrap-${itemId}`}
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
            alt={itemTitle}
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
  );
}
