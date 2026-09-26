"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import { SettingsGroup } from "./SettingsGroup";

const facts = [
  ["Version", "0.1.0"],
  ["App", "Next.js 16"],
  ["Server", "Go + PostgreSQL"],
];

export function AboutTab() {
  return (
    <div className="flex flex-col gap-6">
      <SettingsGroup>
        <div className="px-5 pb-6 pt-6">
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-text">Prism</p>
          <p className="mt-2 text-[22px] font-medium tracking-tight text-main-text">A local photo library.</p>
          <p className="mt-1 max-w-[38ch] text-[13px] leading-relaxed text-muted-text">
            Nothing leaves this machine. Files are encrypted at rest on your own device.
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-black/[0.06] border-t border-black/[0.06] dark:divide-white/[0.08] dark:border-white/[0.08]">
          {facts.map(([label, value]) => (
            <div key={label} className="flex flex-col gap-1 px-5 py-4">
              <p className="text-[11px] text-muted-text">{label}</p>
              <p className="text-[14px] font-medium tracking-tight text-main-text tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      </SettingsGroup>
      <SettingsGroup>
        <a href="https://github.com/ltless/prism"
          target="_blank"
          rel="noreferrer"
          className="group flex items-center justify-between px-5 py-4 text-[14px] text-main-text transition-colors duration-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
          <span>
            <span className="flex items-center gap-2 font-medium">Source<ArrowUpRight size={12} weight="light" className="text-muted-text" /></span>
            <span className="mt-0.5 block text-[12px] text-muted-text">ltless/prism</span>
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] transition-transform duration-500 ease-spring group-hover:translate-x-0.5 group-hover:-translate-y-px dark:bg-white/10">
            <ArrowUpRight size={14} weight="light" />
          </span>
        </a>
      </SettingsGroup>
    </div>
  );
}
