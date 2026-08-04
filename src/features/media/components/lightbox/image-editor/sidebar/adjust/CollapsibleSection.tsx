"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

export function CollapsibleSection({
  label,
  defaultOpen = false,
  children,
}: {
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full pt-1 group cursor-pointer"
      >
        <CaretDown
          size={10}
          weight="bold"
          className={`text-muted-text/50 transition-transform ${isOpen ? "" : "-rotate-90"}`}
        />
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-text/70">
          {label}
        </span>
        <div className="flex-1 h-px bg-main-border/50" />
      </button>
      {isOpen && <div className="space-y-3 mt-2">{children}</div>}
    </div>
  );
}
