"use client";

import { useSidebar } from "@/components/sidebar-context";
import { TopBar } from "@/components/TopBar";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_TRANSITION_MS, SIDEBAR_LABEL_MS } from "@/components/sidebar/constants";

export function MainContentWrapper({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <main
      id="main-content"
      style={{
        "--sidebar-w": `${isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px`,
        transition: `padding ${SIDEBAR_TRANSITION_MS}ms cubic-bezier(0.32, 0.72, 0, 1) ${SIDEBAR_LABEL_MS}ms`,
      } as React.CSSProperties}
      className="flex-1 flex flex-col min-h-0 relative h-full md:pl-[var(--sidebar-w)]"
    >
      <TopBar />
      <div className="flex-1 flex flex-col relative overflow-y-auto custom-scroll">
        {children}
      </div>
    </main>
  );
}
