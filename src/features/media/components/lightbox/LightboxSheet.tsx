"use client";

import type { ElementType, ReactNode } from "react";
import { cn } from "@/core/utils/cn";

/** Nested tray used only inside the dark lightbox details sheet. */
export function LightboxSheet({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: ElementType;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-[1.15rem] bg-white/[0.04] p-1 ring-1 ring-white/10", className)}>
      <div className="overflow-hidden rounded-[calc(1.15rem-0.25rem)] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/8 ring-1 ring-white/10">
            <Icon size={11} weight="light" className="text-white/70" />
          </span>
          <h4 className="text-[10px] font-medium uppercase tracking-[0.16em] text-white/55">{title}</h4>
        </div>
        <div className="px-3 pb-3">{children}</div>
      </div>
    </section>
  );
}

export function SheetField({ label, value }: { label: string; value: ReactNode }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[10px] font-medium text-white/38">{label}</span>
      <span className="break-all font-mono text-[12px] tracking-[-0.01em] text-white/88">
        {empty ? <span className="text-white/28">n/a</span> : value}
      </span>
    </div>
  );
}
