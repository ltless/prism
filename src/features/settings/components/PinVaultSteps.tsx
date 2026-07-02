"use client";

import { Shield, ShieldSlash, Spinner, Check } from "@phosphor-icons/react";
import { PinInput } from "./PinInput";

function ActionButton(props: {
  loading: boolean;
  disabled: boolean;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  const { loading, disabled, label, onClick, danger } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={danger
        ? "flex-1 px-4 py-2 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg text-[11px] font-medium hover:bg-rose-500/15 disabled:opacity-50 transition-colors cursor-pointer"
        : "flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer"}
    >
      {loading ? <Spinner size={12} weight="light" className="animate-spin mx-auto" /> : danger ? label : (
        <>
          <Check size={12} weight="fill" />
          {label}
        </>
      )}
    </button>
  );
}

function IconHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <>
      {icon}
      <p className="text-[13px] font-medium text-main-text">{title}</p>
    </>
  );
}

export function SetPinFlow({ pinInput, pinConfirm, setPinInput, setPinConfirm, step, setStep, loading, setPin }: {
  pinInput: string;
  pinConfirm: string;
  setPinInput: (v: string) => void;
  setPinConfirm: (v: string) => void;
  step: number;
  setStep: (v: number | ((p: number) => number)) => void;
  loading: boolean;
  setPin: () => void;
}) {
  if (step === 0) {
    return (
      <div className="flex flex-col items-center gap-5">
        <IconHeader icon={<Shield size={24} weight="light" className="text-primary" />} title="Set Vault PIN" />
        <PinInput value={pinInput} onChange={(v) => { setPinInput(v); if (v.length === 6) setStep(1); }} maxLength={6} label="Enter PIN" />
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-5">
      <IconHeader icon={<Shield size={24} weight="light" className="text-primary" />} title="Confirm PIN" />
      <PinInput value={pinConfirm} onChange={setPinConfirm} maxLength={6} label="Re-enter PIN" />
      <div className="flex gap-2 w-full mt-4">
        <button type="button" onClick={() => { setStep(0); setPinConfirm(""); }} className="flex-1 px-4 py-2 bg-surface-bg border border-main-border/50 text-muted-text rounded-lg text-[11px] font-medium hover:text-main-text transition-colors cursor-pointer">
          Back
        </button>
        <ActionButton loading={loading} disabled={loading || pinConfirm.length !== 6 || pinInput !== pinConfirm} label="Set PIN" onClick={setPin} />
      </div>
    </div>
  );
}

export function ChangePinFlow({ pinOld, pinInput, pinConfirm, setPinOld, setPinInput, setPinConfirm, step, setStep, loading, changePin }: {
  pinOld: string;
  pinInput: string;
  pinConfirm: string;
  setPinOld: (v: string) => void;
  setPinInput: (v: string) => void;
  setPinConfirm: (v: string) => void;
  step: number;
  setStep: (v: number | ((p: number) => number)) => void;
  loading: boolean;
  changePin: () => void;
}) {
  if (step === 0) {
    return (
      <div className="flex flex-col items-center gap-5">
        <IconHeader icon={<Shield size={24} weight="light" className="text-primary" />} title="Current PIN" />
        <PinInput value={pinOld} onChange={(v) => { setPinOld(v); if (v.length === 6) setStep(1); }} maxLength={6} label="Enter current PIN" />
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="flex flex-col items-center gap-5">
        <IconHeader icon={<Shield size={24} weight="light" className="text-primary" />} title="New PIN" />
        <PinInput value={pinInput} onChange={(v) => { setPinInput(v); if (v.length === 6) setStep(2); }} maxLength={6} label="Enter new PIN" />
        <button type="button" onClick={() => { setStep(0); setPinInput(""); }} className="w-full px-4 py-2 bg-surface-bg border border-main-border/50 text-muted-text rounded-lg text-[11px] font-medium hover:text-main-text transition-colors cursor-pointer mt-4">
          Back
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-5">
      <IconHeader icon={<Shield size={24} weight="light" className="text-primary" />} title="Confirm New PIN" />
      <PinInput value={pinConfirm} onChange={setPinConfirm} maxLength={6} label="Re-enter new PIN" />
      <div className="flex gap-2 w-full mt-4">
        <button type="button" onClick={() => { setStep(1); setPinConfirm(""); }} className="flex-1 px-4 py-2 bg-surface-bg border border-main-border/50 text-muted-text rounded-lg text-[11px] font-medium hover:text-main-text transition-colors cursor-pointer">
          Back
        </button>
        <ActionButton loading={loading} disabled={loading || pinConfirm.length !== 6 || pinInput !== pinConfirm} label="Change PIN" onClick={changePin} />
      </div>
    </div>
  );
}

export function RemovePinBody({ pinOld, setPinOld, loading, removePin, onClose }: {
  pinOld: string;
  setPinOld: (v: string) => void;
  loading: boolean;
  removePin: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <IconHeader icon={<ShieldSlash size={24} weight="light" className="text-red-400" />} title="Remove Vault PIN" />
      <p className="text-[11px] text-muted-text text-center">Enter your current PIN to remove it</p>
      <PinInput value={pinOld} onChange={setPinOld} maxLength={6} />
      <div className="flex gap-2 w-full mt-4">
        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-surface-bg border border-main-border/50 text-muted-text rounded-lg text-[11px] font-medium hover:text-main-text transition-colors cursor-pointer">
          Cancel
        </button>
        <ActionButton loading={loading} disabled={loading || pinOld.length !== 6} label="Remove" danger onClick={removePin} />
      </div>
    </div>
  );
}