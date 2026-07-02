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
          role="dialog" aria-modal="true" aria-label="PIN vault dialog" className="fixed inset-0 z-50 flex items-center justify-center"
        >
          <button type="button" aria-label="Close dialog backdrop" className="absolute inset-0 bg-black/60 border-0 cursor-default" onClick={onClose} />
          <m.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-panel-bg border border-main-border/50 rounded-xl p-8 w-full max-w-xs mx-4"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 text-muted-text hover:text-main-text transition-colors cursor-pointer"
            >
              <X size={16} weight="light" />
            </button>

            {error && (
              <p className="text-[11px] text-rose-500 text-center mb-4">{error}</p>
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