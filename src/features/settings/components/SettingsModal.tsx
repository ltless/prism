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
  { id: "general" as Tab, label: "General", description: "Profile and appearance", icon: "User" as const },
  { id: "security" as Tab, label: "Security", description: "Password and vault access", icon: "Shield" as const },
  { id: "storage" as Tab, label: "Storage", description: "Usage and quotas", icon: "HardDrive" as const },
  { id: "about" as Tab, label: "About", description: "Version and resources", icon: "Info" as const },
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
        <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" key="settings-modal-overlay" className="fixed inset-0 z-modal flex items-end md:items-center justify-center p-0 md:p-4">
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: animate }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
          />

          <m.div
            initial={{ scale: animate ? 0.98 : 1, opacity: 0, y: animate ? 12 : 0 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: animate ? 0.98 : 1, opacity: 0, y: animate ? 12 : 0 }}
            transition={{ duration: animate, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-5xl h-full md:h-[min(720px,calc(100vh-2rem))] bg-panel-bg rounded-t-2xl md:rounded-2xl border border-main-border/50 shadow-2xl overflow-hidden flex flex-col md:flex-row"
          >
            <SettingsSidebar tabs={tabs} activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as Tab)} />

            <div className="flex-1 flex flex-col min-w-0 bg-panel-bg">
              <header className="h-14 md:h-14 flex items-center justify-between px-4 md:px-6 border-b border-main-border/50 shrink-0">
                <div className="min-w-0">
                  <h2 id="settings-modal-title" className="text-sm font-semibold text-main-text">
                    {tabs.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-[11px] text-muted-text truncate">
                    {tabs.find(t => t.id === activeTab)?.description}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close settings"
                  className="p-1.5 hover:bg-surface-bg rounded-lg text-muted-text hover:text-main-text transition-colors cursor-pointer"
                >
                  <X size={16} weight="light" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-24 md:pb-8 custom-scrollbar">
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
