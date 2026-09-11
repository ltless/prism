"use client";

import { m, AnimatePresence } from "motion/react";
import { X, Download, CaretLeft, CaretRight, Info, Play, Pause } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

interface NavArrowProps {
  direction: "prev" | "next";
  visible: boolean;
  onClick: () => void;
}

function NavArrow({ direction, visible, onClick }: NavArrowProps) {
  const isPrev = direction === "prev";
  return (
    <AnimatePresence>
      {visible ? (
        <m.button
          key={direction}
          initial={{ opacity: 0, x: isPrev ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isPrev ? -10 : 10 }}
          transition={{ duration: 0.2 }}
          onClick={onClick}
          aria-label={isPrev ? "Previous" : "Next"}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 p-2.5 md:p-3.5 hover:bg-white/25 rounded-full text-white z-20 bg-black/50 backdrop-blur-sm border border-white/20 transition-colors cursor-pointer",
            isPrev ? "left-2 md:left-4" : "right-2 md:right-4"
          )}
        >
          {isPrev ? <CaretLeft size={24} weight="light" /> : <CaretRight size={24} weight="light" />}
        </m.button>
      ) : null}
    </AnimatePresence>
  );
}

interface TopBarProps {
  visible: boolean;
  title: string;
  mediaUrl: string;
  isInfoOpen: boolean;
  hasCounter: boolean;
  currentIndex?: number;
  totalItems?: number;
  onClose: () => void;
  onEdit: () => void;
  onInfoToggle: () => void;
  slideshow?: { isPlaying: boolean; onToggle: () => void };
}

function TopBar({ visible, title, mediaUrl, isInfoOpen, hasCounter, currentIndex, totalItems, onClose, onEdit, onInfoToggle, slideshow }: TopBarProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          key="top-bar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-4 md:px-6 z-20 bg-linear-to-b from-black/70 to-transparent pointer-events-none"
        >
          <div className="flex items-center gap-3 pointer-events-auto">
            <button type="button" onClick={onClose} aria-label="Close" className="p-2.5 hover:bg-white/15 rounded-md text-white transition-colors cursor-pointer">
              <X size={20} weight="light" />
            </button>
            <div className="flex flex-col">
              <h2 id="lightbox-title" className="text-xs text-white/90 font-medium truncate max-w-[200px] md:max-w-[400px]">{title}</h2>
              {hasCounter && (
                <span className="text-xs text-white/50">{currentIndex! + 1} / {totalItems}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {slideshow && (
              <button
                type="button"
                onClick={slideshow.onToggle}
                aria-label={slideshow.isPlaying ? "Pause slideshow" : "Play slideshow"}
                aria-pressed={slideshow.isPlaying}
                className={cn("p-2.5 rounded-md transition-colors cursor-pointer", slideshow.isPlaying ? "bg-white text-black" : "text-white hover:bg-white/15")}
              >
                {slideshow.isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
              </button>
            )}
            <button type="button" onClick={onEdit} aria-label="Edit" className="px-3 py-2 hover:bg-white/15 rounded-md text-xs text-white transition-colors cursor-pointer border border-white/10">
              Edit
            </button>
            <a href={mediaUrl} download={title} aria-label="Download" className="p-2.5 hover:bg-white/15 rounded-md text-white transition-colors inline-flex items-center justify-center">
              <Download size={18} weight="light" />
            </a>
            <button
              type="button"
              onClick={onInfoToggle}
              aria-label={isInfoOpen ? "Close info" : "Open info"}
              aria-pressed={isInfoOpen}
              className={cn("p-2.5 rounded-md transition-colors cursor-pointer", isInfoOpen ? "bg-white text-black" : "text-white hover:bg-white/15")}
            >
              <Info size={18} weight="light" />
            </button>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

interface LightboxControlsProps {
  view: { controls: boolean; video: boolean; imgLoaded: boolean };
  counter: { has: boolean; current?: number; total?: number };
  title: string;
  mediaUrl: string;
  isInfoOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onInfoToggle: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  slideshow?: { isPlaying: boolean; onToggle: () => void };
}

export function LightboxControls({
  view, counter, title, mediaUrl, isInfoOpen,
  onClose, onEdit, onInfoToggle, onPrev, onNext, slideshow,
}: LightboxControlsProps) {
  return (
    <>
      <NavArrow direction="prev" visible={view.controls && !!onPrev} onClick={onPrev ?? (() => {})} />
      <NavArrow direction="next" visible={view.controls && !!onNext} onClick={onNext ?? (() => {})} />
      <TopBar
        visible={view.controls}
        title={title}
        mediaUrl={mediaUrl}
        isInfoOpen={isInfoOpen}
        hasCounter={counter.has}
        currentIndex={counter.current}
        totalItems={counter.total}
        onClose={onClose}
        onEdit={onEdit}
        onInfoToggle={onInfoToggle}
        slideshow={slideshow}
      />
    </>
  );
}
