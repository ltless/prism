"use client";

import { useState } from "react";
import { cn } from "@/core/utils/cn";

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
              "h-14 flex flex-col items-center justify-center rounded-lg border transition-all cursor-pointer",
              value === opt.value
                ? "bg-primary border-primary text-primary-foreground shadow-sm"
                : "bg-surface-bg border-main-border/40 text-muted-text hover:border-primary/30"
            )}
          >
            <span className="text-xs">{opt.label}</span>
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
          className="flex-1 h-10 px-3 bg-surface-bg border border-main-border/40 rounded-lg text-xs text-main-text placeholder:text-muted-text/50 outline-none focus:border-primary/50 transition-colors"
        />
        <span className="text-xs text-muted-text font-medium shrink-0">GB</span>
      </div>
    </div>
  );
}
