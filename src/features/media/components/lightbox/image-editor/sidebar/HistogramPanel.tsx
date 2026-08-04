"use client";

import { ChartBar } from "@phosphor-icons/react";
import { Histogram } from "./Histogram";
import { PanelHeader } from "../../EditorSidebar";

interface HistogramPanelProps {
  mediaUrl: string;
  onClose: () => void;
}

export function HistogramPanel({ mediaUrl, onClose }: HistogramPanelProps) {
  return (
    <div className="border-b border-main-border">
      <PanelHeader icon={ChartBar} label="Histogram" onClose={onClose} />
      <div className="px-3 pb-3 pt-2">
        <Histogram mediaUrl={mediaUrl} />
        <p className="text-[11px] text-muted-text/70 mt-2 uppercase tracking-wider">
          RGB channel distribution
        </p>
      </div>
    </div>
  );
}
