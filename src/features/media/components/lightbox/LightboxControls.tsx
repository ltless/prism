import { m, AnimatePresence } from "motion/react";
import { X, Download, CaretLeft, CaretRight, Info, Play, Pause, PencilSimple } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

interface NavArrowProps {
  direction: "prev" | "next";
  visible: boolean;
  onClick: () => void;
}

/** Slim, edge-docked chevron — whispers, doesn't shout. */
function NavArrow({ direction, visible, onClick }: NavArrowProps) {
  const isPrev = direction === "prev";
  return (
    <AnimatePresence>
      {visible ? (
        <m.button
          key={direction}
          initial={{ opacity: 0, x: isPrev ? -8 : 8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: isPrev ? -8 : 8 }}
          transition={{ duration: 0.2 }}
          onClick={onClick}
          aria-label={isPrev ? "Previous" : "Next"}
          className={cn(
            "absolute top-1/2 -translate-y-1/2 p-1.5 md:p-2 rounded-full text-white/70 hover:text-white hover:bg-white/15 z-20 bg-black/30 transition-colors cursor-pointer",
            isPrev ? "left-1.5 md:left-3" : "right-1.5 md:right-3"
          )}
        >
          {isPrev ? <CaretLeft size={20} weight="light" /> : <CaretRight size={20} weight="light" />}
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
  onClose: () => void;
  onEdit: () => void;
  onInfoToggle: () => void;
  slideshow?: { isPlaying: boolean; onToggle: () => void };
}

/** Minimal top chrome: fades away, only the title and icon actions remain. */
function TopBar({ visible, title, mediaUrl, isInfoOpen, onClose, onEdit, onInfoToggle, slideshow }: TopBarProps) {
  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          key="top-bar"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="absolute top-0 left-0 right-0 h-12 flex items-center justify-between px-3 md:px-5 z-20 bg-linear-to-b from-black/50 to-transparent pointer-events-none"
        >
          <div className="flex items-center gap-2.5 pointer-events-auto min-w-0">
            <button type="button" onClick={onClose} aria-label="Close" className="p-2 hover:bg-white/15 rounded-md text-white transition-colors cursor-pointer shrink-0">
              <X size={18} weight="light" />
            </button>
            <h2 id="lightbox-title" className="text-xs text-white/80 font-medium truncate pointer-events-none">{title}</h2>
          </div>
          <div className="flex items-center gap-1 pointer-events-auto">
            {slideshow && (
              <button
                type="button"
                onClick={slideshow.onToggle}
                aria-label={slideshow.isPlaying ? "Pause slideshow" : "Play slideshow"}
                aria-pressed={slideshow.isPlaying}
                className={cn("p-2 rounded-md transition-colors cursor-pointer", slideshow.isPlaying ? "bg-white text-black" : "text-white hover:bg-white/15")}
              >
                {slideshow.isPlaying ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
              </button>
            )}
            <button type="button" onClick={onEdit} aria-label="Edit" className="p-2 hover:bg-white/15 rounded-md text-white transition-colors cursor-pointer">
              <PencilSimple size={18} weight="light" />
            </button>
            <a href={mediaUrl} download={title} aria-label="Download" className="p-2 hover:bg-white/15 rounded-md text-white transition-colors inline-flex items-center justify-center">
              <Download size={18} weight="light" />
            </a>
            <button
              type="button"
              onClick={onInfoToggle}
              aria-label={isInfoOpen ? "Close info" : "Open info"}
              aria-pressed={isInfoOpen}
              className={cn("p-2 rounded-md transition-colors cursor-pointer", isInfoOpen ? "bg-white text-black" : "text-white hover:bg-white/15")}
            >
              <Info size={18} weight="light" />
            </button>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Tiny bottom-center progress pill — the counter, out of the way. */
function CounterPill({ visible, current, total }: { visible: boolean; current: number; total: number }) {
  return (
    <AnimatePresence>
      {visible ? (
        <m.div
          key="counter-pill"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-2.5 py-1 rounded-full bg-black/40 text-[11px] text-white/60 tabular-nums backdrop-blur-sm pointer-events-none"
        >
          {current + 1} / {total}
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