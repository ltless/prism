"use client";

import { m } from "motion/react";
import { User, Shield, HardDrive, Info } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

const iconMap = { User, Shield, HardDrive, Info };

interface SettingsTabsProps {
  tabs: { id: string; label: string; icon: keyof typeof iconMap }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function SettingsTabs({ tabs, activeTab, onTabChange }: SettingsTabsProps) {
  const reducedMotion = useReducedMotion();
  return (
    <div className="shrink-0 px-5 pb-1 md:px-8" aria-label="Settings sections">
      <div className="flex items-center gap-1 rounded-full bg-black/[0.04] p-1 ring-1 ring-black/5 dark:bg-white/[0.05] dark:ring-white/10">
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
                "relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-medium tracking-tight cursor-pointer transition-colors duration-500 ease-spring",
                active ? "text-app-bg" : "text-muted-text hover:text-main-text",
              )}
            >
              {active && (
                <m.span
                  layoutId="settings-seg-pill"
                  transition={reducedMotion ? { duration: 0 } : { duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
                  className="absolute inset-0 rounded-full bg-main-text shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                />
              )}
              <Icon size={14} weight="light" className="relative z-10" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}