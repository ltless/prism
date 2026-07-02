"use client";

import { Info, GithubLogo, Globe } from "@phosphor-icons/react";
import { SectionCard } from "@/shared/components/SectionCard";

export function AboutTab() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[480px] text-center animate-in fade-in slide-in-from-bottom-4 duration-500 py-8 px-4">
      {/* Glowing CSS Glass Prism Logo */}
      <div className="relative w-40 h-32 flex items-center justify-center mb-6">
        {/* Glow backdrop */}
        <div className="absolute w-24 h-24 bg-primary/10 rounded-full blur-2xl" />

        {/* CSS Prism illustration */}
        <div className="relative flex items-center justify-center scale-110">
          {/* Incoming white light ray */}
          <div className="absolute right-8 w-16 h-[2px] bg-gradient-to-r from-transparent via-main-text/20 to-main-text/75 dark:to-white/90 transform -rotate-[15deg] origin-right translate-x-[-12px]" />

          {/* Glass Prism triangle */}
          <div className="w-0 h-0 border-l-[32px] border-l-transparent border-r-[32px] border-r-transparent border-b-[56px] border-b-primary/20 relative flex items-center justify-center filter drop-shadow-[0_0_12px_rgba(var(--accent-rgb),0.25)]">
            <div className="w-0 h-0 border-l-[29px] border-l-transparent border-r-[29px] border-r-transparent border-b-[51px] border-b-panel-bg absolute top-[2.5px] left-[-29px] flex items-center justify-center" />
          </div>

          {/* Outgoing Refracted Rainbow rays */}
          <div className="absolute left-8 w-20 h-[8px] prism-gradient blur-[0.5px] transform rotate-[10deg] origin-left translate-x-[12px] opacity-90 rounded-full" />
        </div>
      </div>

      {/* Info details */}
      <h3 className="text-sm font-bold text-main-text mb-0.5 tracking-tight">Prism Vault</h3>
      <p className="text-xs text-muted-text font-medium uppercase tracking-wider mb-6">Self-Hosted Photography Manager</p>

      {/* Spec details card */}
      <SectionCard icon={Info} title="System Specifications" className="w-full max-w-sm mb-6" bodyClassName="flex flex-col gap-2.5 text-[11px]">
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-text">Software Version</span>
            <span className="text-main-text font-semibold bg-primary/5 px-2 py-0.5 rounded border border-primary/10">0.1.0 (Beta)</span>
          </div>
          <div className="h-px bg-main-border/30" />
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-text">App Framework</span>
            <span className="text-main-text font-semibold">Next.js 16 (React 19)</span>
          </div>
          <div className="h-px bg-main-border/30" />
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-text">Data Architecture</span>
            <span className="text-main-text font-semibold">SQLite + Drizzle ORM</span>
          </div>
          <div className="h-px bg-main-border/30" />
          <div className="flex justify-between items-center py-0.5">
            <span className="text-muted-text">Developer Profile</span>
            <span className="text-primary hover:underline cursor-pointer font-bold">@ltless</span>
          </div>
      </SectionCard>

      {/* Social / Info Links */}
      <div className="flex gap-4 text-[11px] text-muted-text font-medium">
        <a href="https://github.com/ltless/prism" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-main-text transition-colors">
          <GithubLogo size={14} />
          GitHub Repository
        </a>
        <span className="text-main-border">•</span>
        <a href="https://prism.me" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-main-text transition-colors">
          <Globe size={14} />
          Documentation
        </a>
      </div>
    </div>
  );
}
