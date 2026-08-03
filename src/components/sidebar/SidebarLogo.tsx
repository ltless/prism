"use client";

import Link from "next/link";
import { cn } from "@/core/utils/cn";
interface SidebarLogoProps {
  isExpanded: boolean;
}
export function SidebarLogo({ isExpanded }: SidebarLogoProps) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "flex items-center cursor-pointer group/logo w-full text-left shrink-0",
        isExpanded ? "gap-2.5 px-4 py-4" : "justify-center px-0 py-4"
      )}
      title={!isExpanded ? "Prism" : undefined}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <div className={cn(
          "border border-main-text/60 rotate-45 flex items-center justify-center transition-[color,transform] duration-300 ease-out-expo group-hover/logo:border-primary group-hover/logo:rotate-[135deg]",
          isExpanded ? "w-4 h-4" : "w-3.5 h-3.5"
        )}>
          <div className={cn(
            "bg-main-text/60 group-hover/logo:bg-primary transition-colors duration-300 ease-out-expo",
            isExpanded ? "w-1 h-1" : "w-0.5 h-0.5"
          )} />
        </div>
      </div>
      <span className={cn(
        "text-main-text font-semibold tracking-[0.2em] text-[10px] uppercase transition-colors duration-200 whitespace-nowrap",
        isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden",
        "group-hover/logo:text-primary"
      )}>
        Prism
      </span>
    </Link>
  );
}
