"use client";

import { User, Shield, HardDrive, Info } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

const iconMap = { User, Shield, HardDrive, Info };

interface MobileTabBarProps {
  tabs: { id: string; label: string; icon: keyof typeof iconMap }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileTabBar({ tabs, activeTab, onTabChange }: MobileTabBarProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 px-3 pb-3 pt-1 md:hidden"
      aria-label="Settings sections"
    >
      <div className="flex w-full items-center gap-1 rounded-full bg-black/[0.04] p-1 ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
        {tabs.map((tab) => {
          const Icon = iconMap[tab.icon];
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[10px] tracking-wide cursor-pointer transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
                active ? "bg-main-text text-app-bg" : "text-muted-text",
              )}
            >
              <Icon size={15} weight="light" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
