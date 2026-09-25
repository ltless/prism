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
 <div className="flex flex-col items-center gap-5">
 {label && (
 <p className="text-[12px] text-muted-text text-center">{label}</p>
 )}

 <div className="flex gap-2.5" aria-hidden="true">
 {Array.from({ length: maxLength }).map((_, idx) => (
 <div
 key={idx}
 className={cn(
 "h-2 w-2 rounded-full transition-colors duration-150",
 digits[idx] ? "bg-primary" : "bg-main-border"
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
 className="h-11 w-11 rounded-lg border border-main-border bg-surface-bg text-[13px] text-main-text transition-colors hover:border-border-medium cursor-pointer select-none"
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
 	className="h-11 w-11 rounded-lg border border-main-border bg-surface-bg text-[13px] text-muted-text transition-colors hover:border-border-medium disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer select-none"
 >
 ⌫
 </button>

 {/* 0 */}
 <button
 type="button"
 onClick={() => handleDigit("0")}
 className="h-11 w-11 rounded-lg border border-main-border bg-surface-bg text-[13px] text-main-text transition-colors hover:border-border-medium cursor-pointer select-none"
 >
 0
 </button>

 {/* Clear */}
 <button
 	type="button"
 	onClick={handleClear}
 	disabled={value.length === 0}
 	aria-label="Clear"
 	className="h-11 w-11 rounded-lg border border-main-border bg-surface-bg text-[13px] text-muted-text transition-colors hover:border-rose-500/30 hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer select-none"
 >
 ✕
 </button>
 </div>
 </div>
 );
}
