"use client";

import { cn } from "@/core/utils/cn";

interface ToggleProps {
 checked: boolean;
 onChange: () => void;
 size?: "sm" | "md";
 color?: string;
 disabled?: boolean;
}

export function Toggle({ checked, onChange, size = "md", color = "primary", disabled }: ToggleProps) {
 const knobSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
 const trackSize = size === "sm" ? "h-4 w-7" : "h-5 w-9";
 const activeBg = `${color === "rose" ? "bg-rose-500/20 border-rose-500/30" : color === "amber" ? "bg-amber-500/20 border-amber-500/30" : color === "emerald" ? "bg-emerald-500/20 border-emerald-500/30" : "bg-primary/20 border-primary/30"}`;
 const activeKnob = `${color === "rose" ? "bg-rose-500" : color === "amber" ? "bg-amber-500" : color === "emerald" ? "bg-emerald-500" : "bg-primary"}`;

 return (
 <button
 type="button"
 role="switch"
 aria-checked={checked}
 onClick={onChange}
 disabled={disabled}
 className={cn(
 `${trackSize} rounded-full border p-1 flex items-center transition-all duration-300 cursor-pointer shrink-0`,
 checked ? `${activeBg} justify-end` : "bg-main-border/20 border-main-border/30 justify-start",
 disabled && "opacity-50 cursor-not-allowed"
 )}
 >
 <div className={cn(`${knobSize} rounded-full shadow-sm transition-all duration-300`, checked ? activeKnob : "bg-muted-text")} />
 </button>
 );
}
