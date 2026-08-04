"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, FloppyDisk, Spinner, Folder } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { createFolderAction } from "../services/mediaFolderActions";
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

interface FolderModalProps {
  onClose: () => void;
}

export function FolderModal({ onClose }: FolderModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("zinc");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useFocusTrap(modalRef, true);
  useScrollLock(true);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { setError("Folder name is required"); return; }

 setIsSaving(true);
 setError("");

 try {
 const result = await createFolderAction(name.trim(), selectedColor);
 if (!result.success) {
 setError(result.error || "Failed to create folder");
 return;
 }
 toast.success("Folder created");
 router.refresh();
 onClose();
 } finally {
 setIsSaving(false);
 }
  };

  return (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="folder-modal-title" className="fixed inset-0 z-modal bg-black/60 flex items-center justify-center p-4">
      <div className="bg-panel-bg w-full max-w-sm rounded-2xl border border-main-border/30 shadow-xl flex flex-col">
        <div className="p-6 border-b border-main-border/30 flex justify-between items-center">
          <h3 id="folder-modal-title" className="text-xs font-semibold flex items-center gap-2">
            <Folder size={14} weight="fill" className="text-primary" />
            New Folder
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-surface-bg rounded-xl border border-main-border/40 text-muted-text hover:text-main-text transition-colors duration-300 ease-out-expo cursor-pointer">
            <X size={16} weight="light" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <p className="text-[11px] font-semibold text-rose-500 bg-rose-500/5 p-3 rounded-xl border border-rose-500/15">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <label htmlFor="folder-name-input" className="text-[11px] font-semibold text-muted-text px-1">Folder Name</label>
            <input
              id="folder-name-input"
              ref={nameInputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSave()}
              placeholder="e.g. Vacation 2024"
              className="w-full px-3.5 py-2.5 bg-surface-bg/40 border border-main-border/60 rounded-xl text-xs text-main-text placeholder:text-muted-text/50 focus:border-primary/50 focus:bg-panel-bg outline-none transition-[background-color,border-color] duration-300 ease-out-expo"
            />
          </div>

          <div className="space-y-3">
            <label htmlFor="folder-color-group" className="text-[11px] font-semibold text-muted-text px-1">Label Color</label>
            <div className="flex flex-wrap gap-3 px-1">
              {COLORS.map(color => (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setSelectedColor(color.id)}
                  aria-label={`Color ${color.id}`}
                  className={cn("w-7 h-7 rounded-full border-2 transition-[border-color,transform] duration-300 ease-out-expo flex items-center justify-center cursor-pointer",
                    selectedColor === color.id ? "border-main-text scale-110 shadow-md" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: color.hex }}
                >
                  {selectedColor === color.id && <div className="w-1.5 h-1.5 bg-white rounded-full shadow-sm" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-[11px] font-semibold text-muted-text hover:text-main-text hover:bg-surface-bg/60 transition-colors duration-300 ease-out-expo cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-[2] py-2 bg-primary text-primary-foreground rounded-xl text-[11px] font-semibold flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity duration-300 ease-out-expo cursor-pointer"
          >
            {isSaving ? <Spinner size={13} weight="bold" className="animate-spin" /> : <FloppyDisk size={13} weight="light" />}
            Create Folder
          </button>
        </div>
      </div>
    </div>
  );
}
