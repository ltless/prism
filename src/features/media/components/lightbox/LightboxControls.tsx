"use client";

import { m, AnimatePresence } from "motion/react";
import { X, Download, CaretLeft, CaretRight, Info, Play, Pause, PencilSimple } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { GlassIsland, IslandButton, CHROME_EASE } from "./LightboxChrome";

const SPRING = { duration: 0.55, ease: [0.32, 0.72, 0, 1] as const };

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
        <m.div
          key={direction}
          initial={{ opacity: 0, x: isPrev ? -16 : 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isPrev ? -16 : 16 }}
          transition={SPRING}
          className={cn(
            "absolute top-1/2 z-20 -translate-y-1/2",
            isPrev ? "left-3 md:left-6" : "right-3 md:right-6",
          )}
        >
          <GlassIsland>
            <IslandButton
              onClick={onClick}
              aria-label={isPrev ? "Previous" : "Next"}
              className="h-11 w-11"
            >
              {isPrev
                ? <CaretLeft size={18} weight="light" className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-x-0.5" />
                : <CaretRight size={18} weight="light" className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5" />}
            </IslandButton>
          </GlassIsland>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

interface TopBarProps {
  visible: boolean;
  title: string;
  mediaUrl: string;
  isInfoOpen: boolean;
  onClose: () => void;
  onEdit: () => void;
  onInfoToggle: () => void;
  slideshow?: { isPlaying: boolean; onToggle: () => void };
}

function TopBar({ visible, title, mediaUrl, isInfoOpen, onClose, onEdit, onInfoToggle, slideshow }: TopBarProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          key="top-bar"
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={SPRING}
          className="absolute top-4 md:top-6 left-0 right-0 z-20 flex items-center justify-between gap-3 px-3 md:px-6 pointer-events-none"
        >
          <GlassIsland className="min-w-0 max-w-[58%]">
            <IslandButton onClick={onClose} aria-label="Close" className="shrink-0">
              <X size={16} weight="light" />
            </IslandButton>
            <h2
              id="lightbox-title"
              className="truncate pr-4 pl-1 text-[13px] font-medium tracking-[-0.01em] text-white/85 pointer-events-none"
            >
              {title}
            </h2>
          </GlassIsland>

          <GlassIsland className="shrink-0">
            {slideshow && (
              <IslandButton
                onClick={slideshow.onToggle}
                aria-label={slideshow.isPlaying ? "Pause slideshow" : "Play slideshow"}
                aria-pressed={slideshow.isPlaying}
                active={slideshow.isPlaying}
              >
                {slideshow.isPlaying ? <Pause size={15} weight="fill" /> : <Play size={15} weight="fill" />}
              </IslandButton>
            )}
            <IslandButton onClick={onEdit} aria-label="Edit">
              <PencilSimple size={16} weight="light" />
            </IslandButton>
            <a
              href={mediaUrl}
              download={title}
              aria-label="Download"
              className="group flex h-9 w-9 items-center justify-center rounded-full text-white/75 hover:bg-white/10 hover:text-white active:scale-[0.96]"
              style={{ transition: `transform 400ms ${CHROME_EASE}, background-color 400ms ${CHROME_EASE}, color 400ms ${CHROME_EASE}` }}
            >
              <Download
                size={16}
                weight="light"
                className="transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-y-px"
              />
            </a>
            <IslandButton
              onClick={onInfoToggle}
              aria-label={isInfoOpen ? "Close info" : "Open info"}
              aria-pressed={isInfoOpen}
              active={isInfoOpen}
            >
              <Info size={16} weight="light" />
            </IslandButton>
          </GlassIsland>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

function CounterPill({ visible, current, total }: { visible: boolean; current: number; total: number }) {
  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          key="counter-pill"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={SPRING}
          className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 pointer-events-none"
        >
          <div className="rounded-full bg-[#0c0c0e]/72 px-3.5 py-1.5 text-[11px] tabular-nums tracking-[0.14em] text-white/70 ring-1 ring-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] backdrop-blur-2xl">
            {String(current + 1).padStart(2, "0")}
            <span className="mx-1.5 text-white/30">/</span>
            {String(total).padStart(2, "0")}
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
        onClose={onClose}
        onEdit={onEdit}
        onInfoToggle={onInfoToggle}
        slideshow={slideshow}
      />
      {counter.has && counter.current !== undefined && counter.total !== undefined && (
        <CounterPill visible={view.controls} current={counter.current} total={counter.total} />
      )}
    </>
  );
}
