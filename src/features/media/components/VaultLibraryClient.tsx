"use client";

import { useState, useEffect, useRef } from "react";
import { Lock, WarningCircle, Gear } from "@phosphor-icons/react";
import { m, AnimatePresence } from "motion/react";
import { PinInput } from "@/features/settings/components/PinInput";
import { verifyVaultPinAction } from "@/features/profile/services/profileActions";
import { VaultPinProvider } from "../context/VaultPinContext";
import MediaLibraryClient from "./MediaLibraryClient";
import type { MediaItem, Folder } from "../types";
import { toast } from "sonner";
import Link from "next/link";

interface VaultLibraryClientProps {
 initialItems: MediaItem[];
 folders: Folder[];
 hasPin: boolean;
}

export default function VaultLibraryClient({
 initialItems,
 folders,
 hasPin: initialHasPin,
}: VaultLibraryClientProps) {
 const [isUnlocked, setIsUnlocked] = useState(false);
 const [pin, setPin] = useState("");
 const [error, setError] = useState("");
 const [isVerifying, setIsVerifying] = useState(false);
 const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

 useEffect(() => {
 const handleVisibilityChange = () => {
 if (document.visibilityState === "hidden" && isUnlocked) {
 setIsUnlocked(false);
 setPin("");
 setError("");
 toast.info("Vault locked automatically");
 }
 };

 document.addEventListener("visibilitychange", handleVisibilityChange);
 return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
 }, [isUnlocked]);

 useEffect(() => {
 if (!isUnlocked) {
 if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
 return;
 }

 const resetIdleTimer = () => {
 if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);

 idleTimeoutRef.current = setTimeout(() => {
 setIsUnlocked(false);
 setPin("");
 setError("");
 toast.warning("Vault locked due to inactivity");
 }, 3 * 60 * 1000);
 };

 const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"];
 events.forEach((evt) => window.addEventListener(evt, resetIdleTimer));

 return () => {
 events.forEach((evt) => window.removeEventListener(evt, resetIdleTimer));
 if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
 };
 }, [isUnlocked]);

 const handlePinChange = async (newPin: string) => {
 setPin(newPin);
 setError("");

 if (newPin.length === 6) {
 setIsVerifying(true);
 try {
 const res = await verifyVaultPinAction(newPin);
 if (res.success) {
 setIsUnlocked(true);
 toast.success("Vault decrypted successfully");
 } else {
 setError("Incorrect PIN code");
 }
 } catch (err) {
 const errorMsg = err instanceof Error ? err.message : "Failed to verify PIN";
 setError(errorMsg);
 setPin("");
 } finally {
 setIsVerifying(false);
 }
 }
 };

 // Case 1: PIN is not configured yet
 if (!initialHasPin) {
 return (
 <div className="flex-1 flex items-center justify-center p-6 bg-app-bg">
 <div className="w-full max-w-sm p-8 bg-panel-bg border border-main-border/30 rounded-xl shadow-sm flex flex-col items-center text-center gap-6">
 <div className="w-12 h-12 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-center text-amber-500">
 <WarningCircle size={22} weight="light" />
 </div>
 <div className="space-y-1.5">
 <h2 className="text-xs font-semibold text-main-text">Vault PIN Required</h2>
 <p className="text-[11px] font-medium text-muted-text leading-relaxed">
 Your secure vault must be protected by a PIN. Please set a 6-digit Vault PIN in your account security settings first.
 </p>
 </div>
 <Link
 href="/dashboard/settings?tab=security"
 className="w-full py-2.5 rounded-xl bg-surface-bg/80 border border-main-border/65 text-main-text text-xs font-semibold hover:bg-primary/5 hover:border-primary/20 transition-[background-color,border-color] ease-out-expo flex items-center justify-center gap-2 cursor-pointer"
 >
 <Gear size={13} weight="light" />
 Configure Vault PIN
 </Link>
 </div>
 </div>
 );
 }

  // Case 2: Unlocked State -> render media library. The verified PIN is
  // provided so un-vault actions can satisfy the server-side check.
  if (isUnlocked) {
    return (
      <VaultPinProvider pin={pin}>
        <MediaLibraryClient
          initialItems={initialItems}
          folders={folders}
        />
      </VaultPinProvider>
    );
  }

 // Case 3: Locked State -> show numeric padlock PIN prompt
 return (
 <div className="flex-1 flex items-center justify-center p-6 bg-app-bg select-none">
 <AnimatePresence mode="wait">
 <m.div
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 exit={{ opacity: 0, scale: 0.95 }}
 transition={{ duration: 0.25, ease: "easeOut" }}
 className="w-full max-w-xs p-8 bg-panel-bg border border-main-border/30 rounded-xl shadow-sm flex flex-col items-center gap-6"
 >
 <div className="w-12 h-12 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary">
 <Lock size={18} weight="light" className={isVerifying ? "animate-pulse" : ""} />
 </div>
 
 <div className="text-center space-y-1">
 <h2 className="text-[11px] font-semibold text-main-text">Secure Vault</h2>
 <p className="text-[11px] font-semibold text-muted-text leading-none">
 Isolated Encrypted Section
 </p>
 </div>

 <div className="w-full py-1">
 <PinInput
 value={pin}
 onChange={handlePinChange}
 maxLength={6}
 error={error}
 label={isVerifying ? "Decrypting Vault..." : "Enter 6-Digit PIN Code"}
 />
 </div>
 </m.div>
 </AnimatePresence>
 </div>
 );
}