"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import { Lock, LockOpen, Palette, Info, ArrowsOut, Clock, Compass, Swatches, ChartBar, SlidersHorizontal } from "@phosphor-icons/react";

type PanelId =
  | "navigator"
  | "adjust"
  | "color"
  | "swatches"
  | "histogram"
  | "info"
  | "transform"
  | "history";

const panelItems: { id: PanelId; icon: typeof Palette; label: string }[] = [
  { id: "navigator", icon: Compass, label: "Navigator" },
  { id: "adjust", icon: SlidersHorizontal, label: "Adjust" },
  { id: "color", icon: Palette, label: "Color" },
  { id: "swatches", icon: Swatches, label: "Swatches" },
  { id: "histogram", icon: ChartBar, label: "Histogram" },
  { id: "transform", icon: ArrowsOut, label: "Transform" },
  { id: "info", icon: Info, label: "Info" },
  { id: "history", icon: Clock, label: "History" },
];

const ORDER_KEY = "prism-editor-panel-order:v1";
const LOCK_KEY = "prism-editor-panel-locked:v1";

interface SidebarRailProps {
  openPanels: Set<PanelId>;
  isOpen: boolean;
  onTogglePanel: (id: PanelId) => void;
}

export function SidebarRail({ openPanels, isOpen, onTogglePanel }: SidebarRailProps) {
  const panelItemMap = new Map(panelItems.map((item) => [item.id, item]));

  const [panelOrder, setPanelOrder] = useState<PanelId[]>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem(ORDER_KEY);
        if (stored) {
          const parsed: string[] = JSON.parse(stored);
          return parsed.filter((id): id is PanelId => panelItemMap.has(id as PanelId));
        }
      }
    } catch { /* ignore corrupt storage */ }
    return panelItems.map((item) => item.id);
  });

  const subscribeLock = useCallback((onStoreChange: () => void) => {
    const handler = () => onStoreChange();
    window.addEventListener("storage", handler);
    window.addEventListener("prism-editor-lock", handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("prism-editor-lock", handler);
    };
  }, []);
  const isLocked = useSyncExternalStore(
    subscribeLock,
    () => localStorage.getItem(LOCK_KEY) === "true",
    () => false,
  );

  useEffect(() => {
    localStorage.setItem(ORDER_KEY, JSON.stringify(panelOrder));
  }, [panelOrder]);

  const toggleLock = () => {
    localStorage.setItem(LOCK_KEY, String(!isLocked));
    window.dispatchEvent(new Event("prism-editor-lock"));
  };

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (isLocked) return;
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (isLocked) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetIndex(index);
  };

  const handleDragLeave = () => {
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (isLocked) return;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDropTargetIndex(null);
      return;
    }
    const newOrder = [...panelOrder];
    const [removed] = newOrder.splice(dragIndex, 1);
    newOrder.splice(dropIndex, 0, removed);
    setPanelOrder(newOrder);
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div className="w-10 shrink-0 flex flex-col items-center py-2 gap-0.5 bg-app-bg">
      {/* Lock toggle */}
      <button
        type="button"
        onClick={toggleLock}
        title={isLocked ? "Unlock panel order" : "Lock panel order"}
        className={`w-8 h-8 flex items-center justify-center rounded transition-colors cursor-pointer ${
          isLocked
            ? "text-primary bg-primary/10"
            : "text-muted-text hover:text-main-text hover:bg-surface-bg"
        }`}
      >
        {isLocked ? <Lock size={14} weight="bold" /> : <LockOpen size={14} weight="light" />}
      </button>
      <div className="w-6 h-px bg-main-border/30 my-0.5" />

      {panelOrder.map((id, index) => {
        const item = panelItemMap.get(id);
        if (!item) return null;
        const Icon = item.icon;
        const isActive = openPanels.has(item.id) && isOpen;
        const isDropTarget = dropTargetIndex === index;
        const isDragging = dragIndex === index;
        return (
          <button
            key={item.id}
            type="button"
            draggable={!isLocked}
            onClick={() => onTogglePanel(item.id)}
            title={item.label}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            className={`w-8 h-8 flex items-center justify-center rounded transition-[color,transform] cursor-pointer ${
              isActive
                ? "text-primary bg-primary/10"
                : isDragging
                  ? "opacity-30 text-muted-text"
                  : "text-muted-text hover:text-main-text hover:bg-surface-bg"
            } ${isDropTarget ? "ring-1 ring-primary" : ""}`}
          >
            <Icon size={16} weight="light" />
          </button>
        );
      })}
    </div>
  );
}
