"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
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
 return (
 <div className="px-8 py-5 border-t border-main-border/30 flex items-center justify-between">
 <button
 onClick={onBack}
 disabled={currentStep === 0 || isCompleting}
 className={cn(
 "flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-medium transition-colors",
 currentStep === 0
 ? "opacity-0 pointer-events-none"
 : "text-muted-text hover:text-main-text hover:bg-surface-bg"
 )}
 >
 <CaretLeft size={12} weight="light" />
 Back
 </button>

 <button
 onClick={onNext}
 disabled={isCompleting || isUploading !== null}
 className={cn(
 "flex items-center gap-1.5 px-5 py-2 rounded-lg text-[11px] font-medium transition-colors",
 (isCompleting || isUploading !== null) ? "opacity-50 cursor-not-allowed" : "",
 "bg-primary text-primary-foreground hover:opacity-90"
 )}
 >
 {isCompleting ? (
 <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
 ) : (
 <>
 {currentStep === totalSteps - 1 ? "Initialize" : "Continue"}
 <CaretRight size={12} weight="light" />
 </>
 )}
 </button>
 </div>
 );
}
