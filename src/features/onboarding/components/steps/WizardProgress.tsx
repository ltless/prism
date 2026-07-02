"use client";

import { m } from "motion/react";

interface WizardProgressProps {
 steps: { id: string }[];
 currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
 return (
 <div className="flex gap-1">
 {steps.map((step, idx) => (
 <div key={step.id} className="flex-1 h-1 rounded-full bg-main-border/30 overflow-hidden relative">
  {idx <= currentStep && (
  <m.div
  initial={false}
  animate={{ scaleX: 1 }}
  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
  className="absolute inset-0 bg-primary rounded-full origin-left"
  />
  )}
 </div>
 ))}
 </div>
 );
}
