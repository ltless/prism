"use client";

import { useSidebar } from "@/components/sidebar-context";
import { TopBar } from "@/components/TopBar";
import { cn } from "@/core/utils/cn";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from "@/components/sidebar/constants";

export function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <main
      id="main-content"
      style={{ "--sidebar-w": `${isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px` } as React.CSSProperties}
      className={cn(
        "flex-1 flex flex-col min-h-0 relative h-full pt-0 pr-0 pb-0 pl-0 md:pt-0 transition-[padding] duration-300 ease-out-expo",
        "md:pl-[var(--sidebar-w)]"
      )}
    >
      <TopBar />
      <div className="flex-1 flex flex-col relative overflow-y-auto custom-scroll">
        {children}
      </div>
    </main>
  );
}
