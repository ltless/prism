"use client";

import { useState } from "react";
import Image from "next/image";
import { Play, Spinner, Warning, Star, Trash, Image as ImageIcon, FileVideo } from "@phosphor-icons/react";
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
          "pointer-events-none select-none object-cover transition-opacity duration-200",
          imgLoaded ? "opacity-100" : "opacity-0",
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
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 ring-1 ring-white/30">
          <Play size={15} weight="fill" className="ml-0.5 text-white" />
        </div>
      </div>

      {duration && (
        <div className="absolute bottom-3 left-3 z-10 rounded-full bg-black/55 px-2 py-0.5 text-[10px] tracking-[0.08em] text-white tabular-nums">
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
    <div
      className={cn(
        "absolute inset-0 flex items-end bg-linear-to-t from-black/80 via-black/15 to-transparent p-3.5 transition-opacity duration-150",
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      )}
    >
          <div className="flex w-full flex-col gap-1">
            <p className="truncate text-[13px] font-medium tracking-[-0.01em] text-white">{title}</p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/65">{dimensions}</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={onDelete}
                  disabled={isDeleting}
                  type="button"
                  className="p-1 text-white/40 hover:text-rose-500"
                  title="Move to Trash"
                >
                  <Trash size={12} weight="light" />
                </button>
                <button
                  onClick={onToggleFavorite}
                  type="button"
                  className={cn("p-1", isFav ? "text-yellow-400" : "text-white/40 hover:text-yellow-400")}
                  title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                >
                  <Star size={12} weight={isFav ? "fill" : "light"} />
                </button>
              </div>
            </div>
          </div>
    </div>
  );
}
