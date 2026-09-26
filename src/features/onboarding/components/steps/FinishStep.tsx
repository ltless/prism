"use client";

import { Check } from "@phosphor-icons/react";
import { m } from "motion/react";

export function FinishStep() {
 return (
 <div className="flex flex-col items-center gap-4">
 <m.span
 initial={{ scale: 0.6, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 transition={{ type: "spring", stiffness: 480, damping: 26 }}
 className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
 >
 <Check size={30} weight="light" />
 </m.span>
 <div className="flex flex-col gap-1 text-center">
 <p className="text-[15px] font-medium tracking-tight text-main-text">Prism is ready</p>
 <p className="mx-auto max-w-[26ch] text-[12px] leading-relaxed text-muted-text">
 Your local library has been initialized.
 </p>
 </div>
 </div>
 );
}
