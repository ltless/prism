"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { updateProfileImageAction } from "@/features/profile/services/profileActions";
import { toast } from "sonner";

export type ImageKind = "image" | "coverImage";

/** Owns the crop-modal state and the upload flow for profile / cover images. */
export function useImageUpload() {
  const { refreshProfile } = useAuth();
  const [isUploading, setIsUploading] = useState<ImageKind | null>(null);
  const [localImageOverride, setLocalImageOverride] = useState<{ image?: string; coverImage?: string }>({});
  const [cropModal, setCropModal] = useState<{
    isOpen: boolean;
    image: string;
    type: ImageKind;
    aspect: number;
  }>({ isOpen: false, image: "", type: "image", aspect: 1 });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: ImageKind) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setCropModal({
        isOpen: true,
        image: reader.result as string,
        type,
        aspect: type === "image" ? 1 : 16 / 5,
      });
    };
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

  return {
    isUploading,
    cropModal,
    localImageOverride,
    setCropModal,
    handleFileSelect,
    handleCropSave,
  };
}