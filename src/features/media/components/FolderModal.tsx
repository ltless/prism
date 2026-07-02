"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, FloppyDisk, Spinner, Sparkle, Folder } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { createFolderAction, createSmartFolderAction } from "../services/mediaFolderActions";
import { TAG_TAXONOMY } from "@/features/ai/tag-candidates.mts";
import { toast } from "sonner";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { useScrollLock } from "@/shared/hooks/useScrollLock";

const COLORS = [
  { id: 'zinc', hex: '#71717a' },
  { id: 'blue', hex: '#3b82f6' },
  { id: 'rose', hex: '#f43f5e' },
  { id: 'emerald', hex: '#10b981' },
  { id: 'amber', hex: '#f59e0b' },
  { id: 'indigo', hex: '#6366f1' },
  { id: 'violet', hex: '#8b5cf6' },
];

const CATEGORIES = Object.keys(TAG_TAXONOMY);

interface FolderModalProps {
  onClose: () => void;
}

export function FolderModal({ onClose }: FolderModalProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"manual" | "smart">("manual");
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("zinc");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [minScore, setMinScore] = useState(0.25);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, true);
  useScrollLock(true);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const toggleCategory = (cat: string) =>
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );

  const filteredCategories = CATEGORIES.filter(cat =>
    cat.toLowerCase().includes(categorySearch.toLowerCase())
  );

  const handleSave = async () => {
    if (!name.trim()) { setError("Folder name is required"); return; }
    if (mode === "smart" && selectedCategories.length === 0) {
      setError("Pick at least one category");
      return;
    }

 setIsSaving(true);
 setError("");

 const trimmedName = name.trim();
 if (mode === "smart") {
 const result = await createSmartFolderAction(trimmedName, selectedColor, { categories: selectedCategories, minScore });
 if (!result.success) {
 setError(result.error || "Failed to create folder");
 setIsSaving(false);
 return;
 }
 } else {
 const result = await createFolderAction(trimmedName, selectedColor);
 if (!result.success) {
 setError(result.error || "Failed to create folder");
 setIsSaving(false);
 return;
 }
 }
 toast.success(mode === "smart" ? "Smart folder created" : "Folder created");
 router.refresh();
 onClose();
  };

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="folder-modal-title" className="fixed inset-0 z-modal bg-black/60 flex items-center justify-center p-4">
      <div className="bg-panel-bg w-full max-w-sm rounded-2xl border border-main-border/30 shadow-xl flex flex-col">
        <div className="p-6 border-b border-main-border/30 flex justify-between items-center">
          <h3 id="folder-modal-title" className="text-xs font-semibold flex items-center gap-2">
            {mode === "smart" ? <Sparkle size={14} weight="fill" className="text-violet-400" /> : <Folder size={14} weight="fill" className="text-primary" />}
            {mode === "smart" ? "New Smart Folder" : "New Folder"}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-surface-bg rounded-xl border border-main-border/40 text-muted-text hover:text-main-text transition-all duration-300 ease-out-expo cursor-pointer">
            <X size={16} weight="light" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* mode toggle */}
          <div className="flex gap-2">
            {(["manual", "smart"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 py-1.5 rounded-xl text-[11px] font-bold transition-all duration-300 ease-out-expo border cursor-pointer",
                  mode === m
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-main-border text-muted-text hover:text-main-text"
                )}
              >
                {m === "manual" ? "Regular" : "✦ Smart"}
              </button>
            ))}
          </div>

          {error && (
            <p className="text-[11px] font-semibold text-rose-500 bg-rose-500/5 p-3 rounded-xl border border-rose-500/15">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted-text px-1">Folder Name</label>
            <input
              ref={nameInputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder={mode === "smart" ? "e.g. Nature & Outdoors" : "e.g. Vacation 2024"}
              className="w-full px-3.5 py-2.5 bg-surface-bg/40 border border-main-border/60 rounded-xl text-xs text-main-text placeholder:text-muted-text/50 focus:border-primary/50 focus:bg-panel-bg outline-none transition-all duration-300 ease-out-expo"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-semibold text-muted-text px-1">Label Color</label>
            <div className="flex flex-wrap gap-3 px-1">
              {COLORS.map(color => (
                <button
                  key={color.id}
                  onClick={() => setSelectedColor(color.id)}
                  className={cn("w-7 h-7 rounded-full border-2 transition-all duration-300 ease-out-expo flex items-center justify-center cursor-pointer",
                    selectedColor === color.id ? "border-main-text scale-110 shadow-md" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color.hex }}
                >
                  {selectedColor === color.id && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                </button>
              ))}
            </div>
          </div>

          {mode === "smart" && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[11px] font-semibold text-muted-text">
                    Categories <span className="text-primary">({selectedCategories.length} selected)</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={categorySearch}
                  onChange={e => setCategorySearch(e.target.value)}
                  placeholder="Search categories..."
                  className="w-full px-3 py-2 bg-surface-bg/40 border border-main-border/60 rounded-xl text-xs text-main-text placeholder:text-muted-text/50 focus:border-primary/50 focus:bg-panel-bg outline-none transition-all duration-300 ease-out-expo"
                />
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scroll pr-1 pt-1">
                  {filteredCategories.length === 0 ? (
                    <span className="text-[11px] text-muted-text/50 italic px-1">No matching categories</span>
                  ) : (
                    filteredCategories.map(cat => (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-tight transition-all duration-300 ease-out-expo border cursor-pointer",
                          selectedCategories.includes(cat)
                            ? "bg-violet-500/20 border-violet-500/40 text-violet-300"
                            : "border-main-border/60 text-muted-text hover:text-main-text hover:border-main-border"
                        )}
                      >
                        {cat}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold text-muted-text px-1">
                  Min Confidence — <span className="text-main-text font-mono">{Math.round(minScore * 100)}%</span>
                </label>
                <input
                  type="range"
                  min={0.05}
                  max={0.9}
                  step={0.05}
                  value={minScore}
                  onChange={e => setMinScore(parseFloat(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-[11px] text-muted-text/50 px-1">
                  <span>Loose (5%)</span>
                  <span>Strict (90%)</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-[11px] font-semibold text-muted-text hover:text-main-text hover:bg-surface-bg/60 transition-all duration-300 ease-out-expo cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] py-2 bg-primary text-primary-foreground rounded-xl text-[11px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all duration-300 ease-out-expo cursor-pointer"
          >
            {isSaving ? <Spinner size={13} weight="bold" className="animate-spin" /> : <FloppyDisk size={13} weight="light" />}
            {mode === "smart" ? "Create Smart Folder" : "Create Folder"}
          </button>
        </div>
      </div>
    </div>
  );
}
