"use client";

import { User, Sparkle, Shield, HardDrive, Info, SignOut } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { useAuth } from "@/lib/auth/AuthContext";

const iconMap = {
 User,
 Sparkle,
 Shield,
 HardDrive,
 Info,
};

interface SettingsSidebarProps {
 tabs: { id: string; label: string; icon: keyof typeof iconMap }[];
 activeTab: string;
 onTabChange: (tab: string) => void;
}

export function SettingsSidebar({ tabs, activeTab, onTabChange }: SettingsSidebarProps) {
 const { logout } = useAuth();
 return (
 <div className="hidden md:flex w-52 border-r border-main-border/50 bg-surface-bg p-4 flex-col gap-6">
 <p className="text-[11px] font-medium text-muted-text px-2">Settings</p>
 
 <nav className="flex flex-col gap-0.5">
 {tabs.map((tab) => {
 const Icon = iconMap[tab.icon];
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => onTabChange(tab.id)}
 className={cn(
 "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors duration-150 cursor-pointer",
 activeTab === tab.id
 ? "bg-panel-bg text-main-text"
 : "text-muted-text hover:text-main-text hover:bg-panel-bg/50"
 )}
 >
 <Icon size={15} weight={activeTab === tab.id ? "fill" : "light"} className={cn(
 activeTab === tab.id ? "text-primary" : "text-muted-text"
 )} />
 <span className="text-[12px] font-medium">{tab.label}</span>
 </button>
 );
 })}
 </nav>

 <div className="mt-auto">
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
