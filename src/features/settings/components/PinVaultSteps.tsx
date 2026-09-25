"use client";

import { Spinner } from "@phosphor-icons/react";
import { PinInput } from "./PinInput";

const ghostBtn =
  "flex-1 rounded-lg border border-main-border bg-surface-bg px-3 py-1.5 text-[12px] text-muted-text transition-colors hover:text-main-text cursor-pointer";

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
        ? "flex-1 rounded-lg bg-rose-500 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-40 cursor-pointer"
        : "flex-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground disabled:opacity-40 cursor-pointer"}
    >
      {loading ? <Spinner size={12} weight="light" className="mx-auto animate-spin" /> : label}
    </button>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-[12px] text-muted-text">{title}</p>
      {children}
    </div>
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
      <Step title="Enter a 6-digit PIN">
        <PinInput value={pinInput} onChange={(v) => { setPinInput(v); if (v.length === 6) setStep(1); }} maxLength={6} />
      </Step>
    );
  }
  return (
    <Step title="Enter it again">
      <PinInput value={pinConfirm} onChange={setPinConfirm} maxLength={6} />
      <div className="mt-1 flex w-full gap-2">
        <button type="button" onClick={() => { setStep(0); setPinConfirm(""); }} className={ghostBtn}>Back</button>
        <ActionButton loading={loading} disabled={loading || pinConfirm.length !== 6 || pinInput !== pinConfirm} label="Set PIN" onClick={setPin} />
      </div>
    </Step>
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
      <Step title="Current PIN">
        <PinInput value={pinOld} onChange={(v) => { setPinOld(v); if (v.length === 6) setStep(1); }} maxLength={6} />
      </Step>
    );
  }
  if (step === 1) {
    return (
      <Step title="New PIN">
        <PinInput value={pinInput} onChange={(v) => { setPinInput(v); if (v.length === 6) setStep(2); }} maxLength={6} />
        <button type="button" onClick={() => { setStep(0); setPinInput(""); }} className={`${ghostBtn} mt-1 w-full`}>Back</button>
      </Step>
    );
  }
  return (
    <Step title="Enter the new PIN again">
      <PinInput value={pinConfirm} onChange={setPinConfirm} maxLength={6} />
      <div className="mt-1 flex w-full gap-2">
        <button type="button" onClick={() => { setStep(1); setPinConfirm(""); }} className={ghostBtn}>Back</button>
        <ActionButton loading={loading} disabled={loading || pinConfirm.length !== 6 || pinInput !== pinConfirm} label="Change PIN" onClick={changePin} />
      </div>
    </Step>
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
    <Step title="Enter your current PIN. Private media stays locked until you set a new one.">
      <PinInput value={pinOld} onChange={setPinOld} maxLength={6} />
      <div className="mt-1 flex w-full gap-2">
        <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
        <ActionButton loading={loading} disabled={loading || pinOld.length !== 6} label="Remove" danger onClick={removePin} />
      </div>
    </Step>
  );
}
