"use client";

import { Database, Copy, Check } from "@phosphor-icons/react";
import { useState } from "react";
import { MediaItem, MediaMetadata, Folder } from "../types";
import { ExifSettings } from "./lightbox/ExifSettings";
import { ColorPalette } from "./lightbox/ColorPalette";
import { SectionCard, Field } from "@/shared/components/SectionCard";
import { formatBytes } from "@/core/utils/format";
import { StatusBadgesRow, DatesCard, LocationCard, VideoInfoCard } from "./lightbox/LightboxCards";

interface LightboxInfoProps {
  item: MediaItem;
  folders?: Folder[];
}

function HashField({ hash }: { hash: string | null }) {
  const [copied, setCopied] = useState(false);

  const copyHash = () => {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-2.5 border-t border-main-border/30 flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-muted-text shrink-0">SHA-256</span>
      <button
        type="button"
        onClick={copyHash}
        aria-label="Copy hash"
        className="flex items-center gap-1.5 text-[11px] font-mono text-muted-text hover:text-primary transition-colors cursor-pointer min-w-0"
      >
        <span className="truncate">{hash || "\u2014"}</span>
        {copied ? <Check size={12} weight="light" className="shrink-0" /> : <Copy size={12} weight="light" className="shrink-0" />}
      </button>
    </div>
  );
}

export function LightboxInfo({ item, folders }: LightboxInfoProps) {
  const metadata = (item.metadata || {}) as MediaMetadata;
  const palette = metadata.palette || [];
  const isVideo = item.mimeType?.startsWith("video/");

  const folderName = item.folderId
    ? folders?.find(f => f.id === item.folderId)?.name ?? "Unknown"
    : "Library";

  return (
    <div className="p-4 space-y-4">
      <StatusBadgesRow item={item} />
      <DatesCard item={item} />
      <LocationCard metadata={metadata} />
      <VideoInfoCard item={item} metadata={metadata} />
      {!isVideo && <ExifSettings metadata={metadata} />}

      <SectionCard compact icon={Database} title="File">
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <Field label="Format" value={item.mimeType?.split('/')[1]?.toUpperCase()} />
          <Field label="Size" value={formatBytes(item.size)} />
          <Field label="Width" value={item.width ? `${item.width}px` : null} />
          <Field label="Height" value={item.height ? `${item.height}px` : null} />
        </div>
        <div className="space-y-2.5 mb-2.5">
          <Field label="Folder" value={folderName} />
          <Field label="Path" value={item.filePath} />
        </div>
        <HashField hash={item.hash} />
      </SectionCard>

      <ColorPalette palette={palette} />
    </div>
  );
}