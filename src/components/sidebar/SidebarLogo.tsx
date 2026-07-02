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
 isExpanded ? "gap-3 px-4 py-5" : "justify-center px-0 py-5"
 )}
 title={!isExpanded ? "Prism" : undefined}
 >
 <div className="relative flex items-center justify-center shrink-0">
 <div className={cn(
 "border border-main-text/80 rotate-45 flex items-center justify-center transition-all duration-500 ease-out-expo group-hover/logo:border-primary group-hover/logo:rotate-[135deg]",
 isExpanded ? "w-5 h-5" : "w-4 h-4"
 )}>
 <div className={cn(
 "bg-main-text/80 group-hover/logo:bg-primary transition-all duration-500 ease-out-expo",
 isExpanded ? "w-1.5 h-1.5" : "w-1 h-1"
 )} />
 </div>
 </div>
 <span className={cn(
 "text-main-text font-semibold tracking-[0.25em] text-[11px] uppercase transition-colors duration-200 whitespace-nowrap",
 isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden",
 "group-hover/logo:text-primary"
 )}>
 Prism
 </span>
 </Link>
 );
}
