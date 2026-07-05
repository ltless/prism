"use client";

import Image from "next/image";
import { MediaItem } from "../types/index";
import { useState, useMemo } from "react";
import { Check, Spinner, Folder, Sparkle } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { formatBytes } from "@/core/utils/format";
import { toast } from "sonner";
import { findBestItem, scoreDuplicateItem } from "../utils/duplicateScoring";
import { DuplicateCompareModal } from "./DuplicateCompareModal";
import { resolveDuplicateAction } from "../services/mediaFavoriteActions";

export interface DuplicateGroup {
 id: string;
 hash: string;
 items: MediaItem[];
 isNearDuplicate: boolean;
}

export function DuplicateList({ groups, folderMap = {} }: { groups: DuplicateGroup[]; folderMap?: Record<string, string> }) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [compareModal, setCompareModal] = useState<{ groupId: string; index: number } | null>(null);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

 const handleKeep = async (keepItem: MediaItem, allItems: MediaItem[]) => {
 setResolvingId(keepItem.id);
 const trashIds = allItems.filter(i => i.id !== keepItem.id).map(i => i.id);

 try {
 const res = await resolveDuplicateAction(keepItem.id, trashIds);
 if (res.success) {
 toast.success("Duplicates resolved");
 } else {
 toast.error("Failed to resolve duplicates: " + res.error);
 }
 } catch {
 toast.error("Failed to resolve duplicates");
 } finally {
 setResolvingId(null);
 }
 };

 const groupScores = useMemo(() => {
 return groups.map(group => ({
 scores: group.items.map(item => scoreDuplicateItem(item)),
 best: findBestItem(group.items),
 }));
 }, [groups]);

 const { totalGroups, totalItems, totalSavings } = useMemo(() => {
 return groups.reduce((acc, group) => {
 if (group.items.length <= 1) return acc;
 const best = findBestItem(group.items);
 const savings = best
 ? group.items.filter(i => i.id !== best.item.id).reduce((s, i) => s + i.size, 0)
 : 0;
 return {
 totalGroups: acc.totalGroups + 1,
 totalItems: acc.totalItems + group.items.length,
 totalSavings: acc.totalSavings + savings,
 };
 }, { totalGroups: 0, totalItems: 0, totalSavings: 0 });
 }, [groups]);

 if (groups.length === 0) {
 return (
 <div className="flex h-full items-center justify-center p-12">
 <div className="max-w-md w-full text-center space-y-8">
 <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
 <div className="absolute inset-0 bg-emerald-500/10 rounded-full" />
 <div className="text-emerald-500/60">
 <Check size={40} weight="light" />
 </div>
 </div>

 <div className="space-y-2">
 <p className="text-sm font-semibold text-main-text">All Clear</p>
 <p className="text-xs text-muted-text max-w-[280px] mx-auto">
 No exact or near-duplicates found. Your library is clean and organized.
 </p>
 </div>

 <div className="px-4 py-3 bg-surface-bg border border-main-border/50 rounded-xl max-w-[300px] mx-auto">
 <p className="text-[11px] text-muted-text/60">
 Tip: Enable auto-tagging in Settings to let AI organize your photos automatically.
 </p>
 </div>
 </div>
 </div>
 );
 }

 return (
 <div className="space-y-4 px-4 md:px-8 pb-16 md:pb-32">
 {/* Stats Row */}
 <div className="flex items-center gap-6 py-3">
 <div className="flex items-baseline gap-1.5">
 <span className="text-lg font-semibold text-main-text">{totalGroups}</span>
 <span className="text-[11px] text-muted-text">groups</span>
 </div>
 <div className="w-px h-4 bg-main-border/50" />
 <div className="flex items-baseline gap-1.5">
 <span className="text-lg font-semibold text-emerald-500">{formatBytes(totalSavings)}</span>
 <span className="text-[11px] text-muted-text">recoverable</span>
 </div>
 <div className="w-px h-4 bg-main-border/50" />
 <span className="text-[11px] text-muted-text">{totalItems} items total</span>
 </div>

 {/* Groups */}
 <div className="space-y-6">
 {groups.map((group, groupIdx) => {
 const { scores, best } = groupScores[groupIdx];
 const bestIdx = best ? group.items.findIndex(i => i.id === best.item.id) : 0;

 return (
 <div
 key={group.id}
 className="bg-panel-bg border border-main-border/50 rounded-2xl overflow-hidden"
 >
 {/* Group Header */}
 <div className="flex items-center justify-between px-5 py-3 border-b border-main-border/30">
 <div className="flex items-center gap-2.5">
 <div className={cn(
 "px-2 py-0.5 rounded-md text-[11px] font-medium",
 group.isNearDuplicate
 ? "bg-violet-500/10 text-violet-500"
 : "bg-primary/10 text-primary"
 )}>
 {group.isNearDuplicate ? "Near-Duplicate" : `#${group.hash.substring(0, 8)}`}
 </div>
 <span className="text-[11px] text-muted-text">
 {group.items.length} versions
 </span>
 </div>
 <span className="text-xs text-muted-text/50">
 Click any version to compare
 </span>
 </div>

 {/* Thumbnail Row */}
 <div className="flex divide-x divide-main-border/30">
 {group.items.map((item, idx) => {
 const isBest = idx === bestIdx;
 const itemScore = scores[idx];
  const folderName = item.folderId ? (folderMap[item.folderId] ?? "Unknown") : "Library";

 return (
 <div
 key={item.id}
 className={cn(
 "flex-1 min-w-0 group cursor-pointer transition-colors duration-200 hover:bg-surface-bg/50",
 resolvingId === item.id && "bg-primary/5",
 isBest && "bg-primary/[0.02]"
 )}
 onClick={() => setCompareModal({ groupId: group.id, index: idx })}
 >
  {/* Thumbnail */}
  <div className="relative aspect-[4/3] bg-surface-bg overflow-hidden">
  {imgErrors.has(item.id) ? (
  <div className="absolute inset-0 flex items-center justify-center">
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-text/20">
  <rect x="2" y="2" width="20" height="20" rx="2" strokeLinecap="round" strokeLinejoin="round"/>
  <circle cx="8.5" cy="8.5" r="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  <path d="M21 15L16 10L5 21" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
  </div>
  ) : (
  <Image
  src={`/api/v1/media/files/${item.filePath}?thumb=1`}
  alt={item.title}
  fill
  className="object-cover"
  unoptimized
  priority={idx === 0}
  onError={() => setImgErrors(prev => new Set(prev).add(item.id))}
  onLoad={() => setImgErrors(prev => { const n = new Set(prev); n.delete(item.id); return n; })}
  />
  )}
  {isBest && (
 <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-primary rounded text-[11px] font-medium text-primary-foreground">
 Best
 </div>
 )}
 <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <div className={cn(
 "px-1.5 py-0.5 rounded text-[11px] font-medium",
 itemScore.total > 0.7 ? "bg-emerald-500/90 text-white" : itemScore.total > 0.4 ? "bg-amber-500/90 text-white" : "bg-rose-500/90 text-white"
 )}>
 {(itemScore.total * 100).toFixed(0)}%
 </div>
 </div>
 </div>

 {/* Info Strip */}
 <div className="px-3 py-2.5 space-y-2">
 <p className="text-[11px] font-medium text-main-text truncate">{item.title}</p>
 <div className="flex items-center gap-1.5 text-xs text-muted-text">
 <span>{formatBytes(item.size)}</span>
 {item.width && item.height && (
 <>
 <span className="text-muted-text/30">·</span>
 <span>{item.width}x{item.height}</span>
 </>
 )}
 </div>
 <div className="flex items-center gap-1 text-xs text-muted-text/60">
 <Folder size={9} weight="light" />
 <span className="truncate">{folderName}</span>
 </div>

 {/* Score Bar */}
 <div className="flex items-center gap-1.5">
 <Sparkle size={8} weight="fill" className={cn(
 itemScore.total > 0.7 ? "text-emerald-500" : itemScore.total > 0.4 ? "text-amber-500" : "text-rose-500"
 )} />
 <div className="flex-1 h-1 bg-main-border/30 rounded-full overflow-hidden">
 <div
 className={cn(
 "h-full rounded-full",
 itemScore.total > 0.7 ? "bg-emerald-500" : itemScore.total > 0.4 ? "bg-amber-500" : "bg-rose-500"
 )}
 style={{ width: `${Math.min(itemScore.total * 100, 100)}%` }}
 />
 </div>
 </div>

 {/* Keep Button */}
 <button
 onClick={(e) => { e.stopPropagation(); handleKeep(item, group.items); }}
 disabled={!!resolvingId}
 className={cn(
 "w-full h-8 rounded-lg flex items-center justify-center gap-1.5 text-[11px] font-medium cursor-pointer transition-colors duration-200",
 resolvingId === item.id
 ? "bg-primary text-primary-foreground"
 : isBest
 ? "bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
 : "bg-surface-bg text-muted-text hover:text-main-text border border-main-border/50 hover:border-main-border"
 )}
 >
 {resolvingId === item.id ? (
 <Spinner size={11} weight="light" className="animate-spin" />
 ) : (
 <Check size={11} weight="fill" />
 )}
 <span>{resolvingId === item.id ? "Resolving..." : "Keep"}</span>
 </button>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>

 {/* Compare Modal */}
 {compareModal && (() => {
 const group = groups.find(g => g.id === compareModal.groupId);
 if (!group) return null;
 const { scores: modalScores, best: modalBest } = groupScores[groups.indexOf(group)];
 return (
 <DuplicateCompareModal
 isOpen={true}
 onClose={() => setCompareModal(null)}
 items={group.items}
 scores={modalScores}
 bestIndex={modalBest ? group.items.findIndex(i => i.id === modalBest.item.id) : 0}
 folderMap={folderMap}
 onKeep={(item) => { setCompareModal(null); handleKeep(item, group.items); }}
 isResolving={!!resolvingId}
 />
 );
 })()}
 </div>
 );
}
