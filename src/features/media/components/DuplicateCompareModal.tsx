"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { m, AnimatePresence } from "motion/react";
import type { MediaItem } from "../types";
import type { DuplicateScore } from "../utils/duplicateScoring";
import { CompareToolbar } from "./duplicate-compare/CompareToolbar";
import { CompareImageArea } from "./duplicate-compare/CompareImageArea";
import { CompareBottomBar } from "./duplicate-compare/CompareBottomBar";

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

  const handleSelectIndex = (idx: number) => {
    setActiveIndex(idx);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          role="dialog" aria-modal="true" aria-label="Duplicate comparison"
          className="fixed inset-0 z-modal bg-black flex flex-col"
          onClick={onClose}
        >
          <CompareToolbar
            activeIndex={activeIndex}
            totalItems={items.length}
            isBest={isBest}
            zoom={zoom}
            showInfo={showInfo}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onToggleInfo={() => setShowInfo(prev => !prev)}
            onClose={onClose}
          />

          <CompareImageArea
            item={item}
            zoom={zoom}
            position={position}
            isDragging={isDragging}
            containerRef={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onPrev={handlePrev}
            onNext={handleNext}
          />

          <CompareBottomBar
            item={item}
            score={score}
            isBest={isBest}
            showInfo={showInfo}
            items={items}
            scores={scores}
            bestIndex={bestIndex}
            activeIndex={activeIndex}
            folderName={folderName}
            isResolving={isResolving}
            onKeep={onKeep}
            onSelectIndex={handleSelectIndex}
          />
        </m.div>
      )}
    </AnimatePresence>
  );
}
