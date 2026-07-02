"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import { PinInput } from "@/features/settings/components/PinInput";

interface VaultStepProps {
 pin: string;
 onPinChange: (pin: string) => void;
}

export function VaultStep({ pin, onPinChange }: VaultStepProps) {
 return (
 <div className="flex flex-col items-center gap-8 w-full">
 <PinInput
 value={pin}
 onChange={onPinChange}
 maxLength={6}
 />

 <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg w-full">
 <ShieldCheck className="text-emerald-500 shrink-0" size={16} weight="fill" />
 <p className="text-[11px] text-emerald-600/70 leading-relaxed">
 Your PIN is hashed and stored locally. It will be required to access hidden folders.
 </p>
 </div>
 </div>
 );
}
