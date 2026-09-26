"use client";

import { Sun, Moon, Check, Spinner, ArrowLeft, FloppyDisk } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { m, AnimatePresence } from "motion/react";
import { useTheme } from "@/components/ThemeProvider";
import { UserMenu } from "@/components/topbar/UserMenu";
import { useState, useRef, useEffect, useEffectEvent } from "react";
import { SettingsModal } from "@/features/settings/components/SettingsModal";

interface MenuItem {
  label: string;
  shortcut?: string;
  separator?: boolean;
  checked?: boolean;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

function MenuDropdown({ menu, isOpen, onTrigger, onClose, onAction, isSaving, savingMode }: { menu: MenuGroup; isOpen: boolean; onTrigger: () => void; onClose: () => void; onAction?: (label: string) => void; isSaving?: boolean; savingMode?: "overwrite" | "copy" | null }) {
  const ref = useRef<HTMLDivElement>(null);

  const onOutsideClose = useEffectEvent(() => { onClose(); });
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutsideClose();
    };
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={isOpen ? onClose : onTrigger}
        className="h-8 px-2.5 text-[13px] text-white/60 hover:text-white hover:bg-white/8 rounded-full cursor-pointer"
      >
        {menu.label}
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 min-w-48 rounded-2xl bg-[#121214] py-1.5 ring-1 ring-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_18px_50px_rgba(0,0,0,0.45)] z-50">
          {menu.items.map((item, i) =>
            item.separator ? (
              <div key={i} className="h-px bg-white/8 my-1.5 mx-3" />
            ) : (
              <button
                key={item.label}
                type="button"
                onClick={() => { onAction?.(item.label); onClose(); }}
                disabled={isSaving && (item.label === "Save Copy" || item.label === "Overwrite")}
                className="w-full px-3 h-8 flex items-center justify-between text-[13px] text-white/85 hover:bg-white/8 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  {item.checked !== undefined && (
                    <span className="w-3.5 flex justify-center">
                      {item.checked && <Check size={12} weight="bold" />}
                    </span>
                  )}
                  {isSaving && (item.label === "Save Copy" && savingMode === "copy" || item.label === "Overwrite" && savingMode === "overwrite") && (
                    <Spinner size={12} weight="bold" className="animate-spin" />
                  )}
                  {item.label}
                </span>
                {item.shortcut && <span className="text-white/35 text-[11px] font-mono">{item.shortcut}</span>}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

interface EditorTopBarProps {
  onClose?: () => void;
  onOpenLibrary?: () => void;
  showRulers?: boolean;
  onToggleRulers?: () => void;
  onSaveCopy?: () => void;
  onOverwrite?: () => void;
  onResetAll?: () => void;
  onAutoTone?: () => void;
  onAutoContrast?: () => void;
  onAutoColor?: () => void;
  /** True while a save operation is in flight */
  isSaving?: boolean;
  /** Which save mode is active ("overwrite" or "copy") — determines spinner placement */
  savingMode?: "overwrite" | "copy" | null;
}

export function EditorTopBar({ onClose, onOpenLibrary, showRulers, onToggleRulers, onSaveCopy, onOverwrite, onResetAll, onAutoTone, onAutoContrast, onAutoColor, isSaving, savingMode }: EditorTopBarProps) {
  const { session, isLoading: authLoading } = useEffectiveSession();
  const { theme, setTheme } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const ghostBtn = "w-8 h-8 flex items-center justify-center rounded-full text-white/65 hover:text-white hover:bg-white/10 active:scale-[0.96] cursor-pointer";

  const menus: MenuGroup[] = [
    {
      label: "File",
      items: [
        { label: "Open from Library" },
        { label: "", separator: true },
        { label: "Save Copy", shortcut: "Ctrl+Shift+S" },
        { label: "Overwrite", shortcut: "Ctrl+S" },
        { label: "", separator: true },
        { label: "Close", shortcut: "Esc" },
      ],
    },
      {
        label: "Edit",
        items: [
          { label: "Undo", shortcut: "Ctrl+Z" },
          { label: "Redo", shortcut: "Ctrl+Shift+Z" },
          { label: "", separator: true },
          { label: "Auto Tone" },
          { label: "Auto Contrast" },
          { label: "Auto Color" },
          { label: "", separator: true },
          { label: "Reset All" },
        ],
      },
    {
      label: "View",
      items: [
        { label: "Zoom In", shortcut: "+" },
        { label: "Zoom Out", shortcut: "-" },
        { label: "", separator: true },
        { label: "Rulers", shortcut: "Ctrl+R", checked: showRulers },
        { label: "", separator: true },
        { label: "Compare", shortcut: "H" },
      ],
    },
    {
      label: "Image",
      items: [
        { label: "Crop" },
        { label: "Rotate 90° CW", shortcut: "]" },
        { label: "Rotate 90° CCW", shortcut: "[" },
      ],
    },
  ];

  return (
    <>
      <header className="w-full flex shrink-0 items-center justify-between gap-3 h-14 px-3 md:px-4 bg-[#070708]">
        <div className="flex items-center gap-1">
          <Link href="/dashboard" title="Back to dashboard" aria-label="Back to dashboard" className={ghostBtn}>
            <ArrowLeft size={15} weight="regular" />
          </Link>

          <nav className="flex items-center">
            {menus.map((menu) => (
              <MenuDropdown
                key={menu.label}
                menu={menu}
                isOpen={openMenu === menu.label}
                onTrigger={() => setOpenMenu(menu.label)}
                onClose={() => setOpenMenu(null)}
                onAction={(label) => {
                  if (label === "Open from Library") onOpenLibrary?.();
                  if (label === "Close") onClose?.();
                  if (label === "Rulers") onToggleRulers?.();
                  if (label === "Save Copy") onSaveCopy?.();
                  if (label === "Overwrite") onOverwrite?.();
                  if (label === "Reset All") onResetAll?.();
                  if (label === "Auto Tone") onAutoTone?.();
                  if (label === "Auto Contrast") onAutoContrast?.();
                  if (label === "Auto Color") onAutoColor?.();
                }}
                isSaving={isSaving}
                savingMode={savingMode}
              />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSaveCopy?.()}
            disabled={isSaving}
            className="h-8 px-3 flex items-center gap-1.5 rounded-full text-[12px] text-white/70 hover:text-white hover:bg-white/10 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            {isSaving && savingMode === "copy" ? <Spinner size={13} className="animate-spin" /> : <FloppyDisk size={13} weight="regular" />}
            Save copy
          </button>
          <button
            type="button"
            onClick={() => onOverwrite?.()}
            disabled={isSaving}
            className="h-8 pl-3.5 pr-1 flex items-center gap-2 rounded-full bg-white text-[#0c0c0e] text-[12px] font-medium cursor-pointer hover:bg-white/90 disabled:opacity-50 active:scale-[0.98]"
          >
            {isSaving && savingMode === "overwrite" ? <Spinner size={13} className="animate-spin" /> : null}
            Save
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/8">
              <FloppyDisk size={12} weight="light" />
            </span>
          </button>

          <span aria-hidden className="mx-1 h-4 w-px bg-white/15" />

          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className={`${ghostBtn} overflow-hidden`}
          >
            <AnimatePresence mode="wait">
              {theme === "dark" ? (
                <m.div key="sun" initial={{ rotate: -90, opacity: 0, scale: 0.5 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 90, opacity: 0, scale: 0.5 }} transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}>
                  <Sun size={14} weight="light" />
                </m.div>
              ) : (
                <m.div key="moon" initial={{ rotate: 90, opacity: 0, scale: 0.5 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: -90, opacity: 0, scale: 0.5 }} transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}>
                  <Moon size={14} weight="light" />
                </m.div>
              )}
            </AnimatePresence>
          </button>

          {session && <UserMenu session={session} onOpenSettings={() => setIsSettingsOpen(true)} />}
          {authLoading && !session && (
            <div className="w-8 h-8 rounded-full bg-surface-bg animate-pulse" aria-hidden="true" />
          )}
        </div>
      </header>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
