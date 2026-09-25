"use client";

import type { ElementType } from "react";
import { Calendar, FilmStrip, Heart, Lock, MapPin, Trash } from "@phosphor-icons/react";
import type { MediaItem, MediaMetadata } from "../../types";
import { LightboxSheet, SheetField } from "./LightboxSheet";
import { formatDuration } from "@/core/utils/format";
import { formatDate, transcodeLabel } from "./LightboxFormat";

function StatusBadge({ icon: Icon, label, iconClass }: { icon: ElementType; label: string; iconClass?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1 text-[11px] font-medium text-white/75 ring-1 ring-white/10">
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
    <LightboxSheet icon={Calendar} title="Dates">
      <div className="grid grid-cols-2 gap-3">
        <SheetField label="Created" value={created} />
        <SheetField label="Captured" value={captured} />
        <SheetField label="Modified" value={modified} />
      </div>
    </LightboxSheet>
  );
}

export function LocationCard({ metadata }: { metadata: MediaMetadata }) {
  if (metadata.lat == null || metadata.lng == null) return null;
  return (
    <LightboxSheet icon={MapPin} title="Location">
      <a
        href={`https://www.google.com/maps?q=${metadata.lat},${metadata.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-mono text-[12px] text-white/88 underline decoration-white/25 underline-offset-4 hover:decoration-white/70 cursor-pointer"
      >
        {metadata.lat.toFixed(4)}, {metadata.lng.toFixed(4)}
      </a>
    </LightboxSheet>
  );
}

export function VideoInfoCard({ item, metadata }: { item: MediaItem; metadata: MediaMetadata }) {
  if (!item.mimeType?.startsWith("video/")) return null;
  return (
    <LightboxSheet icon={FilmStrip} title="Video">
      <div className="grid grid-cols-2 gap-3">
        <SheetField label="Duration" value={item.duration ? formatDuration(item.duration) : null} />
        <SheetField label="Codec" value={metadata.codec ? String(metadata.codec).toUpperCase() : null} />
        <SheetField label="Transcode" value={transcodeLabel(item.transcodeStatus)} />
      </div>
    </LightboxSheet>
  );
}