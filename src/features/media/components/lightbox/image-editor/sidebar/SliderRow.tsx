import React, { memo } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset?: () => void;
  onCommit?: () => void;
  unit?: string;
  gradient?: string;
}

export const SliderRow = memo(function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onReset,
  onCommit,
  unit = "",
  gradient,
}: SliderRowProps) {
  const percent = ((value - min) / (max - min)) * 100;
  const isDirty = value !== 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-main-text/80">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono tabular-nums text-muted-text">
            {value > 0 ? `+${value}` : value}
            {unit}
          </span>
          {isDirty && onReset && (
            <button
              onClick={() => {
                onReset?.();
                onCommit?.();
              }}
              className="text-muted-text/60 hover:text-primary transition-colors cursor-pointer"
              title="Reset to 0"
            >
              <ArrowCounterClockwise size={10} weight="regular" />
            </button>
          )}
        </div>
      </div>
      <div className="relative">
        {gradient && (
          <div
            className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full pointer-events-none"
            style={{ background: gradient }}
          />
        )}
        <input
          type="range"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          onPointerUp={() => onCommit?.()}
          onKeyUp={(e) => {
            if (e.key === "Escape" || e.key === "Enter") onCommit?.();
          }}
          className="w-full cursor-pointer relative z-10 accent-primary"
          style={{ "--range-percent": `${percent}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
});
