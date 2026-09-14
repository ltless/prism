"use client";

import type { ElementType } from "react";
import { Calendar, FilmStrip, Heart, Lock, MapPin, Trash } from "@phosphor-icons/react";
import type { MediaItem, MediaMetadata } from "../../types";
import { SectionCard, Field } from "@/shared/components/SectionCard";
import { formatDuration } from "@/core/utils/format";
import { formatDate, transcodeLabel } from "./LightboxFormat";

function StatusBadge({ icon: Icon, label, iconClass }: { icon: ElementType; label: string; iconClass?: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-bg border border-main-border/40 text-[11px] font-medium text-muted-text">
      <Icon size={11} weight="fill" className={iconClass} />
      {label}
    </span>
  );
}

export function StatusBadgesRow({ item }: { item: MediaItem }) {
  if (!(item.isFavorite || item.isVault || item.isTrash)) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.isFavorite && <StatusBadge icon={Heart} label="Favorite" iconClass="text-rose-500" />}
      {item.isVault && <StatusBadge icon={Lock} label="Vault" iconClass="text-primary" />}
      {item.isTrash && <StatusBadge icon={Trash} label="Trash" />}
    </div>
  );
}

export function DatesCard({ item }: { item: MediaItem }) {
  const created = formatDate(item.createdAt);
  const captured = formatDate(item.capturedAt);
  const modified = formatDate(item.updatedAt);
  if (!(created || captured || modified)) return null;

  return (
    <SectionCard compact icon={Calendar} title="Dates">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Created" value={created} />
        <Field label="Captured" value={captured} />
        <Field label="Modified" value={modified} />
      </div>
    </SectionCard>
  );
}

export function LocationCard({ metadata }: { metadata: MediaMetadata }) {
  if (metadata.lat == null || metadata.lng == null) return null;
  return (
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
  );
}

export function VideoInfoCard({ item, metadata }: { item: MediaItem; metadata: MediaMetadata }) {
  if (!item.mimeType?.startsWith("video/")) return null;
  return (
    <SectionCard compact icon={FilmStrip} title="Video">
      <div className="grid grid-cols-2 gap-2.5">
        <Field label="Duration" value={item.duration ? formatDuration(item.duration) : null} />
        <Field label="Codec" value={metadata.codec ? String(metadata.codec).toUpperCase() : null} />
        <Field label="Transcode" value={transcodeLabel(item.transcodeStatus)} />
      </div>
    </SectionCard>
  );
}