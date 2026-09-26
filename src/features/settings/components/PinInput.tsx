import { m } from "motion/react";
import { cn } from "@/core/utils/cn";

interface PinInputProps {
 value: string;
 onChange: (value: string) => void;
 maxLength?: number;
 label?: string;
 error?: string;
}

const keyCls =
  "h-11 w-11 rounded-2xl bg-surface-bg text-[13px] font-medium text-main-text ring-1 ring-black/[0.06] transition-all duration-500 ease-spring hover:bg-black/[0.06] hover:text-main-text cursor-pointer select-none dark:bg-white/[0.05] dark:ring-white/[0.08] dark:hover:bg-white/[0.1]";

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
 <m.div
 key={idx}
 initial={false}
 animate={digits[idx] ? { scale: 1.15 } : { scale: 1 }}
 transition={{ type: "spring", stiffness: 500, damping: 24 }}
 className={cn(
 "h-2 w-2 rounded-full transition-colors duration-200",
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
 className={keyCls}
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
 	className={cn(keyCls, "text-muted-text hover:text-main-text disabled:cursor-not-allowed disabled:opacity-30")}
 >
 	⌫
 </button>

 {/* 0 */}
 <button
 type="button"
 onClick={() => handleDigit("0")}
 className={keyCls}
 >
 0
 </button>

 {/* Clear */}
 <button
 	type="button"
 	onClick={handleClear}
 	disabled={value.length === 0}
 	aria-label="Clear"
 	className={cn(keyCls, "text-muted-text hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-30")}
 >
 	✕
 </button>
 </div>
 </div>
 );
}