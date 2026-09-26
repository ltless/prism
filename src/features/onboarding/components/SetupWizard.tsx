"use client";

import { m, AnimatePresence } from "motion/react";
import { Spinner } from "@phosphor-icons/react";

import { WizardProgress } from "./steps/WizardProgress";
import { WizardFooter } from "./steps/WizardFooter";
import { ProfileStep } from "./steps/ProfileStep";
import { VaultStep } from "./steps/VaultStep";
import { StorageStep } from "./steps/StorageStep";
import { FinishStep } from "./steps/FinishStep";
import { useSetupWizard } from "../hooks/useSetupWizard";
import { BrandLogo } from "@/shared/components/BrandLogo";

export function SetupWizard() {
  const {
    steps, currentStep, isCompleting, isUploading,
    profileImage, coverImage, pin, setPin,
    selectedOwnLimit, setSelectedOwnLimit,
    selectedGlobalLimit, setSelectedGlobalLimit,
    handleFileUpload, handleNext, goBack,
  } = useSetupWizard();

  const step = steps[currentStep];
  const StepIcon = step.icon;

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-6 overflow-hidden bg-app-bg p-4 sm:p-6">
      <m.div
        key="wizard-frame"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="w-full max-w-2xl rounded-[2rem] bg-black/[0.03] p-1.5 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10"
      >
        <div className="overflow-hidden rounded-[calc(2rem-0.375rem)] bg-panel-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          <header className="px-7 pb-6 pt-7 sm:px-9 sm:pb-7 sm:pt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BrandLogo size={34} />
                <div className="flex flex-col">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-text">Setup</p>
                  <p className="text-[14px] font-medium tracking-tight text-main-text">Prism</p>
                </div>
              </div>
              <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-[11px] font-medium tabular-nums tracking-[0.14em] text-muted-text ring-1 ring-black/[0.05] dark:bg-white/[0.07] dark:ring-white/10">
                {String(currentStep + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
              </span>
            </div>
            <div className="mt-6">
              <WizardProgress steps={steps} currentStep={currentStep} />
            </div>
          </header>

          <div className="flex min-h-[22rem] flex-col items-center px-7 pb-10 pt-8 text-center sm:px-9">
            <AnimatePresence mode="wait">
              <m.div
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                className="flex w-full flex-col items-center"
              >
                <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.04] text-main-text ring-1 ring-black/[0.05] dark:bg-white/[0.06] dark:ring-white/10">
                  <StepIcon size={20} weight="light" />
                </span>

                <h2 className="text-[22px] font-medium tracking-tight text-main-text">{step.title}</h2>
                <p className="mt-1.5 max-w-[30ch] text-[13px] leading-relaxed text-muted-text">{step.subtitle}</p>

                <div className="mt-8 w-full max-w-sm text-left">
                  {step.id === "profile" && (
                    <ProfileStep
                      profileImage={profileImage}
                      coverImage={coverImage}
                      isUploading={isUploading}
                      onFileUpload={handleFileUpload}
                    />
                  )}

                  {step.id === "vault" && (
                    <VaultStep pin={pin} onPinChange={setPin} />
                  )}

                  {step.id === "storage" && (
                    <StorageStep
                      selectedOwnLimit={selectedOwnLimit}
                      onOwnLimitChange={setSelectedOwnLimit}
                      selectedGlobalLimit={selectedGlobalLimit}
                      onGlobalLimitChange={setSelectedGlobalLimit}
                    />
                  )}

                  {step.id === "finish" && <FinishStep />}
                </div>
              </m.div>
            </AnimatePresence>
          </div>

          <WizardFooter
            currentStep={currentStep}
            totalSteps={steps.length}
            isCompleting={isCompleting}
            isUploading={isUploading}
            onBack={goBack}
            onNext={handleNext}
          />
        </div>
      </m.div>

      <div className="flex flex-col items-center gap-1.5">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-text">
          {isCompleting ? (
            <Spinner size={11} className="animate-spin" />
          ) : (
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500/60" />
          )}
          System Encrypted
        </p>
        <p className="text-[10px] uppercase tracking-[0.2em] text-muted-text/60">Prism · v0.1.0</p>
      </div>
    </div>
  );
}
