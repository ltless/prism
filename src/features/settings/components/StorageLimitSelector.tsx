"use client";

import { useState } from "react";
import { cn } from "@/core/utils/cn";
import { field } from "@/shared/components/ui/styles";

const GB = 1024 * 1024 * 1024;

const defaultOptions = [
  { label: "5GB", value: 5 * GB },
  { label: "10GB", value: 10 * GB },
  { label: "50GB", value: 50 * GB },
  { label: "100GB", value: 100 * GB },
  { label: "\u221E", value: null },
];

interface StorageLimitSelectorProps {
  value: number | null;
  onChange: (v: number | null) => void;
  options?: { label: string; value: number | null }[];
}

export function StorageLimitSelector({ value, onChange, options = defaultOptions }: StorageLimitSelectorProps) {
  const [text, setText] = useState("");
  const [prevValue, setPrevValue] = useState<number | null | undefined>(undefined);

  // Sync the custom input from the prop when the value changes externally
  // (preset click, load). While typing, the local state leads.
  if (value !== prevValue) {
    setPrevValue(value);
    const isPreset = options.some((o) => o.value === value);
    setText(isPreset || value === null ? "" : String(Math.round(value / GB)));
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-5 gap-2">
        {options.map((opt) => (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "h-12 flex flex-col items-center justify-center rounded-full transition-all duration-500 ease-spring cursor-pointer",
              value === opt.value
                ? "bg-main-text text-app-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
                : "bg-surface-bg text-muted-text ring-1 ring-black/[0.05] hover:text-main-text dark:ring-white/[0.08]"
            )}
          >
            <span className="text-[13px] font-medium tracking-tight">{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            setText(v);
            const n = parseInt(v, 10);
            if (Number.isFinite(n) && n > 0) onChange(n * GB);
          }}
          placeholder="Custom GB"
          aria-label="Custom storage limit in GB"
          className={`${field} h-10 flex-1`}
        />
        <span className="shrink-0 text-[12px] font-medium text-muted-text">GB</span>
      </div>
    </div>
  );
}
