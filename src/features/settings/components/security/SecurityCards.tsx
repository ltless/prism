"use client";

import { useState, useEffect } from "react";
import { Spinner } from "@phosphor-icons/react";
import { toast } from "sonner";
import {
  changePasswordAction,
  setVaultPinAction,
  changeVaultPinAction,
  disableVaultPinAction,
  getVaultPinStatusAction,
} from "@/features/profile/services/profileActions";
import { PasswordInput } from "@/shared/components/ui/PasswordInput";
import { SettingsGroup } from "../SettingsGroup";

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
    <SettingsGroup title="Password" description="At least 8 characters. Changing it signs out your other sessions.">
      <div className="flex flex-col gap-3 p-4">
        <PasswordInput value={oldPw} onChange={setOldPw} label="Current password" placeholder="Current password" />
        <PasswordInput value={newPw} onChange={setNewPw} label="New password" placeholder="New password" />
        <PasswordInput value={confirmPw} onChange={setConfirmPw} label="Confirm new password" placeholder="Confirm new password" />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleChangePassword}
            disabled={pwLoading || !oldPw || !newPw || !confirmPw}
            className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-40 cursor-pointer"
          >
            {pwLoading ? <Spinner size={12} className="animate-spin" /> : "Update password"}
          </button>
        </div>
      </div>
    </SettingsGroup>
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
    <SettingsGroup title="Vault PIN" description="Required to open private media. Five wrong tries locks it for 15 minutes.">
      <div className="flex flex-col gap-4 px-5 py-5">
        {hasPin === null ? (
          <span className="flex items-center gap-2 text-[12px] text-muted-text">
            <Spinner size={12} className="animate-spin" />
            Checking
          </span>
        ) : (
          <>
            <p className="text-[13px] text-main-text">{hasPin ? "PIN is on" : "No PIN set"}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDialog(hasPin ? "change" : "set")}
                className="rounded-full bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground cursor-pointer"
              >
                {hasPin ? "Change PIN" : "Set PIN"}
              </button>
              {hasPin && (
                <button
                  type="button"
                  onClick={() => setDialog("remove")}
                  className="rounded-full px-4 py-2 text-[13px] font-medium text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          </>
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
    </SettingsGroup>
  );
}

import { PinVaultDialog } from "../PinVaultDialog";
export { VaultPinSection };