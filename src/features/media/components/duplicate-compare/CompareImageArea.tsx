"use client";

import Image from "next/image";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import type { MediaItem } from "../../types";

interface CompareImageAreaProps {
  item: MediaItem;
  zoom: number;
  position: { x: number; y: number };
  isDragging: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function CompareImageArea({ item, zoom, position, isDragging, containerRef, onMouseDown, onMouseMove, onMouseUp, onPrev, onNext }: CompareImageAreaProps) {
  return (
    <div
      ref={containerRef}
      role="group"
      aria-label="Image comparison viewer"
      className="flex-1 relative flex items-center justify-center overflow-hidden"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
    >
      {/* Nav Buttons */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        aria-label="Previous image"
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-black/30 hover:bg-black/50 transition-colors cursor-pointer"
      >
        <CaretLeft size={20} weight="light" className="text-white" />
      </button>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        aria-label="Next image"
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
  );
}
