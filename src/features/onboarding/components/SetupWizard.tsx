"use client";

import { m, AnimatePresence } from "motion/react";

import { WizardProgress } from "./steps/WizardProgress";
import { WizardFooter } from "./steps/WizardFooter";
import { ProfileStep } from "./steps/ProfileStep";
import { VaultStep } from "./steps/VaultStep";
import { StorageStep } from "./steps/StorageStep";
import { FinishStep } from "./steps/FinishStep";
import { useSetupWizard } from "../hooks/useSetupWizard";

export function SetupWizard() {
  const {
    steps, currentStep, isCompleting, isUploading,
    profileImage, coverImage, pin, setPin,
    selectedOwnLimit, setSelectedOwnLimit,
    selectedGlobalLimit, setSelectedGlobalLimit,
    handleFileUpload, handleNext, goBack,
  } = useSetupWizard();

  return (
    <div className="min-h-screen bg-app-bg flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-xl relative z-10">
        <m.div
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
              <m.div
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
              </m.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <WizardFooter
            currentStep={currentStep}
            totalSteps={steps.length}
            isCompleting={isCompleting}
            isUploading={isUploading}
            onBack={goBack}
            onNext={handleNext}
          />
          </m.div>

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
