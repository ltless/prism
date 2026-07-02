"use client";

import { Check, Palette } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { SectionCard } from "@/shared/components/SectionCard";
import { useTheme } from "@/components/ThemeProvider";

function ThemeOption({
  mode, label, active, previewBg, sidebar, sidebarBar, rowBg, rowDot, cellClass,
  setTheme,
}: {
  mode: "dark" | "light";
  label: string;
  active: boolean;
  previewBg: string;
  sidebar: string;
  sidebarBar: string;
  rowBg: string;
  rowDot: string;
  cellClass: string;
  setTheme: (t: "dark" | "light") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setTheme(mode)}
      aria-pressed={active}
      className={cn(
        "p-3 rounded-xl border relative overflow-hidden group cursor-pointer transition-[border-color,background-color,transform] duration-300 text-left",
        active
          ? "border-primary bg-primary/[0.02] shadow-sm scale-[1.01]"
          : "border-main-border/50 bg-app-bg/30 hover:border-main-border/80 hover:bg-app-bg/50"
      )}
    >
      {/* UI Mockup preview */}
      <div className={cn("w-full h-16 border rounded-lg mb-3 flex p-1.5 gap-1.5 overflow-hidden shadow-sm", previewBg)}>
        <div className={cn("w-7 h-full rounded-md flex flex-col gap-1 p-1", sidebar)}>
          <div className={cn("h-1 w-full rounded-full", sidebarBar)} />
          <div className={cn("h-1 w-4 rounded-full", sidebarBar)} />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div className={cn("h-2 w-full rounded-md flex items-center px-1", rowBg)}>
            <div className="w-1.5 h-1 bg-primary rounded-full" />
          </div>
          <div className="grid grid-cols-3 gap-1 flex-1">
            <div className={cn("rounded-md border flex items-center justify-center", cellClass)}>
              <div className={cn("w-2.5 h-2.5 bg-primary/20 rounded-full", rowDot)} />
            </div>
            <div className={cn("rounded-md border", cellClass)} />
            <div className={cn("rounded-md border", cellClass)} />
          </div>
        </div>
      </div>
      <p className={cn(
        "text-[11px] text-center font-medium transition-colors",
        active ? "text-main-text font-semibold" : "text-muted-text group-hover:text-main-text"
      )}>{label}</p>
      {active && (
        <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-sm">
          <Check size={10} weight="bold" />
        </div>
      )}
    </button>
  );
}

export function ThemeSelectorCard() {
  const { theme, setTheme } = useTheme();

  return (
    <SectionCard icon={Palette} title="Display Theme" bodyClassName="flex flex-col gap-4">
      <p className="text-[11px] text-muted-text">Select how you want the Prism interface to look on your device.</p>
      <div className="grid grid-cols-2 gap-4">
        <ThemeOption
          mode="dark"
          label="Dark Mode"
          active={theme === "dark"}
          previewBg="bg-[#0E0E0D] border-white/5"
          sidebar="bg-[#181816]"
          sidebarBar="bg-[#2B2B28]"
          rowBg="bg-[#181816]"
          rowDot=""
          cellClass="bg-[#181816] border-white/5"
          setTheme={setTheme}
        />
        <ThemeOption
          mode="light"
          label="Light Mode"
          active={theme === "light"}
          previewBg="bg-[#F9F8F6] border-black/5"
          sidebar="bg-[#EDEDE9]"
          sidebarBar="bg-[#D6D6D0]"
          rowBg="bg-[#EDEDE9]"
          rowDot=""
          cellClass="bg-white border-black/5"
          setTheme={setTheme}
        />
      </div>
    </SectionCard>
  );
}