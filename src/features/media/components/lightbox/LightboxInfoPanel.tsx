"use client";

import { m } from "motion/react";
import { X } from "@phosphor-icons/react";
import { LightboxInfo } from "../LightboxInfo";
import { MediaItem, Folder } from "../../types";

interface LightboxInfoPanelProps {
  item: MediaItem;
  transcodeStatus: MediaItem["transcodeStatus"];
  folders?: Folder[];
  isMobile: boolean;
  onClose: () => void;
}

export function LightboxInfoPanel({ item, transcodeStatus, folders, isMobile, onClose }: LightboxInfoPanelProps) {
  if (isMobile) {
    return (
      <m.div
        key="info-mobile"
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute bottom-0 left-0 right-0 max-h-[55vh] bg-panel-bg rounded-t-2xl border-t border-main-border shadow-2xl z-30 flex flex-col overflow-hidden"
      >
        <div className="flex items-center justify-between px-4 h-11 border-b border-main-border shrink-0">
          <h3 className="text-xs text-muted-text font-medium">Details</h3>
          <button type="button" onClick={onClose} aria-label="Close details" className="p-2 hover:bg-surface-bg rounded transition-colors cursor-pointer">
            <X size={16} weight="light" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scroll">
          <LightboxInfo item={{ ...item, transcodeStatus }} folders={folders} />
        </div>
      </m.div>
    );
  }

  return (
    <m.div
      key="info-desktop"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 320, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="shrink-0 overflow-hidden border-l border-white/10"
    >
      <div className="w-[320px] h-full bg-panel-bg flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 h-11 border-b border-main-border shrink-0">
          <h3 className="text-xs text-muted-text font-medium">Details</h3>
          <button type="button" onClick={onClose} aria-label="Close details" className="p-2 hover:bg-surface-bg rounded transition-colors cursor-pointer">
            <X size={16} weight="light" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scroll">
          <LightboxInfo item={{ ...item, transcodeStatus }} folders={folders} />
        </div>
      </div>
    </m.div>
  );
}
