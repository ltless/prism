"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, ShieldSlash, Spinner, Check, X } from "@phosphor-icons/react";
import { toast } from "sonner";
import { PinInput } from "./PinInput";

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

 const handleSet = async () => {
 if (pinInput !== pinConfirm) {
 toast.error("PINs do not match");
 return;
 }
 setLoading(true);
 setError(null);
 const res = await onSetPin(pinInput);
 if (res.success) {
 toast.success("PIN set successfully");
 onSuccess();
 onClose();
 } else {
 setError(res.error || "Failed to set PIN");
 toast.error(res.error || "Failed to set PIN");
 }
 setLoading(false);
 };

 const handleChange = async () => {
 if (pinInput !== pinConfirm) {
 toast.error("PINs do not match");
 return;
 }
 setLoading(true);
 setError(null);
 const res = await onChangePin(pinOld, pinInput);
 if (res.success) {
 toast.success("PIN changed successfully");
 onSuccess();
 onClose();
 } else {
 setError(res.error || "Failed to change PIN");
 toast.error(res.error || "Failed to change PIN");
 }
 setLoading(false);
 };

 const handleRemove = async () => {
 setLoading(true);
 setError(null);
 const res = await onRemovePin(pinOld);
 if (res.success) {
 toast.success("PIN removed successfully");
 onSuccess();
 onClose();
 } else {
 setError(res.error || "Failed to remove PIN");
 toast.error(res.error || "Failed to remove PIN");
 }
 setLoading(false);
 };

  return (
  <AnimatePresence>
  {dialog && (
  <motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  exit={{ opacity: 0 }}
  role="dialog" aria-modal="true" aria-label="PIN vault dialog" className="fixed inset-0 z-50 flex items-center justify-center"
  >
  <div className="absolute inset-0 bg-black/60" onClick={onClose} />
  <motion.div
  initial={{ scale: 0.95, opacity: 0, y: 10 }}
  animate={{ scale: 1, opacity: 1, y: 0 }}
  exit={{ scale: 0.95, opacity: 0, y: 10 }}
  transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
  className="relative bg-panel-bg border border-main-border/50 rounded-xl p-8 w-full max-w-xs mx-4"
  >
  <button
 onClick={onClose}
 className="absolute top-3 right-3 text-muted-text hover:text-main-text transition-colors cursor-pointer"
 >
 <X size={16} weight="light" />
 </button>

 {error && (
 <p className="text-[11px] text-rose-500 text-center mb-4">{error}</p>
 )}

 {dialog === "set" && step === 0 && (
 <div className="flex flex-col items-center gap-5">
 <Shield size={24} weight="light" className="text-primary" />
 <p className="text-[13px] font-medium text-main-text">Set Vault PIN</p>
 <PinInput value={pinInput} onChange={(v) => { setPinInput(v); if (v.length === 6) setStep(1); }} maxLength={6} label="Enter PIN" />
 </div>
 )}
 {dialog === "set" && step === 1 && (
 <div className="flex flex-col items-center gap-5">
 <Shield size={24} weight="light" className="text-primary" />
 <p className="text-[13px] font-medium text-main-text">Confirm PIN</p>
 <PinInput value={pinConfirm} onChange={setPinConfirm} maxLength={6} label="Re-enter PIN" />
 <div className="flex gap-2 w-full mt-4">
 <button onClick={() => { setStep(0); setPinConfirm(""); }} className="flex-1 px-4 py-2 bg-surface-bg border border-main-border/50 text-muted-text rounded-lg text-[11px] font-medium hover:text-main-text transition-colors cursor-pointer">
 Back
 </button>
 <button onClick={handleSet} disabled={loading || pinConfirm.length !== 6 || pinInput !== pinConfirm} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer">
 {loading ? <Spinner size={12} weight="light" className="animate-spin" /> : <Check size={12} weight="fill" />}
 Set PIN
 </button>
 </div>
 </div>
 )}

 {dialog === "change" && step === 0 && (
 <div className="flex flex-col items-center gap-5">
 <Shield size={24} weight="light" className="text-primary" />
 <p className="text-[13px] font-medium text-main-text">Current PIN</p>
 <PinInput value={pinOld} onChange={(v) => { setPinOld(v); if (v.length === 6) setStep(1); }} maxLength={6} label="Enter current PIN" />
 </div>
 )}
 {dialog === "change" && step === 1 && (
 <div className="flex flex-col items-center gap-5">
 <Shield size={24} weight="light" className="text-primary" />
 <p className="text-[13px] font-medium text-main-text">New PIN</p>
 <PinInput value={pinInput} onChange={(v) => { setPinInput(v); if (v.length === 6) setStep(2); }} maxLength={6} label="Enter new PIN" />
 <button onClick={() => { setStep(0); setPinInput(""); }} className="w-full px-4 py-2 bg-surface-bg border border-main-border/50 text-muted-text rounded-lg text-[11px] font-medium hover:text-main-text transition-colors cursor-pointer mt-4">
 Back
 </button>
 </div>
 )}
 {dialog === "change" && step === 2 && (
 <div className="flex flex-col items-center gap-5">
 <Shield size={24} weight="light" className="text-primary" />
 <p className="text-[13px] font-medium text-main-text">Confirm New PIN</p>
 <PinInput value={pinConfirm} onChange={setPinConfirm} maxLength={6} label="Re-enter new PIN" />
 <div className="flex gap-2 w-full mt-4">
 <button onClick={() => { setStep(1); setPinConfirm(""); }} className="flex-1 px-4 py-2 bg-surface-bg border border-main-border/50 text-muted-text rounded-lg text-[11px] font-medium hover:text-main-text transition-colors cursor-pointer">
 Back
 </button>
 <button onClick={handleChange} disabled={loading || pinConfirm.length !== 6 || pinInput !== pinConfirm} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer">
 {loading ? <Spinner size={12} weight="light" className="animate-spin" /> : <Check size={12} weight="fill" />}
 Change PIN
 </button>
 </div>
 </div>
 )}

 {dialog === "remove" && (
 <div className="flex flex-col items-center gap-5">
 <ShieldSlash size={24} weight="light" className="text-red-400" />
 <p className="text-[13px] font-medium text-main-text">Remove Vault PIN</p>
 <p className="text-[11px] text-muted-text text-center">
 Enter your current PIN to remove it
 </p>
 <PinInput value={pinOld} onChange={setPinOld} maxLength={6} />
 <div className="flex gap-2 w-full mt-4">
 <button onClick={onClose} className="flex-1 px-4 py-2 bg-surface-bg border border-main-border/50 text-muted-text rounded-lg text-[11px] font-medium hover:text-main-text transition-colors cursor-pointer">
 Cancel
 </button>
 <button onClick={handleRemove} disabled={loading || pinOld.length !== 6} className="flex-1 px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-[11px] font-medium hover:bg-rose-500/15 disabled:opacity-50 transition-colors cursor-pointer">
 {loading ? <Spinner size={12} weight="light" className="animate-spin mx-auto" /> : "Remove"}
 </button>
 </div>
 </div>
 )}
  </motion.div>
  </motion.div>
  )}
  </AnimatePresence>
  );
}
