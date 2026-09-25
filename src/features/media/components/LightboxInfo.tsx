"use client";

import { Database, Copy, Check } from "@phosphor-icons/react";
import { useState } from "react";
import { MediaItem, MediaMetadata, Folder } from "../types";
import { ExifSettings } from "./lightbox/ExifSettings";
import { ColorPalette } from "./lightbox/ColorPalette";
import { LightboxSheet, SheetField } from "./lightbox/LightboxSheet";
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
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/8 pt-3">
      <span className="shrink-0 text-[10px] font-medium uppercase tracking-[0.14em] text-white/40">SHA-256</span>
      <button
        type="button"
        onClick={copyHash}
        aria-label="Copy hash"
        disabled={!hash}
        className="flex min-w-0 cursor-pointer items-center gap-1.5 font-mono text-[11px] text-white/70 hover:text-white disabled:cursor-default"
        style={{ transition: "color 400ms cubic-bezier(0.32,0.72,0,1)" }}
      >
        <span className="truncate">{hash || "n/a"}</span>
        {hash ? (copied ? <Check size={12} weight="light" className="shrink-0" /> : <Copy size={12} weight="light" className="shrink-0" />) : null}
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
    <div className="space-y-3 px-3.5 pb-5">
      <StatusBadgesRow item={item} />
      <DatesCard item={item} />
      <LocationCard metadata={metadata} />
      <VideoInfoCard item={item} metadata={metadata} />
      {!isVideo && <ExifSettings metadata={metadata} />}

      <LightboxSheet icon={Database} title="File">
        <div className="mb-3 grid grid-cols-2 gap-3">
          <SheetField label="Format" value={item.mimeType?.split('/')[1]?.toUpperCase()} />
          <SheetField label="Size" value={formatBytes(item.size)} />
          <SheetField label="Width" value={item.width ? `${item.width}px` : null} />
          <SheetField label="Height" value={item.height ? `${item.height}px` : null} />
        </div>
        <div className="space-y-3">
          <SheetField label="Folder" value={folderName} />
          <SheetField label="Path" value={item.filePath} />
        </div>
        <HashField hash={item.hash} />
      </LightboxSheet>

      <ColorPalette palette={palette} />
    </div>
  );
}