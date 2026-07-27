"use client";

import type { ElementType, ReactNode } from "react";
import { cn } from "@/core/utils/cn";
export function SectionCard({
  icon: Icon,
  title,
  children,
  compact = false,
  bodyClassName,
  className,
}: {
  icon: ElementType;
  title: string;
  children: ReactNode;
  compact?: boolean;
  bodyClassName?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded border border-main-border/30 bg-panel-bg overflow-hidden",
        !compact && "shadow-card",
        className,
      )}
    >
      <div
        className={cn(
          "border-b border-main-border/20 flex items-center gap-2",
          compact ? "px-2.5 py-1.5" : "px-3.5 py-2.5",
        )}
      >
        <Icon size={compact ? 12 : 13} weight="light" className="text-primary" />
        <h4 className="text-[11px] font-medium text-main-text">{title}</h4>
      </div>
      <div className={cn(compact ? "p-2.5" : "p-3.5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-muted-text">{label}</span>
      <span className="text-[11px] font-mono text-main-text break-all">{value || "—"}</span>
    </div>
  );
}
