"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Lock,
  Database,
  CheckCircle
} from "@phosphor-icons/react";

import {
  completeSetupAction,
  uploadSetupImageAction,
  saveVaultPinAction
} from "../services/setupActions";
import { updateStorageLimitAction, updateGlobalStorageDefaultAction } from "@/features/settings/services/storageActions";
import { DEFAULT_USER_QUOTA_BYTES } from "@/core/constants";
import { useRouter } from "next/navigation";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "sonner";
import { WizardProgress } from "./steps/WizardProgress";
import { WizardFooter } from "./steps/WizardFooter";
import { ProfileStep } from "./steps/ProfileStep";
import { VaultStep } from "./steps/VaultStep";
import { StorageStep } from "./steps/StorageStep";
import { FinishStep } from "./steps/FinishStep";

const profileStep = { id: 'profile', title: 'Profile', subtitle: 'Make Prism yours', icon: User };
const vaultStep = { id: 'vault', title: 'Vault PIN', subtitle: 'Set a 6-digit access code', icon: Lock };
const storageStep = { id: 'storage', title: 'Storage', subtitle: 'Choose your quota', icon: Database };
const finishStep = { id: 'finish', title: 'Ready!', subtitle: 'You are all set', icon: CheckCircle };

const adminSteps = [profileStep, vaultStep, storageStep, finishStep];
const userSteps = [profileStep, vaultStep, finishStep];

export function SetupWizard() {
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(type);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadSetupImageAction(formData, type === 'profile' ? 'image' : 'coverImage');

      if (result.success) {
        if (type === 'profile') setProfileImage(result.filename);
        else setCoverImage(result.filename);
        toast.success(`${type === 'profile' ? 'Profile' : 'Cover'} image uploaded`);
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

    if (step.id === 'vault') {
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

    if (step.id === 'storage') {
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

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-xl relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="bg-panel-bg border border-main-border/50 rounded-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-main-border/30">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 bg-primary rotate-45 flex items-center justify-center rounded-md">
                  <div className="w-2.5 h-2.5 bg-panel-bg rounded-sm" />
                </div>
                <div>
                  <h1 className="text-xs text-muted-text/50">Prism</h1>
                  <span className="text-[13px] font-semibold text-main-text">Setup Wizard</span>
                </div>
              </div>
              <span className="text-[11px] text-muted-text bg-surface-bg px-3 py-1.5 rounded-lg">
                {currentStep + 1} / {steps.length}
              </span>
            </div>

            <WizardProgress steps={steps} currentStep={currentStep} />
          </div>

          {/* Content */}
          <div className="px-8 py-10 min-h-[400px] flex flex-col items-center text-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="w-full flex flex-col items-center"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-6 bg-surface-bg border border-main-border/50 text-main-text">
                  {(() => {
                    const Icon = steps[currentStep].icon;
                    return <Icon size={20} weight="light" />;
                  })()}
                </div>

                <h2 className="text-lg font-semibold mb-1">{steps[currentStep].title}</h2>
                <p className="text-[12px] text-muted-text mb-8 max-w-[240px]">
                  {steps[currentStep].subtitle}
                </p>

                <div className="w-full max-w-sm text-left">
                  {steps[currentStep].id === 'profile' && (
                    <ProfileStep
                      profileImage={profileImage}
                      coverImage={coverImage}
                      isUploading={isUploading}
                      onFileUpload={handleFileUpload}
                    />
                  )}

                  {steps[currentStep].id === 'vault' && (
                    <VaultStep pin={pin} onPinChange={setPin} />
                  )}

                  {steps[currentStep].id === 'storage' && (
                    <StorageStep
                      selectedOwnLimit={selectedOwnLimit}
                      onOwnLimitChange={setSelectedOwnLimit}
                      selectedGlobalLimit={selectedGlobalLimit}
                      onGlobalLimitChange={setSelectedGlobalLimit}
                    />
                  )}

                  {steps[currentStep].id === 'finish' && <FinishStep />}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <WizardFooter
            currentStep={currentStep}
            totalSteps={steps.length}
            isCompleting={isCompleting}
            isUploading={isUploading}
            onBack={() => currentStep > 0 && setCurrentStep(currentStep - 1)}
            onNext={handleNext}
          />
          </motion.div>

          <div className="flex flex-col items-center mt-6 gap-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-text/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              System Encrypted
            </div>
            <p className="text-xs text-muted-text/30">
              Prism Personal Cloud · v0.1.0
            </p>
          </div>
        </div>
      </div>
  );
}
