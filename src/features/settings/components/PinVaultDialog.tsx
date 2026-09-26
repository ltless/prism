"use client";

import { useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { SetPinFlow, ChangePinFlow, RemovePinBody } from "./PinVaultSteps";

export type PinDialogType = "set" | "change" | "remove";

interface PinVaultDialogProps {
  dialog: PinDialogType;
  onClose: () => void;
  onSuccess: () => void;
  onSetPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  onChangePin: (oldPin: string, newPin: string) => Promise<{ success: boolean; error?: string }>;
  onRemovePin: (oldPin: string) => Promise<{ success: boolean; error?: string }>;
}

export function PinVaultDialog({
  dialog,
  onClose,
  onSuccess,
  onSetPin,
  onChangePin,
  onRemovePin
}: PinVaultDialogProps) {
  const [step, setStep] = useState(0);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinOld, setPinOld] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<{ success: boolean; error?: string }>, okMsg: string, failMsg: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fn();
      if (res.success) {
        toast.success(okMsg);
        onSuccess();
        onClose();
      } else {
        setError(res.error || failMsg);
        toast.error(res.error || failMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSet = () => {
    if (pinInput !== pinConfirm) {
      toast.error("PINs do not match");
      return;
    }
    run(() => onSetPin(pinInput), "PIN set successfully", "Failed to set PIN");
  };

  const handleChange = () => {
    if (pinInput !== pinConfirm) {
      toast.error("PINs do not match");
      return;
    }
    run(() => onChangePin(pinOld, pinInput), "PIN changed successfully", "Failed to change PIN");
  };

  const handleRemove = () => {
    run(() => onRemovePin(pinOld), "PIN removed successfully", "Failed to remove PIN");
  };

  return (
    <AnimatePresence>
      {dialog && (
        <m.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog" aria-modal="true" aria-label="PIN vault dialog" className="fixed inset-0 z-modal flex items-center justify-center"
        >
          <button type="button" aria-label="Close dialog backdrop" className="absolute inset-0 bg-black/60 border-0 cursor-default" onClick={onClose} />
          <m.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            className="relative mx-4 w-full max-w-xs rounded-[2rem] bg-panel-bg px-5 pb-5 pt-4 shadow-modal ring-1 ring-black/10 dark:ring-white/10"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-text">Vault</p>
                <p className="mt-0.5 text-[14px] font-medium text-main-text">
                  {dialog === "set" ? "Set PIN" : dialog === "change" ? "Change PIN" : "Remove PIN"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] text-muted-text transition-transform duration-500 ease-spring hover:bg-black/[0.08] hover:text-main-text cursor-pointer dark:bg-white/10 dark:hover:bg-white/15"
              >
                <X size={13} weight="light" />
              </button>
            </div>

            {error && (
              <p className="mb-3 text-center text-[12px] text-rose-500">{error}</p>
            )}

            {dialog === "set" && (
              <SetPinFlow
                pinInput={pinInput} pinConfirm={pinConfirm}
                setPinInput={setPinInput} setPinConfirm={setPinConfirm}
                step={step} setStep={setStep} loading={loading} setPin={handleSet}
              />
            )}
            {dialog === "change" && (
              <ChangePinFlow
                pinOld={pinOld} pinInput={pinInput} pinConfirm={pinConfirm}
                setPinOld={setPinOld} setPinInput={setPinInput} setPinConfirm={setPinConfirm}
                step={step} setStep={setStep} loading={loading} changePin={handleChange}
              />
            )}
            {dialog === "remove" && (
              <RemovePinBody
                pinOld={pinOld} setPinOld={setPinOld} loading={loading}
                removePin={handleRemove} onClose={onClose}
              />
            )}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}