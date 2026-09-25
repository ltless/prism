"use client";

import { User, Shield, HardDrive, Info, SignOut, ArrowUpRight } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { useAuth } from "@/lib/auth/AuthContext";

const iconMap = { User, Shield, HardDrive, Info };

interface SettingsSidebarProps {
  tabs: { id: string; label: string; icon: keyof typeof iconMap }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ease = "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

export function SettingsSidebar({ tabs, activeTab, onTabChange }: SettingsSidebarProps) {
  const { logout } = useAuth();
  return (
    <div className="hidden md:flex w-56 shrink-0 flex-col px-4 py-6">
      <p className="px-3 pb-5 text-[13px] font-medium tracking-tight text-muted-text">Settings</p>
      <nav aria-label="Settings sections" className="flex flex-col gap-1">
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
                "group flex items-center gap-3 rounded-full px-3 py-2.5 text-left text-[14px] cursor-pointer",
                ease,
                active
                  ? "bg-main-text text-app-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                  : "text-muted-text hover:bg-black/[0.04] hover:text-main-text dark:hover:bg-white/[0.06]",
              )}
            >
              <Icon size={16} weight="light" />
              <span className="tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={() => logout()}
        className={cn(
          "group mt-auto flex items-center justify-between rounded-full px-3 py-2.5 text-[14px] text-muted-text cursor-pointer",
          ease,
          "hover:bg-rose-500/10 hover:text-rose-500",
        )}
      >
        <span className="flex items-center gap-3">
          <SignOut size={16} weight="light" />
          Sign out
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.05] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px group-hover:scale-105 dark:bg-white/10">
          <ArrowUpRight size={12} weight="light" />
        </span>
      </button>
    </div>
  );
}
