"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { m } from "motion/react";
import { cn } from "@/core/utils/cn";

interface SidebarNavItemProps {
  item: {
    name: string;
    icon: React.ElementType;
    path: string;
  };
  isExpanded: boolean;
}

export function SidebarNavItem({ item, isExpanded }: SidebarNavItemProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("v");
  const activeFolderId = searchParams.get("f");
  const itemPathBase = item.path.split("?")[0];
  const itemView = item.path.split("v=")[1];

  const isActive = itemView
    ? pathname === itemPathBase && viewParam === itemView
    : pathname === item.path && !activeFolderId && !viewParam;

  const Icon = item.icon;

  return (
    <Link
      href={item.path}
      title={!isExpanded ? item.name : undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-11 shrink-0 items-center overflow-hidden rounded-full",
        isActive ? "text-main-text" : "text-muted-text hover:text-main-text",
      )}
    >
      <span
        className={cn(
          "absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full",
          isActive ? "text-app-bg" : "text-muted-text group-hover/nav:bg-main-text/6 group-hover/nav:text-main-text",
        )}
        style={{ transition: "color 400ms cubic-bezier(0.32,0.72,0,1)" }}
      >
        {isActive && (
          <m.span
            layoutId="sidebar-nav-disc"
            transition={{ type: "spring", stiffness: 480, damping: 34 }}
            className="absolute inset-0 rounded-full bg-main-text shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
          />
        )}
        <Icon size={15} weight={isActive ? "fill" : "light"} className="relative" />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 overflow-hidden whitespace-nowrap pl-10 pr-3 text-[13px] tracking-[-0.01em]",
          isActive ? "font-medium text-main-text" : "font-normal text-main-text/75",
          isExpanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-1 opacity-0",
        )}
        style={{
          transition: `opacity 140ms cubic-bezier(0.32,0.72,0,1) ${isExpanded ? "500ms" : "0ms"}, transform 140ms cubic-bezier(0.32,0.72,0,1) ${isExpanded ? "500ms" : "0ms"}`,
        }}
      >
        {item.name}
      </span>
    </Link>
  );
}
