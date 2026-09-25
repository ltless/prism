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
      <SettingsGroup title="Prism" description="A local photo library. Nothing leaves this machine.">
        <div className="grid grid-cols-1 sm:grid-cols-3">
          {facts.map(([label, value], i) => (
            <div
              key={label}
              className={`px-5 py-4 ${i > 0 ? "border-t border-main-border sm:border-t-0 sm:border-l" : ""}`}
            >
              <p className="text-[12px] text-muted-text">{label}</p>
              <p className="mt-1 text-[15px] font-medium tracking-tight text-main-text">{value}</p>
            </div>
          ))}
        </div>
      </SettingsGroup>
      <SettingsGroup title="Source">
        <a
          href="https://github.com/ltless/prism"
          target="_blank"
          rel="noreferrer"
          className="group flex items-center justify-between px-5 py-4 text-[14px] text-main-text transition-colors duration-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
        >
          <span>
            GitHub
            <span className="mt-0.5 block text-[12px] text-muted-text">ltless/prism</span>
          </span>
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/[0.05] transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px dark:bg-white/10">
            <ArrowUpRight size={14} weight="light" />
          </span>
        </a>
      </SettingsGroup>
    </div>
  );
}
