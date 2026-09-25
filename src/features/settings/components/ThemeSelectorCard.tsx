"use client";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { SettingsGroup } from "./SettingsGroup";
import { useTheme } from "@/components/ThemeProvider";

function ThemeOption({
  mode, label, active, previewBg, sidebar, sidebarBar, rowBg, cellClass, setTheme,
}: {
  mode: "dark" | "light";
  label: string;
  active: boolean;
  previewBg: string;
  sidebar: string;
  sidebarBar: string;
  rowBg: string;
  cellClass: string;
  setTheme: (t: "dark" | "light") => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setTheme(mode)}
      aria-pressed={active}
      className={cn(
        "relative w-full overflow-hidden rounded-2xl p-2 text-left cursor-pointer ring-1 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.98]",
        active ? "ring-primary" : "ring-black/10 hover:ring-black/20 dark:ring-white/10 dark:hover:ring-white/20",
      )}
    >
      <div className={cn("flex h-16 gap-1.5 overflow-hidden rounded-xl p-1.5", previewBg)}>
        <div className={cn("flex w-8 flex-col gap-1 rounded-md p-1", sidebar)}>
          <div className={cn("h-1 w-full rounded-full", sidebarBar)} />
          <div className={cn("h-1 w-4 rounded-full", sidebarBar)} />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <div className={cn("flex h-2 w-full items-center rounded-md px-1", rowBg)}>
            <div className="h-1 w-1.5 rounded-full bg-primary" />
          </div>
          <div className="grid flex-1 grid-cols-3 gap-1">
            <div className={cn("rounded-md", cellClass)} />
            <div className={cn("rounded-md", cellClass)} />
            <div className={cn("rounded-md", cellClass)} />
          </div>
        </div>
      </div>
      <span className="mt-2 flex items-center justify-between px-1 pb-0.5">
        <span className={cn("text-[13px]", active ? "font-medium text-main-text" : "text-muted-text")}>{label}</span>
        {active && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check size={9} weight="bold" />
          </span>
        )}
      </span>
    </button>
  );
}

export function ThemeSelectorCard() {
  const { theme, setTheme } = useTheme();

  return (
    <SettingsGroup title="Appearance" description="Applies immediately on this device.">
      <div className="flex flex-col gap-2 p-3">
        <ThemeOption
          mode="dark"
          label="Dark"
          active={theme === "dark"}
          previewBg="bg-[#0E0E0D]"
          sidebar="bg-[#181816]"
          sidebarBar="bg-[#2B2B28]"
          rowBg="bg-[#181816]"
          cellClass="bg-[#181816]"
          setTheme={setTheme}
        />
        <ThemeOption
          mode="light"
          label="Light"
          active={theme === "light"}
          previewBg="bg-[#F4F4F5]"
          sidebar="bg-[#E4E4E7]"
          sidebarBar="bg-[#D4D4D8]"
          rowBg="bg-[#E4E4E7]"
          cellClass="bg-white"
          setTheme={setTheme}
        />
      </div>
    </SettingsGroup>
  );
}
