"use client";

import { m } from "motion/react";
import { X } from "@phosphor-icons/react";
import { LightboxInfo } from "../LightboxInfo";
import { MediaItem, Folder } from "../../types";

const PANEL = { duration: 0.55, ease: [0.32, 0.72, 0, 1] as const };

interface LightboxInfoPanelProps {
  item: MediaItem;
  transcodeStatus: MediaItem["transcodeStatus"];
  folders?: Folder[];
  isMobile: boolean;
  onClose: () => void;
}

function PanelHead({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 h-12 shrink-0">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">Details</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white cursor-pointer active:scale-[0.96]"
        style={{ transition: "transform 400ms cubic-bezier(0.32,0.72,0,1), background-color 400ms cubic-bezier(0.32,0.72,0,1)" }}
      >
        <X size={14} weight="light" />
      </button>
    </div>
  );
}

export function LightboxInfoPanel({ item, transcodeStatus, folders, isMobile, onClose }: LightboxInfoPanelProps) {
  if (isMobile) {
    return (
      <m.div
        key="info-mobile"
        initial={{ y: "108%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "108%", opacity: 0 }}
        transition={PANEL}
        className="absolute bottom-0 left-0 right-0 z-30 flex max-h-[62dvh] flex-col overflow-hidden px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[1.6rem] bg-[#101012]/92 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_-24px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-white/20" aria-hidden />
          <PanelHead onClose={onClose} />
          <div className="min-h-0 flex-1 overflow-y-auto custom-scroll">
            <LightboxInfo item={{ ...item, transcodeStatus }} folders={folders} />
          </div>
        </div>
      </m.div>
    );
  }

  return (
    <m.div
      key="info-desktop"
      initial={{ x: 28, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 28, opacity: 0 }}
      transition={PANEL}
      className="pointer-events-none absolute inset-y-0 right-0 z-30 flex items-stretch py-5 pr-5"
    >
      <div className="pointer-events-auto flex h-full w-[340px] flex-col overflow-hidden rounded-[1.6rem] bg-[#101012]/88 p-1.5 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[calc(1.6rem-0.375rem)] bg-white/[0.025]">
          <PanelHead onClose={onClose} />
          <div className="min-h-0 flex-1 overflow-y-auto custom-scroll">
            <LightboxInfo item={{ ...item, transcodeStatus }} folders={folders} />
          </div>
        </div>
      </div>
    </m.div>
  );
}
