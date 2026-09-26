"use client";

import { m } from "motion/react";

interface WizardProgressProps {
 steps: { id: string }[];
 currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
 return (
 <div className="flex gap-1.5">
 {steps.map((step, idx) => (
 <div key={step.id} className="relative h-1 flex-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/[0.09]">
  {idx <= currentStep && (
  <m.div
  initial={false}
  animate={{ scaleX: 1 }}
  transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
  className="absolute inset-0 origin-left rounded-full bg-primary"
  />
  )}
 </div>
 ))}
 </div>
 );
}
