"use client";

import { useState } from "react";
import Image from "next/image";
import { Play, Spinner, Warning, Star, Trash, Image as ImageIcon, FileVideo } from "@phosphor-icons/react";
import { m, AnimatePresence } from "motion/react";
import { cn } from "@/core/utils/cn";

export function MediaCardThumb({
  imageUrl, title, isVideo, priority, isDeleting, isSelected, isCut,
}: {
  imageUrl: string;
  title: string;
  isVideo: boolean;
  priority: boolean;
  isDeleting: boolean;
  isSelected: boolean;
  isCut: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (imgError) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-surface-bg">
        <div className="flex flex-col items-center gap-1.5">
          {isVideo ? <FileVideo size={28} weight="light" className="text-muted-text/30" /> : <ImageIcon size={28} weight="light" className="text-muted-text/30" />}
          <span className="text-[11px] text-muted-text/40 font-bold uppercase tracking-wider">
            {isVideo ? "Video" : "Image"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Image
        src={imageUrl}
        alt={title}
        fill
        priority={priority}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
        onError={() => setImgError(true)}
        onLoad={() => setImgLoaded(true)}
        className={cn(
          "object-cover select-none pointer-events-none transition-[opacity,filter,transform] duration-500 ease-out-expo group-hover/card:scale-[1.03]",
          imgLoaded ? "opacity-100 blur-0" : "opacity-0 blur-sm",
          isDeleting ? "opacity-50 grayscale blur-sm" : isSelected ? "opacity-80" : "",
          isCut ? "opacity-40 grayscale" : ""
        )}
        unoptimized
      />
      {!imgLoaded && (
        <div className="absolute inset-0 bg-surface-bg animate-pulse" />
      )}
    </>
  );
}

export function VideoBadges({ isVideo, duration, transcodeStatus }: {
  isVideo: boolean;
  duration: string | null;
  transcodeStatus: string | null | undefined;
}) {
  if (!isVideo) return null;

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <div className="w-10 h-10 rounded-full bg-black/50 border border-white/20 flex items-center justify-center">
          <Play size={16} weight="fill" className="text-white ml-0.5" />
        </div>
      </div>

      {duration && (
        <div className="absolute bottom-2 left-2 z-10 px-1.5 py-0.5 rounded-lg bg-black/70 text-[11px] text-white tracking-wider tabular-nums">
          {duration}
        </div>
      )}

      {transcodeStatus === "processing" && (
        <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-full bg-violet-500/80 text-[11px] text-white flex items-center gap-1">
          <Spinner size={8} weight="bold" className="animate-spin" />
          Encoding
        </div>
      )}
      {transcodeStatus === "failed" && (
        <div className="absolute top-2 left-2 z-10 px-1.5 py-0.5 rounded-full bg-rose-500/80 text-[11px] text-white flex items-center gap-1">
          <Warning size={8} weight="fill" />
          Failed
        </div>
      )}
    </>
  );
}

export function CardHoverOverlay({
  visible, title, dimensions, isFav, isDeleting, onDelete, onToggleFavorite,
}: {
  visible: boolean;
  title: string;
  dimensions: string;
  isFav: boolean;
  isDeleting: boolean;
  onDelete: (e: React.MouseEvent) => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent flex items-end p-2.5"
        >
          <div className="flex flex-col gap-0.5 w-full">
            <p className="text-xs text-white font-semibold truncate antialiased">{title}</p>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-white/70 font-bold antialiased">{dimensions}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  type="button"
                  className="text-white/40 hover:text-rose-500 transition-colors p-1"
                  title="Move to Trash"
                >
                  <Trash size={12} weight="light" />
                </button>
                <button
                  onClick={onToggleFavorite}
                  type="button"
                  className={cn("transition-colors p-1", isFav ? "text-yellow-400" : "text-white/40 hover:text-yellow-400")}
                  title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star size={12} weight={isFav ? "fill" : "light"} />
                </button>
              </div>
            </div>
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}
