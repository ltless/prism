"use client";

import { m, AnimatePresence } from "motion/react";
import { X, SignOut } from "@phosphor-icons/react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { useScrollLock } from "@/shared/hooks/useScrollLock";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { useAuth } from "@/lib/auth/AuthContext";
import { useImageUpload } from "../hooks/useImageUpload";
import { SettingsTabContent, CropModalLayer, type Tab } from "./SettingsModalLayers";
import { SettingsTabs } from "./SettingsTabs";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const tabs = [
  { id: "general" as Tab, label: "General", icon: "User" as const },
  { id: "security" as Tab, label: "Security", icon: "Shield" as const },
  { id: "storage" as Tab, label: "Storage", icon: "HardDrive" as const },
  { id: "about" as Tab, label: "About", icon: "Info" as const },
];

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { session } = useEffectiveSession();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const {
    isUploading,
    cropModal,
    localImageOverride,
    setCropModal,
    handleFileSelect,
    handleCropSave,
  } = useImageUpload();

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  useScrollLock(isOpen);
  const animate = useReducedMotion() ? 0 : 0.55;
  const isDesktop = useIsDesktop();

  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const profilePath = localImageOverride.image ?? session?.user?.image;
  const coverPath = localImageOverride.coverImage ?? session?.user?.coverImage;

  const panel = (
    <>
      <header className="flex h-[4.25rem] shrink-0 items-center justify-between px-5 md:px-7">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-text">Settings</p>
          <h2 id="settings-modal-title" className="mt-0.5 text-[17px] font-medium tracking-tight text-main-text">
            {tabs.find(t => t.id === activeTab)?.label}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-main-text ring-1 ring-black/10 transition-transform duration-500 ease-spring hover:bg-black/[0.08] active:scale-[0.98] cursor-pointer dark:bg-white/10 dark:ring-white/15 dark:hover:bg-white/15"
        >
          <X size={14} weight="light" />
        </button>
      </header>

      <SettingsTabs tabs={tabs} activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as Tab)} />

      <div className="custom-scroll flex-1 overflow-y-auto px-4 pb-6 pt-4 md:px-7">
        <AnimatePresence mode="wait">
        <m.div
          key={activeTab}
          initial={animate ? { opacity: 0, y: 10 } : false}
          animate={{ opacity: 1, y: 0 }}
          exit={animate ? { opacity: 0, y: -6 } : undefined}
          transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        >
        <SettingsTabContent
          activeTab={activeTab}
          session={session}
          isUploading={isUploading}
          coverSrc={coverPath ? `/api/v1/media/files/${coverPath}` : null}
          profileSrc={profilePath ? `/api/v1/media/files/${profilePath}` : null}
          handleFileSelect={handleFileSelect}
          coverInputRef={coverInputRef}
          profileInputRef={profileInputRef}
        />
        </m.div>
        </AnimatePresence>
      </div>

      <footer className="shrink-0 border-t border-black/[0.06] px-5 py-3.5 dark:border-white/[0.08]">
        <div className="flex items-center gap-3">
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-bg ring-1 ring-black/[0.06] dark:ring-white/10">
            {profilePath ? (
              <Image src={`/api/v1/media/files/${profilePath}`} alt="" fill sizes="36px" className="object-cover" unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary text-[13px] font-medium text-primary-foreground uppercase">
                {session?.user?.name?.[0] || "U"}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium tracking-tight text-main-text">{session?.user?.name || "Prism User"}</p>
            <p className="text-[11px] capitalize text-muted-text">{session?.user?.role || "user"}</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            className="flex items-center gap-1.5 rounded-full bg-black/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-muted-text ring-1 ring-black/[0.05] transition-all duration-500 ease-spring hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer dark:bg-white/[0.07] dark:ring-white/[0.08]"
          >
            <SignOut size={13} weight="light" />
            Sign out
          </button>
        </div>
      </footer>
    </>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" key="settings-modal-overlay" className="fixed inset-0 z-modal">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animate }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70"
          />

          {isDesktop ? (
            <m.div
              key="settings-drawer-desktop"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: animate, ease: [0.32, 0.72, 0, 1] }}
              className="absolute right-0 top-0 flex h-full w-full max-w-2xl flex-col border-l border-black/10 bg-panel-bg shadow-modal dark:border-white/10"
            >
              {panel}
            </m.div>
          ) : (
            <m.div
              key="settings-sheet-mobile"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: animate, ease: [0.32, 0.72, 0, 1] }}
              className="absolute bottom-0 left-0 flex h-[min(92dvh,44rem)] w-full flex-col items-end rounded-t-[2rem] bg-panel-bg shadow-modal ring-1 ring-black/10 dark:ring-white/10"
            >
              <div className="my-2 h-1 w-9 shrink-0 rounded-full bg-black/[0.12] dark:bg-white/[0.15]" />
              <div className="flex min-h-0 w-full flex-1 flex-col">{panel}</div>
            </m.div>
          )}
        </div>
      )}

      <CropModalLayer
        cropModal={cropModal}
        onClose={() => setCropModal(prev => ({ ...prev, isOpen: false }))}
        onCropComplete={handleCropSave}
      />
    </AnimatePresence>
  );
}