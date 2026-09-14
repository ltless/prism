"use client";

import { useState } from "react";
import { User, Lock, Database, CheckCircle } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  completeSetupAction,
  uploadSetupImageAction,
  saveVaultPinAction,
} from "../services/setupActions";
import { updateStorageLimitAction, updateGlobalStorageDefaultAction } from "@/features/settings/services/storageActions";
import { DEFAULT_USER_QUOTA_BYTES } from "@/core/constants";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { useAuth } from "@/lib/auth/AuthContext";

export interface WizardStep {
  id: "profile" | "vault" | "storage" | "finish";
  title: string;
  subtitle: string;
  icon: Icon;
}

const profileStep: WizardStep = { id: "profile", title: "Profile", subtitle: "Make Prism yours", icon: User };
const vaultStep: WizardStep = { id: "vault", title: "Vault PIN", subtitle: "Set a 6-digit access code", icon: Lock };
const storageStep: WizardStep = { id: "storage", title: "Storage", subtitle: "Choose your quota", icon: Database };
const finishStep: WizardStep = { id: "finish", title: "Ready!", subtitle: "You are all set", icon: CheckCircle };

const adminSteps = [profileStep, vaultStep, storageStep, finishStep];
const userSteps = [profileStep, vaultStep, finishStep];

/**
 * Setup-wizard state: step machine (admin sees storage step), image uploads,
 * vault PIN save, storage quota save and final completion redirect.
 * Extracted from SetupWizard.tsx (F13) — pure move, no behavior change.
 */
export function useSetupWizard() {
  const { session } = useEffectiveSession();
  const { refreshProfile } = useAuth();
  const isAdmin = session?.user?.role === "admin";
  const steps = isAdmin ? adminSteps : userSteps;

  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isUploading, setIsUploading] = useState<string | null>(null);

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);

  const [pin, setPin] = useState("");

  // Admin own quota defaults to unlimited (admin = owner). Global default = 10GB.
  const [selectedOwnLimit, setSelectedOwnLimit] = useState<number | null>(null);
  const [selectedGlobalLimit, setSelectedGlobalLimit] = useState<number | null>(DEFAULT_USER_QUOTA_BYTES);

  const router = useRouter();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: "profile" | "cover") => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadSetupImageAction(formData, type === "profile" ? "image" : "coverImage");

      if (result.success) {
        if (type === "profile") setProfileImage(result.filename);
        else setCoverImage(result.filename);
        toast.success(`${type === "profile" ? "Profile" : "Cover"} image uploaded`);
      } else {
        toast.error(result.error || "Upload failed");
      }
    } catch {
      toast.error("Network error during upload");
    } finally {
      setIsUploading(null);
    }
  };

  const handleNext = async () => {
    const step = steps[currentStep];

    if (step.id === "vault") {
      if (pin.length < 6) {
        toast.error("Please enter a 6-digit PIN");
        return;
      }
      const res = await saveVaultPinAction(pin);
      if (!res.success) {
        toast.error("Failed to save Vault PIN");
        return;
      }
    }

    if (step.id === "storage") {
      const [ownRes, globalRes] = await Promise.all([
        updateStorageLimitAction(selectedOwnLimit),
        updateGlobalStorageDefaultAction(selectedGlobalLimit === null ? "unlimited" : selectedGlobalLimit),
      ]);
      if (!ownRes.success) {
        toast.error(ownRes.error || "Failed to save your storage quota");
        return;
      }
      if (!globalRes.success) {
        toast.error(globalRes.error || "Failed to save global default");
        return;
      }
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      setIsCompleting(true);
      const res = await completeSetupAction();
      if (res.success) {
        await refreshProfile();

        toast.success("Setup completed! Welcome to Prism.");

        setTimeout(() => {
          router.refresh();
          router.push("/dashboard");
        }, 100);
      } else {
        toast.error("Failed to complete setup");
        setIsCompleting(false);
      }
    }
  };

  return {
    steps,
    currentStep,
    isCompleting,
    isUploading,
    profileImage,
    coverImage,
    pin,
    setPin,
    selectedOwnLimit,
    setSelectedOwnLimit,
    selectedGlobalLimit,
    setSelectedGlobalLimit,
    handleFileUpload,
    handleNext,
    goBack: () => setCurrentStep(s => Math.max(0, s - 1)),
  };
}
