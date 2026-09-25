"use client";

import { m, AnimatePresence } from "motion/react";
import { X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { useScrollLock } from "@/shared/hooks/useScrollLock";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { useImageUpload } from "../hooks/useImageUpload";
import { SettingsTabContent, CropModalLayer, type Tab } from "./SettingsModalLayers";
import { SettingsSidebar } from "./SettingsSidebar";
import { MobileTabBar } from "./MobileTabBar";

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

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { session } = useEffectiveSession();
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
  const animate = useReducedMotion() ? 0 : 0.2;

  const profileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const profilePath = localImageOverride.image ?? session?.user?.image;
  const coverPath = localImageOverride.coverImage ?? session?.user?.coverImage;

  return (
    <AnimatePresence>
      {isOpen && (
        <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" key="settings-modal-overlay" className="fixed inset-0 z-modal flex items-end justify-center p-0 md:items-center md:p-6">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animate }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-2xl"
          />

          <m.div
            initial={{ scale: animate ? 0.96 : 1, opacity: 0, y: animate ? 24 : 0 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: animate ? 0.98 : 1, opacity: 0, y: animate ? 16 : 0 }}
            transition={{ duration: animate ? 0.55 : 0, ease: [0.32, 0.72, 0, 1] }}
            className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-t-[2rem] bg-panel-bg/95 shadow-[0_32px_80px_-20px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.14)] ring-1 ring-black/10 md:h-[min(760px,calc(100dvh-3rem))] md:flex-row md:rounded-[2rem] dark:bg-[#101012]/92 dark:ring-white/10"
          >
            <SettingsSidebar tabs={tabs} activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as Tab)} />

            <div className="flex min-w-0 flex-1 flex-col">
              <header className="flex h-16 shrink-0 items-center justify-between px-5 md:px-8">
                <h2 id="settings-modal-title" className="text-[22px] font-medium tracking-tight text-main-text">
                  {tabs.find(t => t.id === activeTab)?.label}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close settings"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.05] text-main-text ring-1 ring-black/10 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-black/[0.08] active:scale-[0.98] cursor-pointer dark:bg-white/10 dark:ring-white/15 dark:hover:bg-white/15"
                >
                  <X size={14} weight="light" />
                </button>
              </header>

              <div className="custom-scroll flex-1 overflow-y-auto px-4 pb-8 pt-1 md:px-8 md:pb-10">
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
            </div>

            <MobileTabBar tabs={tabs} activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as Tab)} />
          </m.div>
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
