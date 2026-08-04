"use client";

import { Check } from "@phosphor-icons/react";

export function FinishStep() {
 return (
 <div className="flex flex-col items-center gap-5">
 <div className="w-16 h-16 bg-primary text-primary-foreground rounded-xl flex items-center justify-center ">
 <Check size={32} weight="light" />
 </div>
 <div className="space-y-1 text-center">
 <h4 className="text-sm font-semibold">Prism is Ready</h4>
 <p className="text-[11px] text-muted-text max-w-[200px] mx-auto">
 Your secure personal cloud has been initialized.
 </p>
 </div>
 </div>
 );
}
