"use client";

import { User, Shield, HardDrive, Info, SignOut } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { useAuth } from "@/lib/auth/AuthContext";

const iconMap = {
 User,
 Shield,
 HardDrive,
 Info,
};

interface SettingsSidebarProps {
 tabs: { id: string; label: string; description: string; icon: keyof typeof iconMap }[];
 activeTab: string;
 onTabChange: (tab: string) => void;
}

export function SettingsSidebar({ tabs, activeTab, onTabChange }: SettingsSidebarProps) {
  const { logout, user } = useAuth();
  return (
  <div className="hidden md:flex w-60 border-r border-main-border/50 bg-surface-bg/70 p-4 flex-col gap-6">
  <div className="px-2 pt-1">
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-text">Workspace</p>
    <div className="mt-3 flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
        {user?.username?.[0]?.toUpperCase() || "P"}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-main-text">{user?.username || "Prism User"}</p>
        <p className="text-[10px] text-muted-text">Personal settings</p>
      </div>
    </div>
  </div>

  <nav aria-label="Settings sections" className="flex flex-col gap-1">
  {tabs.map((tab) => {
 const Icon = iconMap[tab.icon];
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => onTabChange(tab.id)}
  className={cn(
  "flex items-start gap-3 px-2.5 py-2.5 rounded-lg text-left transition-colors duration-150 cursor-pointer",
  activeTab === tab.id
  ? "bg-panel-bg text-main-text shadow-card"
  : "text-muted-text hover:text-main-text hover:bg-panel-bg/50"
 )}
 >
 <Icon size={15} weight={activeTab === tab.id ? "fill" : "light"} className={cn(
 activeTab === tab.id ? "text-primary" : "text-muted-text"
 )} />
  <span className="min-w-0">
    <span className="block text-[12px] font-medium">{tab.label}</span>
    <span className="mt-0.5 block truncate text-[10px] text-muted-text">{tab.description}</span>
  </span>
 </button>
 );
 })}
 </nav>

  <div className="mt-auto border-t border-main-border/40 pt-3">
 <button
 type="button"
 onClick={() => logout()}
 className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-rose-500 hover:bg-rose-500/5 transition-colors duration-150 cursor-pointer"
 >
 <SignOut size={15} weight="light" />
 <span className="text-[12px] font-medium">Sign Out</span>
 </button>
 </div>
 </div>
 );
}
