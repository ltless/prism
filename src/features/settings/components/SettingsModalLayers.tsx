"use client";

import { ImageCropModal } from "@/shared/components/ImageCropModal";
import { GeneralTab } from "./GeneralTab";
import { StorageTab } from "./StorageTab";
import { SecurityTab } from "./SecurityTab";
import { AboutTab } from "./AboutTab";
import type { EffectiveSession } from "@/lib/auth/useEffectiveSession";
import type { ImageKind } from "../hooks/useImageUpload";

export type Tab = "general" | "security" | "storage" | "about";

export function SettingsTabContent({ activeTab, session, isUploading, coverSrc, profileSrc, handleFileSelect, coverInputRef, profileInputRef }: {
  activeTab: Tab;
  session: EffectiveSession | null;
  isUploading: ImageKind | null;
  coverSrc: string | null;
  profileSrc: string | null;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: ImageKind) => void;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  profileInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  switch (activeTab) {
    case "general":
      return session ? (
        <GeneralTab
          session={session}
          isUploading={isUploading}
          coverSrc={coverSrc}
          profileSrc={profileSrc}
          onFileSelect={handleFileSelect}
          coverInputRef={coverInputRef}
          profileInputRef={profileInputRef}
        />
      ) : null;
    case "storage":
      return <StorageTab />;
    case "security":
      return <SecurityTab />;
    case "about":
      return <AboutTab />;
  }
}

export function CropModalLayer({ cropModal, onClose, onCropComplete }: {
  cropModal: { isOpen: boolean; image: string; type: ImageKind; aspect: number };
  onClose: () => void;
  onCropComplete: (blob: Blob) => void;
}) {
  if (!cropModal.isOpen) return null;
  return (
    <ImageCropModal
      key="image-crop-modal"
      isOpen={cropModal.isOpen}
      image={cropModal.image}
      aspect={cropModal.aspect}
      title={`Crop ${cropModal.type === "image" ? "Profile" : "Cover"} Image`}
      onClose={onClose}
      onCropComplete={onCropComplete}
    />
  );
}