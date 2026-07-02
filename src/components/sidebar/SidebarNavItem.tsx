"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/core/utils/cn";

interface SidebarNavItemProps {
 item: {
 name: string;
 icon: React.ElementType;
 path: string;
 };
 activeFolderId: string | null;
 isExpanded: boolean;
}

export function SidebarNavItem({ item, activeFolderId, isExpanded }: SidebarNavItemProps) {
 const pathname = usePathname();
 const searchParams = useSearchParams();
 const viewParam = searchParams.get('v');
 const itemPathBase = item.path.split('?')[0];
 const itemView = item.path.split('v=')[1];

 const isActive = itemView
 ? pathname === itemPathBase && viewParam === itemView
 : pathname === item.path && !activeFolderId && !viewParam;

 const Icon = item.icon;

 return (
 <Link
 href={item.path}
 title={!isExpanded ? item.name : undefined}
 className={cn(
 "flex items-center group cursor-pointer relative",
 isExpanded
 ? "gap-3 px-3 py-2 rounded-xl"
 : "justify-center w-10 h-10 mx-auto rounded-xl",
 "transition-[background-color,box-shadow] duration-200",
 isActive
 ? "bg-surface-bg text-main-text shadow-sm"
 : "bg-transparent text-muted-text hover:bg-surface-bg/50 hover:text-main-text"
 )}
 >
 <div className={cn(
 "flex items-center justify-center shrink-0 transition-colors duration-200",
 isExpanded ? "w-6 h-6" : "w-5 h-5",
 isActive ? "text-primary" : "text-muted-text group-hover:text-main-text"
 )}>
 <Icon size={isExpanded ? 14 : 16} weight={isActive ? "fill" : "light"} />
 </div>
 <span className={cn(
 "text-xs font-semibold transition-colors duration-200 truncate whitespace-nowrap",
 isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden",
 isActive ? "text-main-text" : "text-muted-text group-hover:text-main-text"
 )}>
 {item.name}
 </span>
 </Link>
 );
}
