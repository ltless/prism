"use client";

import { m, AnimatePresence } from "motion/react";
import { ImageBroken } from "@phosphor-icons/react";
import { VideoPlayer } from "../VideoPlayer";

const FADE = { duration: 0.55, ease: [0.32, 0.72, 0, 1] as const };

/**
 * Media switcher. Cross-fade only (transform + opacity). The plate is a
 * double-bezel so the picture sits in a machined tray, not flat on black.
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
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={FADE}
          className="max-w-full max-h-full rounded-[1.35rem] p-1.5 ring-1 ring-white/10 bg-white/4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        >
          <VideoPlayer src={mediaUrl} autoPlay className="max-w-full max-h-full rounded-[calc(1.35rem-0.375rem)]" />
        </m.div>
      ) : imgError ? (
        <m.div
          key={`error-${itemId}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={FADE}
          className="flex items-center justify-center"
        >
          <div className="flex flex-col items-center gap-4 rounded-[1.75rem] bg-white/4 px-10 py-9 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/6 ring-1 ring-white/10">
              <ImageBroken size={26} weight="light" className="text-white/55" />
            </div>
            <div className="text-center">
              <p className="text-[13px] font-medium tracking-[-0.01em] text-white/80">Image unavailable</p>
              <p className="mt-1 text-[11px] text-white/40">The file could not be read.</p>
            </div>
          </div>
        </m.div>
      ) : (
        <m.div
          key={`img-wrap-${itemId}`}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.985 }}
          transition={FADE}
          className="relative flex max-h-full max-w-full items-center justify-center"
        >
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
              <div className="h-16 w-24 rounded-2xl bg-white/5 ring-1 ring-white/8 animate-pulse" />
            </div>
          )}
          <div className="rounded-[1.35rem] p-1.5 ring-1 ring-white/10 bg-white/4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
            <m.img
              src={mediaUrl}
              alt={itemTitle}
              draggable={false}
              loading="eager"
              onError={() => setImgError(true)}
              onLoad={() => setImgLoaded(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: imgLoaded ? 1 : 0 }}
              transition={FADE}
              className="max-h-[calc(100dvh-7.5rem)] max-w-[calc(100vw-2.5rem)] md:max-w-[calc(100vw-8rem)] object-contain select-none rounded-[calc(1.35rem-0.375rem)]"
            />
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
