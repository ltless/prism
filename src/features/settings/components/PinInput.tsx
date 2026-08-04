"use client";

import { cn } from "@/core/utils/cn";

interface PinInputProps {
 value: string;
 onChange: (value: string) => void;
 maxLength?: number;
 label?: string;
 error?: string;
}

export function PinInput({ value, onChange, maxLength = 6, label, error }: PinInputProps) {
 const digits = value.split("");

 const handleDigit = (d: string) => {
 if (value.length >= maxLength) return;
 onChange(value + d);
 };

 const handleBackspace = () => {
 onChange(value.slice(0, -1));
 };

 const handleClear = () => {
 onChange("");
 };

 return (
 <div className="flex flex-col items-center gap-6">
 {label && (
 <p className="text-[11px] text-muted-text text-center">{label}</p>
 )}

 {/* Dot display */}
 <div className="flex gap-3">
 {Array.from({ length: maxLength }).map((_, idx) => (
 <div
 key={idx}
 className={cn(
 "w-2.5 h-2.5 rounded-full transition-colors duration-150",
 digits[idx]
 ? "bg-primary"
 : "bg-main-border/40"
 )}
 />
 ))}
 </div>

 {error && (
 <p className="text-[11px] text-rose-500 -mt-4">{error}</p>
 )}

 {/* Numpad */}
 <div className="grid grid-cols-3 gap-2 w-fit">
 {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
 <button
 key={d}
 type="button"
 onClick={() => handleDigit(d)}
 className="w-12 h-12 bg-surface-bg border border-main-border/50 rounded-lg text-[13px] font-medium text-main-text hover:bg-surface-bg/80 hover:border-main-border transition-colors cursor-pointer select-none"
 >
 {d}
 </button>
 ))}

 {/* Backspace */}
 <button
 	type="button"
 	onClick={handleBackspace}
 	disabled={value.length === 0}
 	aria-label="Backspace"
 	className="w-12 h-12 bg-surface-bg border border-main-border/50 rounded-lg text-[13px] font-medium text-muted-text hover:bg-surface-bg/80 hover:border-main-border disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer select-none"
 >
 ⌫
 </button>

 {/* 0 */}
 <button
 type="button"
 onClick={() => handleDigit("0")}
 className="w-12 h-12 bg-surface-bg border border-main-border/50 rounded-lg text-[13px] font-medium text-main-text hover:bg-surface-bg/80 hover:border-main-border transition-colors cursor-pointer select-none"
 >
 0
 </button>

 {/* Clear */}
 <button
 	type="button"
 	onClick={handleClear}
 	disabled={value.length === 0}
 	aria-label="Clear"
 	className="w-12 h-12 bg-surface-bg border border-main-border/50 rounded-lg text-[13px] font-medium text-muted-text hover:bg-rose-500/5 hover:border-rose-500/20 hover:text-rose-500 disabled:opacity-20 disabled:cursor-not-allowed transition-colors cursor-pointer select-none"
 >
 ✕
 </button>
 </div>
 </div>
 );
}
