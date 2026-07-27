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
          ? "gap-2.5 px-2.5 py-1.5 rounded"
          : "justify-center w-8 h-8 mx-auto rounded",
        "transition-colors duration-150",
        isActive
          ? "bg-primary/8 text-main-text"
          : "bg-transparent text-muted-text hover:bg-surface-bg hover:text-main-text"
      )}
    >
      <div className={cn(
        "flex items-center justify-center shrink-0 transition-colors duration-150",
        isExpanded ? "w-5 h-5" : "w-4 h-4",
        isActive ? "text-primary" : "text-muted-text group-hover:text-main-text"
      )}>
        <Icon size={isExpanded ? 14 : 15} weight={isActive ? "fill" : "light"} />
      </div>
      <span className={cn(
        "text-[11px] font-medium transition-colors duration-150 truncate whitespace-nowrap",
        isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden",
        isActive ? "text-main-text" : "text-muted-text group-hover:text-main-text"
      )}>
        {item.name}
      </span>
    </Link>
  );
}
