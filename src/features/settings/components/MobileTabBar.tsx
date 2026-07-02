"use client";

import { User, Sparkle, Shield, HardDrive, Info } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

const iconMap = {
 User,
 Sparkle,
 Shield,
 HardDrive,
 Info,
};

interface MobileTabBarProps {
 tabs: { id: string; label: string; icon: keyof typeof iconMap }[];
 activeTab: string;
 onTabChange: (tab: string) => void;
}

export function MobileTabBar({ tabs, activeTab, onTabChange }: MobileTabBarProps) {
 return (
 <div className="md:hidden flex items-center justify-around px-2 py-2 border-t border-main-border/50 bg-surface-bg shrink-0">
 {tabs.map((tab) => {
 const Icon = iconMap[tab.icon];
 return (
 <button
 key={tab.id}
 type="button"
 onClick={() => onTabChange(tab.id)}
 className={cn(
 "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors duration-150 cursor-pointer",
 activeTab === tab.id
 ? "text-primary"
 : "text-muted-text hover:text-main-text"
 )}
 >
 <Icon size={16} weight={activeTab === tab.id ? "fill" : "light"} />
 <span className="text-[11px] font-medium">{tab.label === "AI & Intelligence" ? "AI" : tab.label}</span>
 </button>
 );
 })}
 </div>
 );
}
