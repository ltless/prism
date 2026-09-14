"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import type { MediaItem } from "../types/index";
import { findBestItem, scoreDuplicateItem } from "../utils/duplicateScoring";
import { resolveDuplicateAction } from "../services/mediaFavoriteActions";
import type { DuplicateGroup } from "../components/DuplicateList";

/**
 * Duplicate-list state: keep-resolution flow (server action + toast +
 * resolving indicator), compare-modal target, thumbnail error tracking and
 * the per-group score / aggregate-savings memos. Extracted from
 * DuplicateList.tsx (F13) — pure move, no behavior change.
 */
export function useDuplicateList(groups: DuplicateGroup[]) {
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [compareModal, setCompareModal] = useState<{ groupId: string; index: number } | null>(null);
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set());

  const handleKeep = async (keepItem: MediaItem, allItems: MediaItem[]) => {
    setResolvingId(keepItem.id);
    const trashIds = allItems.reduce<string[]>((acc, i) => {
      if (i.id !== keepItem.id) acc.push(i.id);
      return acc;
    }, []);

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
    return groups.reduce(
      (acc, group) => {
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
      },
      { totalGroups: 0, totalItems: 0, totalSavings: 0 },
    );
  }, [groups]);

  return {
    resolvingId,
    compareModal,
    setCompareModal,
    imgErrors,
    setImgErrors,
    handleKeep,
    groupScores,
    totalGroups,
    totalItems,
    totalSavings,
  };
}
