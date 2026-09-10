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
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "group/nav relative flex items-center h-8 mx-2 gap-2.5 rounded-lg cursor-pointer",
        "transition-[padding,background-color,color] duration-300 ease-out-expo",
        isExpanded ? "pl-2 pr-2.5" : "pl-3.5 pr-0",
        isActive
          ? "bg-surface-bg text-main-text"
          : "bg-transparent text-muted-text hover:bg-surface-bg/50 hover:text-main-text"
      )}
    >
      {isActive && (
        <m.span
          layoutId="sidebar-active-indicator"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
          className="absolute left-0 top-1/2 -mt-2 w-[3px] h-4 rounded-full bg-main-text"
        />
      )}
      <span
        className={cn(
          "flex items-center justify-center w-5 h-5 shrink-0 transition-transform duration-200 ease-out-expo",
          "group-hover/nav:scale-110",
          isActive ? "text-main-text" : "text-muted-text group-hover/nav:text-main-text"
        )}
      >
        <Icon size={16} weight={isActive ? "fill" : "regular"} />
      </span>
      <span
        className="overflow-hidden whitespace-nowrap text-[12px] font-medium transition-[max-width,opacity] duration-300 ease-out-expo"
        style={{ maxWidth: isExpanded ? "12rem" : "0rem", opacity: isExpanded ? 1 : 0 }}
      >
        {item.name}
      </span>
    </Link>
  );
}
