"use client";

import { CaretLeft, CaretRight, Spinner } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

interface WizardFooterProps {
 currentStep: number;
 totalSteps: number;
 isCompleting: boolean;
 isUploading: string | null;
 onBack: () => void;
 onNext: () => void;
}

export function WizardFooter({ currentStep, totalSteps, isCompleting, isUploading, onBack, onNext }: WizardFooterProps) {
 const busy = isCompleting || isUploading !== null;

 return (
 <div className="flex items-center justify-between gap-3 border-t border-main-border/60 px-7 py-5 sm:px-9">
 <button
 type="button"
 onClick={onBack}
 disabled={currentStep === 0 || isCompleting}
 className={cn(
 "flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-medium tracking-tight transition-all duration-500 ease-spring cursor-pointer",
 currentStep === 0
 ? "pointer-events-none opacity-0"
 : "text-muted-text hover:bg-black/[0.04] hover:text-main-text disabled:opacity-40 dark:hover:bg-white/[0.07]"
 )}
 >
 <CaretLeft size={12} weight="light" />
 Back
 </button>

 <button
 type="button"
 onClick={onNext}
 disabled={busy}
 className={cn(
 "group flex items-center gap-1.5 rounded-full py-2.5 pl-5 pr-2 text-[13px] font-medium tracking-tight transition-all duration-500 ease-spring cursor-pointer",
 busy
 ? "bg-primary text-primary-foreground opacity-50"
 : "bg-primary text-primary-foreground hover:opacity-90"
 )}
 >
 {isCompleting ? (
 <Spinner size={13} className="animate-spin" />
 ) : (
 <>
 {currentStep === totalSteps - 1 ? "Initialize" : "Continue"}
 <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.08] transition-transform duration-500 ease-spring group-hover:translate-x-0.5 dark:bg-white/15">
 <CaretRight size={12} weight="light" />
 </span>
 </>
 )}
 </button>
 </div>
 );
}
