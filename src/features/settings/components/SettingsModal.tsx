"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { ImageCropModal } from "@/shared/components/ImageCropModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { updateProfileImageAction } from "@/features/profile/services/profileActions";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { toast } from "sonner";
import { useAIStore } from "@/features/ai/store";
import { useAIConfigSync } from "@/shared/hooks/useAIConfigSync";
import { useFocusTrap } from "@/shared/hooks/useFocusTrap";
import { useScrollLock } from "@/shared/hooks/useScrollLock";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { GeneralTab } from "./GeneralTab";
import { AITab } from "./AITab";
import { StorageTab } from "./StorageTab";
import { SecurityTab } from "./SecurityTab";
import { AboutTab } from "./AboutTab";
import { SettingsSidebar } from "./SettingsSidebar";
import { MobileTabBar } from "./MobileTabBar";

interface SettingsModalProps {
 isOpen: boolean;
 onClose: () => void;
}

type Tab = "general" | "ai" | "security" | "storage" | "about";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { refreshProfile } = useAuth();
  const { session: effectiveSession } = useEffectiveSession();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [isUploading, setIsUploading] = useState<"image" | "coverImage" | null>(null);
  const [localImageOverride, setLocalImageOverride] = useState<{ image?: string; coverImage?: string }>({});
 
 const ai = useAIStore();
  const isAdmin = effectiveSession?.user?.role === "admin";
 const [tagStats, setTagStats] = useState<{ total: number; tagged: number } | null>(null);
 const [scoreStats, setScoreStats] = useState<{ total: number; scored: number } | null>(null);

 useAIConfigSync({ activeTab, isAdmin, setTagStats, setScoreStats });
 
 const [cropModal, setCropModal] = useState<{
 isOpen: boolean;
 image: string;
 type: "image" | "coverImage";
 aspect: number;
 }>({
 isOpen: false,
 image: "",
 type: "image",
 aspect: 1
 });

  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  useScrollLock(isOpen);
  const reduced = useReducedMotion();

  const profileInputRef = useRef<HTMLInputElement>(null);
 const coverInputRef = useRef<HTMLInputElement>(null);

 const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "coverImage") => {
 const file = e.target.files?.[0];
 if (!file) return;

 const reader = new FileReader();
 reader.addEventListener("load", () => {
 setCropModal({
 isOpen: true,
 image: reader.result as string,
 type,
 aspect: type === "image" ? 1 : 16 / 5
 });
 });
 reader.readAsDataURL(file);
 if (e.target) e.target.value = "";
 };

 const handleCropSave = async (croppedBlob: Blob) => {
 const type = cropModal.type;
 setIsUploading(type);

 const formData = new FormData();
 formData.append("file", croppedBlob, type === "image" ? "profile.jpg" : "cover.jpg");

  try {
   const result = await updateProfileImageAction(formData, type);
   if (result.success) {
    toast.success(`${type === "image" ? "Profile picture" : "Cover photo"} updated`);
    // Update local override so image displays immediately for Go-auth users
    setLocalImageOverride(prev => ({ ...prev, [type]: result.path }));
    await refreshProfile();
   } else {
  toast.error(result.error || "Upload failed");
  }
  } catch {
  toast.error("An unexpected error occurred");
  } finally {
  setIsUploading(null);
  }
 };

  const profilePath = localImageOverride.image ?? effectiveSession?.user?.image;
  const coverPath = localImageOverride.coverImage ?? effectiveSession?.user?.coverImage;
  const profileSrc = profilePath ? `/api/v1/media/files/${profilePath}` : null;
  const coverSrc = coverPath ? `/api/v1/media/files/${coverPath}` : null;

 const tabs = [
 { id: "general" as Tab, label: "General", icon: "User" as const },
 { id: "ai" as Tab, label: "AI", icon: "Sparkle" as const },
 { id: "security" as Tab, label: "Security", icon: "Shield" as const },
 { id: "storage" as Tab, label: "Storage", icon: "HardDrive" as const },
 { id: "about" as Tab, label: "About", icon: "Info" as const },
 ];

  return (
  <AnimatePresence>
   {isOpen && (
    <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="settings-modal-title" key="settings-modal-overlay" className="fixed inset-0 z-modal flex items-end md:items-center justify-center p-0 md:p-4">
  {/* Backdrop — child container, absolute nutup container */}
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  transition={{ duration: reduced ? 0 : 0.2 }}
  onClick={onClose}
  className="absolute inset-0 bg-black/60"
  />

  {/* Modal Container */}
  <motion.div
  initial={{ scale: reduced ? 1 : 0.98, opacity: 0, y: reduced ? 0 : 12 }}
  animate={{ scale: 1, opacity: 1, y: 0 }}
  exit={{ scale: reduced ? 1 : 0.98, opacity: 0, y: reduced ? 0 : 12 }}
  transition={{ duration: reduced ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
  className="relative w-full max-w-4xl h-full md:h-[640px] bg-panel-bg rounded-t-2xl md:rounded-2xl border border-main-border/50 shadow-2xl overflow-hidden flex flex-col md:flex-row"
 >
 {/* Sidebar - desktop only */}
 <SettingsSidebar tabs={tabs} activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as Tab)} />

 {/* Content Area */}
 <div className="flex-1 flex flex-col min-w-0 bg-panel-bg">
 <header className="h-14 md:h-14 flex items-center justify-between px-4 md:px-6 border-b border-main-border/50 shrink-0">
 <h2 id="settings-modal-title" className="text-sm font-semibold text-main-text">
 {tabs.find(t => t.id === activeTab)?.label}
 </h2>
 <button 
 onClick={onClose}
 aria-label="Close settings"
 className="p-1.5 hover:bg-surface-bg rounded-lg text-muted-text hover:text-main-text transition-colors cursor-pointer"
 >
 <X size={16} weight="light" />
 </button>
 </header>

 <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-24 md:pb-6 custom-scrollbar">
  {activeTab === "general" && effectiveSession && (
  <GeneralTab
  session={effectiveSession}
  isUploading={isUploading}
  coverSrc={coverSrc}
  profileSrc={profileSrc}
  onFileSelect={handleFileSelect}
  coverInputRef={coverInputRef}
  profileInputRef={profileInputRef}
  />
 )}
 {activeTab === "ai" && (
 <AITab
 ai={ai}
 tagStats={tagStats}
 scoreStats={scoreStats}
 onSetTagStats={setTagStats}
 onSetScoreStats={setScoreStats}
 />
 )}

 {activeTab === "storage" && <StorageTab />}

 {activeTab === "security" && <SecurityTab />}
 {activeTab === "about" && <AboutTab />}
 </div>
 </div>

 {/* Mobile bottom tabs */}
 <MobileTabBar tabs={tabs} activeTab={activeTab} onTabChange={(tab: string) => setActiveTab(tab as Tab)} />
   </motion.div>
  </div>
  )}

 {cropModal.isOpen && (
 <ImageCropModal
 key="image-crop-modal"
 isOpen={cropModal.isOpen}
 image={cropModal.image}
 aspect={cropModal.aspect}
 title={`Crop ${cropModal.type === "image" ? "Profile" : "Cover"} Image`}
 onClose={() => setCropModal(prev => ({ ...prev, isOpen: false }))}
 onCropComplete={handleCropSave}
 />
 )}
   </AnimatePresence>
  );
}
