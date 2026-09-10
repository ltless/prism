"use client";

import { SunDim, DropHalfBottom } from "@phosphor-icons/react";
import { SliderRow } from "../SliderRow";
import { SubHeader } from "../../../EditorSidebar";
import { CollapsibleSection } from "./CollapsibleSection";
import { useEditorState } from "../../state/editorState";
import { useEditorActions } from "../../hooks/useEditorActions";

const WB_PRESETS = [
  { label: "As Shot", temperature: 0, tint: 0 },
  { label: "Daylight", temperature: 15, tint: 0 },
  { label: "Cloudy", temperature: 20, tint: 0 },
  { label: "Shade", temperature: 35, tint: 5 },
  { label: "Tungsten", temperature: -30, tint: -2 },
  { label: "Fluorescent", temperature: -15, tint: 8 },
];

export function WhiteBalanceSection() {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, endDragSession } = useEditorActions();

  const resetWhiteBalance = () => {
    setScalar("temperature", 0);
    setScalar("tint", 0);
    endDragSession();
  };
  const hasAdjustments = adjustments.temperature !== 0 || adjustments.tint !== 0;

  return (
    <CollapsibleSection label="White Balance">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-main-border/60 bg-surface-bg/40">
          <SunDim
            size={12}
            weight="regular"
            className={
              adjustments.temperature > 0
                ? "text-amber-400"
                : adjustments.temperature < 0
                  ? "text-sky-400"
                  : "text-muted-text"
            }
          />
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              adjustments.temperature > 0
                ? "text-amber-400"
                : adjustments.temperature < 0
                  ? "text-sky-400"
                  : "text-muted-text"
            }`}
          >
            {adjustments.temperature === 0
              ? "Neutral"
              : adjustments.temperature > 0
                ? "Warm"
                : "Cool"}
          </span>
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-main-border/60 bg-surface-bg/40">
          <DropHalfBottom
            size={12}
            weight="regular"
            className={
              adjustments.tint > 0
                ? "text-fuchsia-400"
                : adjustments.tint < 0
                  ? "text-emerald-400"
                  : "text-muted-text"
            }
          />
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              adjustments.tint > 0
                ? "text-fuchsia-400"
                : adjustments.tint < 0
                  ? "text-emerald-400"
                  : "text-muted-text"
            }`}
          >
            {adjustments.tint === 0
              ? "Neutral"
              : adjustments.tint > 0
                ? "Magenta"
                : "Green"}
          </span>
        </div>
      </div>

      <SliderRow
        label="Temperature"
        value={adjustments.temperature}
        min={-50}
        max={50}
        step={1}
        onChange={(v) => setScalar("temperature", v)}
        onReset={() => setScalar("temperature", 0)}
        gradient="linear-gradient(to right, #3b82f6, #fef3c7, #f97316)"
        onCommit={endDragSession}
      />

      <SliderRow
        label="Tint"
        value={adjustments.tint}
        min={-50}
        max={50}
        step={1}
        onChange={(v) => setScalar("tint", v)}
        onReset={() => setScalar("tint", 0)}
        gradient="linear-gradient(to right, #10b981, #fef3c7, #d946ef)"
        onCommit={endDragSession}
      />

      <SubHeader label="Presets" />
      <div className="grid grid-cols-3 gap-1.5">
        {WB_PRESETS.map((preset) => {
          const isActive =
            adjustments.temperature === preset.temperature &&
            adjustments.tint === preset.tint;
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setScalar("temperature", preset.temperature);
                setScalar("tint", preset.tint);
                endDragSession();
              }}
              className={
                "px-1.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer " +
                (isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-main-border/60 bg-surface-bg/40 text-muted-text hover:text-main-text hover:bg-surface-bg hover:border-main-border")
              }
              title={`${preset.label}: ${preset.temperature > 0 ? "+" : ""}${preset.temperature}° T, ${preset.tint > 0 ? "+" : ""}${preset.tint}° Tint`}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {hasAdjustments && (
        <button
          type="button"
          onClick={resetWhiteBalance}
          className="w-full py-1.5 text-[11px] font-medium text-muted-text hover:text-primary border border-main-border/60 rounded-md transition-colors cursor-pointer"
        >
          Reset White Balance
        </button>
      )}
    </CollapsibleSection>
  );
}
