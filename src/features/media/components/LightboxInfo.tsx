"use client";

import {
  Calendar,
  Database,
  Copy,
  Check,
  Sparkle,
  FilmStrip,
  Heart,
  Lock,
  Trash,
  MapPin,
} from "@phosphor-icons/react";
import { useState, type ElementType } from "react";
import { MediaItem, MediaMetadata, Folder } from "../types";
import { ExifSettings } from "./lightbox/ExifSettings";
import { AestheticCard } from "./lightbox/AestheticCard";
import { ColorPalette } from "./lightbox/ColorPalette";
import { SectionCard, Field } from "@/shared/components/SectionCard";
import { TAG_TO_CATEGORY } from "@/features/ai/tag-candidates.mts";
import { formatDuration, formatBytes } from "@/core/utils/format";

interface LightboxInfoProps {
  item: MediaItem;
  folders?: Folder[];
}

function StatusBadge({ icon: Icon, label, iconClass }: { icon: ElementType; label: string; iconClass?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-bg border border-main-border/40 text-[11px] font-medium text-muted-text">
      <Icon size={11} weight="fill" className={iconClass} />
      {label}
    </span>
  );
}

function TagGroup({ tags, scores }: { tags: string[]; scores?: number[] }) {
  const grouped = new Map<string, { tag: string; score: number }[]>();
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i];
    const score = scores?.[i] ?? 0;
    const category = TAG_TO_CATEGORY[tag] ?? "Other";
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category)!.push({ tag, score });
  }
  const categories = Array.from(grouped.keys()).sort();
  return (
    <div className="space-y-3">
      {categories.map(cat => (
        <div key={cat}>
          <p className="text-[11px] font-medium text-muted-text mb-1.5">{cat}</p>
          <div className="flex flex-wrap gap-1.5">
            {grouped.get(cat)!.sort((a, b) => b.score - a.score).map(({ tag, score }) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-bg border border-main-border/40 text-[11px] font-medium text-muted-text"
              >
                {tag}
                {score > 0 && (
                  <span className="text-[10px] text-muted-text/60 font-mono">{(score * 100).toFixed(0)}%</span>
                )}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LightboxInfo({ item, folders }: LightboxInfoProps) {
  const [copiedHash, setCopiedHash] = useState(false);

  const metadata = (item.metadata || {}) as MediaMetadata;
  const palette = metadata.palette || [];
  const isVideo = item.mimeType?.startsWith("video/");
  const formattedDuration = item.duration ? formatDuration(item.duration) : null;

  const formatDate = (date: Date | string | number | null | undefined) => {
    if (!date) return null;
    let d: Date;
    if (date instanceof Date) d = date;
    else if (typeof date === "number") d = new Date(date < 1e12 ? date * 1000 : date);
    else d = new Date(date);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    }).format(d);
  };

  const copyHash = () => {
    if (!item.hash) return;
    navigator.clipboard.writeText(item.hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  const created = formatDate(item.createdAt);
  const captured = formatDate(item.capturedAt);
  const modified = formatDate(item.updatedAt);

  const folderName = item.folderId
    ? folders?.find(f => f.id === item.folderId)?.name ?? "Unknown"
    : "Library";

  const hasStatusBadges = item.isFavorite || item.isVault || item.isTrash || metadata.aiProcessed;
  const hasTags = metadata.tags && metadata.tags.length > 0;

  return (
    <div className="p-4 space-y-4">
      {/* Status badges */}
      {hasStatusBadges && (
        <div className="flex flex-wrap gap-1.5">
          {item.isFavorite && <StatusBadge icon={Heart} label="Favorite" iconClass="text-rose-500" />}
          {item.isVault && <StatusBadge icon={Lock} label="Vault" iconClass="text-primary" />}
          {item.isTrash && <StatusBadge icon={Trash} label="Trash" />}
          {metadata.aiProcessed && <StatusBadge icon={Sparkle} label="AI" iconClass="text-primary" />}
        </div>
      )}

      {/* Dates */}
      {(created || captured || modified) && (
        <SectionCard compact icon={Calendar} title="Dates">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Created" value={created} />
            <Field label="Captured" value={captured} />
            <Field label="Modified" value={modified} />
          </div>
        </SectionCard>
      )}

      {/* Location */}
      {metadata.lat != null && metadata.lng != null && (
        <SectionCard compact icon={MapPin} title="Location">
          <a
            href={`https://www.google.com/maps?q=${metadata.lat},${metadata.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-primary hover:underline cursor-pointer"
          >
            {metadata.lat.toFixed(4)}, {metadata.lng.toFixed(4)}
          </a>
        </SectionCard>
      )}

      {/* Video */}
      {isVideo && (
        <SectionCard compact icon={FilmStrip} title="Video">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Duration" value={formattedDuration} />
            <Field label="Codec" value={metadata.codec ? String(metadata.codec).toUpperCase() : null} />
            <Field label="Transcode" value={
              item.transcodeStatus === "done" ? "Complete"
              : item.transcodeStatus === "processing" ? "Encoding"
              : item.transcodeStatus === "failed" ? "Failed"
              : "Pending"
            } />
          </div>
        </SectionCard>
      )}

      {/* Camera */}
      {!isVideo && <ExifSettings metadata={metadata} />}

      {/* File */}
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
        <div className="pt-2.5 border-t border-main-border/30 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-text shrink-0">SHA-256</span>
          <button
            onClick={copyHash}
            aria-label="Copy hash"
            className="flex items-center gap-1.5 text-[11px] font-mono text-muted-text hover:text-primary transition-colors cursor-pointer min-w-0"
          >
            <span className="truncate">{item.hash || "\u2014"}</span>
            {copiedHash ? <Check size={12} weight="light" className="shrink-0" /> : <Copy size={12} weight="light" className="shrink-0" />}
          </button>
        </div>
      </SectionCard>

      {/* Quality */}
      <AestheticCard
        aestheticScore={metadata.aestheticScore}
        autofavorited={metadata.autofavorited}
        aestheticModel={metadata.aestheticModel}
        aestheticScoredAt={metadata.aestheticScoredAt}
      />

      {/* Tags */}
      {hasTags && (
        <SectionCard compact icon={Sparkle} title="Tags">
          <TagGroup tags={metadata.tags!} scores={metadata.tagScores} />
        </SectionCard>
      )}

      {/* Colors */}
      <ColorPalette palette={palette} />
    </div>
  );
}
