"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import { PinInput } from "@/features/settings/components/PinInput";

interface VaultStepProps {
 pin: string;
 onPinChange: (pin: string) => void;
}

export function VaultStep({ pin, onPinChange }: VaultStepProps) {
 return (
 <div className="flex w-full flex-col items-center gap-7">
 <PinInput
 value={pin}
 onChange={onPinChange}
 maxLength={6}
 />

 <p className="flex items-start gap-2.5 rounded-[1.25rem] bg-emerald-500/[0.07] p-4 text-left ring-1 ring-emerald-500/15">
 <ShieldCheck className="mt-px shrink-0 text-emerald-500" size={15} weight="light" />
 <span className="text-[12px] leading-relaxed text-muted-text">
 Your PIN is hashed and stored locally. It is required to open private media.
 </span>
 </p>
 </div>
 );
}
