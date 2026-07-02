"use client";

import { useState, useEffect } from "react";
import { Check, Spinner, Shield, ShieldWarning } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  changePasswordAction,
  setVaultPinAction,
  changeVaultPinAction,
  disableVaultPinAction,
  getVaultPinStatusAction,
} from "@/features/profile/services/profileActions";
import { PasswordInput } from "@/shared/components/ui/PasswordInput";
import { SectionCard } from "@/shared/components/SectionCard";
import { LockKey } from "@phosphor-icons/react";

export function PasswordCard() {
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPw || !newPw || !confirmPw) { toast.error("Fill all fields"); return; }
    if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
    if (newPw.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setPwLoading(true);
    try {
      const res = await changePasswordAction(oldPw, newPw);
      if (res.success) {
        toast.success("Password changed");
        setOldPw(""); setNewPw(""); setConfirmPw("");
      } else {
        toast.error(res.error || "Failed");
      }
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <SectionCard icon={LockKey} title="Account Credentials" bodyClassName="flex flex-col gap-4">
      <p className="text-[11px] text-muted-text">Change your current account password below. Minimum 8 characters required.</p>

      <div className="space-y-4 max-w-md pt-2">
        <PasswordInput value={oldPw} onChange={setOldPw} label="Current Password" placeholder="Enter current password..." />
        <PasswordInput value={newPw} onChange={setNewPw} label="New Password" placeholder="Enter new password..." />
        <PasswordInput value={confirmPw} onChange={setConfirmPw} label="Confirm New Password" placeholder="Confirm new password..." />

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={pwLoading || !oldPw || !newPw || !confirmPw}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer shadow-sm"
          >
            {pwLoading ? <Spinner size={12} className="animate-spin" weight="light" /> : <Check size={12} weight="bold" />}
            Update Password
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

function VaultPinSection() {
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState<"set" | "change" | "remove" | null>(null);

  const refreshPinStatus = () => {
    getVaultPinStatusAction().then(res => {
      if (res.success) setHasPin(res.hasPin);
    });
  };

  useEffect(refreshPinStatus, []);

  return (
    <div className="rounded-xl border border-main-border/50 bg-panel-bg overflow-hidden shadow-sm">
      <div className="p-4 border-b border-main-border/30 bg-surface-bg/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={15} weight="light" className="text-primary" />
          <h4 className="text-[12px] font-semibold text-main-text">Private Vault Lock</h4>
        </div>

        {hasPin !== null && (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${hasPin ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${hasPin ? "bg-emerald-500" : "bg-amber-500"}`} />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-text">
              {hasPin ? "Active" : "Not Configured"}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 md:p-5 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-lg shrink-0 ${hasPin ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}>
            {hasPin ? <Shield size={20} weight="fill" /> : <ShieldWarning size={20} weight="light" />}
          </div>

          <div className="flex-1 space-y-1">
            <h5 className="text-[12px] font-semibold text-main-text">
              {hasPin ? "Vault is protected by a numeric PIN" : "Vault is unprotected"}
            </h5>
            <p className="text-[11px] text-muted-text max-w-xl">
              A numeric PIN protects access to your private media collection. When enabled, users must input the PIN to open and view the secure vault area.
            </p>
          </div>
        </div>

        {hasPin === null ? (
          <div className="flex items-center gap-2 text-muted-text pt-2">
            <Spinner size={12} className="animate-spin" weight="light" />
            <span className="text-[11px]">Checking vault lock status...</span>
          </div>
        ) : (
          <div className="flex gap-2 pt-2 border-t border-main-border/30">
            <button
              type="button"
              onClick={() => setDialog(hasPin ? "change" : "set")}
              className="px-3.5 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
            >
              <Shield size={12} weight="fill" />
              {hasPin ? "Change Security PIN" : "Setup Security PIN"}
            </button>
            {hasPin && (
              <button
                type="button"
                onClick={() => setDialog("remove")}
                className="px-3.5 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-[11px] font-medium hover:bg-rose-500/15 transition-colors cursor-pointer"
              >
                Disable PIN Lock
              </button>
            )}
          </div>
        )}
      </div>

      {dialog && (
        <PinVaultDialog
          dialog={dialog}
          onClose={() => setDialog(null)}
          onSuccess={refreshPinStatus}
          onSetPin={setVaultPinAction}
          onChangePin={changeVaultPinAction}
          onRemovePin={disableVaultPinAction}
        />
      )}
    </div>
  );
}

import { PinVaultDialog } from "../PinVaultDialog";
export { VaultPinSection };