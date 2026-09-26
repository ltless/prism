"use client";

import type { ReactNode } from "react";

/** Outer tray + inner plate. Radius concentric so the gap stays even. */
export function SettingsGroup({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      {(title || description) && (
        <div className="px-1">
          {title && (
            <h3 className="text-[15px] font-medium tracking-tight text-main-text text-balance">{title}</h3>
          )}
          {description && (
            <p className="mt-1 max-w-[62ch] text-[13px] leading-relaxed text-muted-text">{description}</p>
          )}
        </div>
      )}
      <div className="rounded-[1.75rem] bg-black/[0.03] p-1.5 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
        <div className="overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-panel-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
          {children}
        </div>
      </div>
    </section>
  );
}
