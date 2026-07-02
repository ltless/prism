import { forwardRef } from "react";

export const SelectionBox = forwardRef<HTMLDivElement>((_, ref) => {
 return (
 <div
 ref={ref}
 style={{ display: "none" }}
 className="absolute border border-primary/50 bg-primary/5 [box-shadow:0_0_20px_rgba(var(--accent-rgb),0.1)] rounded-sm z-[100] pointer-events-none transition-[border-color,background-color] duration-200"
 >
 {/* Decorative corners or patterns if needed */}
 <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,var(--primary)_0%,transparent_70%)]" />
 </div>
 );
});

SelectionBox.displayName = "SelectionBox";
