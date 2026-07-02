"use client";

import { useState } from "react";
import { SlidersHorizontal, SunDim, DropHalfBottom, CaretDown } from "@phosphor-icons/react";
import { SliderRow } from "./SliderRow";
import { PanelHeader, SubHeader } from "../../EditorSidebar";
import { useEditorState } from "../state/editorState";
import { useEditorActions } from "../hooks/useEditorActions";

interface AdjustPanelProps {
  onClose: () => void;
  onInvertChange: (v: boolean) => void;
  onDuotoneColorAChange: (v: string) => void;
  onDuotoneColorBChange: (v: string) => void;
  onTritoneColorAChange: (v: string) => void;
  onTritoneColorBChange: (v: string) => void;
  onTritoneColorCChange: (v: string) => void;
  onQuadtoneColorAChange: (v: string) => void;
  onQuadtoneColorBChange: (v: string) => void;
  onQuadtoneColorCChange: (v: string) => void;
  onQuadtoneColorDChange: (v: string) => void;
}

function CollapsibleSection({
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

const WB_PRESETS = [
  { label: "As Shot", temperature: 0, tint: 0 },
  { label: "Daylight", temperature: 15, tint: 0 },
  { label: "Cloudy", temperature: 20, tint: 0 },
  { label: "Shade", temperature: 35, tint: 5 },
  { label: "Tungsten", temperature: -30, tint: -2 },
  { label: "Fluorescent", temperature: -15, tint: 8 },
];

const DEFAULT_LENS = { distortion: 0, vignetting: 0, chromaticAberrationRedCyan: 0, chromaticAberrationBlueYellow: 0, defringe: 0 };
const DEFAULT_PERSP = { upright: "off" as const, vertical: 0, horizontal: 0, rotate: 0, aspect: 0, scale: 100 };
const DEFAULT_SPLIT = { shadowsHue: 0, shadowsSaturation: 0, highlightsHue: 0, highlightsSaturation: 0, balance: 0 };
const DEFAULT_LEVELS = { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 };
const DEFAULT_MOTION = { angle: 0, distance: 0 };

export function AdjustPanel({
  onClose,
  onInvertChange,
  onDuotoneColorAChange,
  onDuotoneColorBChange,
  onTritoneColorAChange,
  onTritoneColorBChange,
  onTritoneColorCChange,
  onQuadtoneColorAChange,
  onQuadtoneColorBChange,
  onQuadtoneColorCChange,
  onQuadtoneColorDChange,
}: AdjustPanelProps) {
  const adjustments = useEditorState((s) => s.adjustments);
  const { setScalar, setMergeField, endDragSession } = useEditorActions();

  const resetWhiteBalance = () => {
    setScalar("temperature", 0);
    setScalar("tint", 0);
    endDragSession();
  };
  const hasAdjustments = adjustments.temperature !== 0 || adjustments.tint !== 0;

  return (
    <div className="border-b border-main-border">
      <PanelHeader
        icon={SlidersHorizontal}
        label="Adjust"
        onClose={onClose}
      />
      <div className="px-3 pb-3 pt-2 flex flex-col gap-2">
        <CollapsibleSection label="Basic Light">
          <SliderRow
            label="Exposure"
            value={adjustments.exposure}
            min={-5}
            max={5}
            step={0.01}
            onChange={(v) => setScalar("exposure", v)}
            onReset={() => setScalar("exposure", 0)}
            unit=" stops"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Contrast"
            value={adjustments.contrast}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("contrast", v)}
            onReset={() => setScalar("contrast", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Brightness"
            value={adjustments.brightness}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("brightness", v)}
            onReset={() => setScalar("brightness", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Gamma"
            value={adjustments.gamma}
            min={0.1}
            max={3}
            step={0.01}
            onChange={(v) => setScalar("gamma", v)}
            onReset={() => setScalar("gamma", 1)}
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Tone">
          <SliderRow
            label="Highlights"
            value={adjustments.highlights}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("highlights", v)}
            onReset={() => setScalar("highlights", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Shadows"
            value={adjustments.shadows}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("shadows", v)}
            onReset={() => setScalar("shadows", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Whites"
            value={adjustments.whites}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("whites", v)}
            onReset={() => setScalar("whites", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Blacks"
            value={adjustments.blacks}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("blacks", v)}
            onReset={() => setScalar("blacks", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Clarity"
            value={adjustments.clarity}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("clarity", v)}
            onReset={() => setScalar("clarity", 0)}
            unit="%"
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Color">
          <SliderRow
            label="Hue"
            value={adjustments.hue}
            min={-180}
            max={180}
            step={1}
            onChange={(v) => setScalar("hue", v)}
            onReset={() => setScalar("hue", 0)}
            unit="°"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Saturation"
            value={adjustments.saturation}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("saturation", v)}
            onReset={() => setScalar("saturation", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Vibrance"
            value={adjustments.vibrance}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("vibrance", v)}
            onReset={() => setScalar("vibrance", 0)}
            unit="%"
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Detail">
          <SliderRow
            label="Sharpening"
            value={adjustments.sharpening}
            min={0}
            max={200}
            step={1}
            onChange={(v) => setScalar("sharpening", v)}
            onReset={() => setScalar("sharpening", 0)}
            onCommit={endDragSession}
          />
          <SliderRow
            label="Radius"
            value={adjustments.sharpeningRadius}
            min={0.5}
            max={3}
            step={0.1}
            onChange={(v) => setScalar("sharpeningRadius", v)}
            onReset={() => setScalar("sharpeningRadius", 1)}
            unit="px"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Detail"
            value={adjustments.sharpeningDetail}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setScalar("sharpeningDetail", v)}
            onReset={() => setScalar("sharpeningDetail", 25)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Masking"
            value={adjustments.sharpeningMasking}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setScalar("sharpeningMasking", v)}
            onReset={() => setScalar("sharpeningMasking", 0)}
            unit="%"
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Noise Reduction">
          <SliderRow
            label="Luminance"
            value={adjustments.noiseReduction}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setScalar("noiseReduction", v)}
            onReset={() => setScalar("noiseReduction", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Detail"
            value={adjustments.noiseReductionDetail}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setScalar("noiseReductionDetail", v)}
            onReset={() => setScalar("noiseReductionDetail", 25)}
            unit="%"
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Blur">
          <SliderRow
            label="Gaussian Blur"
            value={adjustments.gaussianBlur}
            min={0}
            max={250}
            step={1}
            onChange={(v) => setScalar("gaussianBlur", v)}
            onReset={() => setScalar("gaussianBlur", 0)}
            unit="px"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Median Filter"
            value={adjustments.medianFilter}
            min={0}
            max={10}
            step={1}
            onChange={(v) => setScalar("medianFilter", v)}
            onReset={() => setScalar("medianFilter", 0)}
            unit="px"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Motion Blur Angle"
            value={adjustments.motionBlur?.angle ?? 0}
            min={-360}
            max={360}
            step={1}
            onChange={(v) => setMergeField("motionBlur", { angle: v }, DEFAULT_MOTION)}
            onReset={() => setMergeField("motionBlur", { angle: 0 }, DEFAULT_MOTION)}
            unit="°"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Motion Blur Distance"
            value={adjustments.motionBlur?.distance ?? 0}
            min={0}
            max={250}
            step={1}
            onChange={(v) => setMergeField("motionBlur", { distance: v }, DEFAULT_MOTION)}
            onReset={() => setMergeField("motionBlur", { distance: 0 }, DEFAULT_MOTION)}
            unit="px"
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Lens Corrections">
          <SliderRow
            label="Distortion"
            value={adjustments.lensCorrections?.distortion ?? 0}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setMergeField("lensCorrections", { distortion: v }, DEFAULT_LENS)}
            onReset={() => setMergeField("lensCorrections", { distortion: 0 }, DEFAULT_LENS)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Vignetting"
            value={adjustments.lensCorrections?.vignetting ?? 0}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setMergeField("lensCorrections", { vignetting: v }, DEFAULT_LENS)}
            onReset={() => setMergeField("lensCorrections", { vignetting: 0 }, DEFAULT_LENS)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="CA Red/Cyan"
            value={adjustments.lensCorrections?.chromaticAberrationRedCyan ?? 0}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setMergeField("lensCorrections", { chromaticAberrationRedCyan: v }, DEFAULT_LENS)}
            onReset={() => setMergeField("lensCorrections", { chromaticAberrationRedCyan: 0 }, DEFAULT_LENS)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="CA Blue/Yellow"
            value={adjustments.lensCorrections?.chromaticAberrationBlueYellow ?? 0}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setMergeField("lensCorrections", { chromaticAberrationBlueYellow: v }, DEFAULT_LENS)}
            onReset={() => setMergeField("lensCorrections", { chromaticAberrationBlueYellow: 0 }, DEFAULT_LENS)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Defringe"
            value={adjustments.lensCorrections?.defringe ?? 0}
            min={0}
            max={20}
            step={1}
            onChange={(v) => setMergeField("lensCorrections", { defringe: v }, DEFAULT_LENS)}
            onReset={() => setMergeField("lensCorrections", { defringe: 0 }, DEFAULT_LENS)}
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Perspective">
          <SliderRow
            label="Vertical"
            value={adjustments.perspective?.vertical ?? 0}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setMergeField("perspective", { vertical: v }, DEFAULT_PERSP)}
            onReset={() => setMergeField("perspective", { vertical: 0 }, DEFAULT_PERSP)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Horizontal"
            value={adjustments.perspective?.horizontal ?? 0}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setMergeField("perspective", { horizontal: v }, DEFAULT_PERSP)}
            onReset={() => setMergeField("perspective", { horizontal: 0 }, DEFAULT_PERSP)}
            unit="%"
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="Effects">
          <SliderRow
            label="Vignette"
            value={adjustments.vignette}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("vignette", v)}
            onReset={() => setScalar("vignette", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Grain"
            value={adjustments.grain}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setScalar("grain", v)}
            onReset={() => setScalar("grain", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Texture"
            value={adjustments.texture}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("texture", v)}
            onReset={() => setScalar("texture", 0)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Dehaze"
            value={adjustments.dehaze}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setScalar("dehaze", v)}
            onReset={() => setScalar("dehaze", 0)}
            unit="%"
            onCommit={endDragSession}
          />
        </CollapsibleSection>

        <CollapsibleSection label="White Balance">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded border border-main-border/60 bg-surface-bg/40">
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
            <div className="flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded border border-main-border/60 bg-surface-bg/40">
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
                  onClick={() => {
                    setScalar("temperature", preset.temperature);
                    setScalar("tint", preset.tint);
                    endDragSession();
                  }}
                  className={
                    "px-1.5 py-1.5 text-xs font-medium rounded border transition-all cursor-pointer " +
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
              onClick={resetWhiteBalance}
              className="w-full py-1.5 text-[11px] font-medium text-muted-text hover:text-primary border border-main-border/60 rounded transition-colors cursor-pointer"
            >
              Reset White Balance
            </button>
          )}
        </CollapsibleSection>

        <CollapsibleSection label="Creative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-main-text/80">Invert</span>
            <button
              onClick={() => onInvertChange(!adjustments.invert)}
              className={`px-3 py-1 text-xs font-semibold rounded border transition-all cursor-pointer ${
                adjustments.invert
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-main-border/60 bg-surface-bg/40 text-muted-text hover:text-main-text"
              }`}
            >
              {adjustments.invert ? "ON" : "OFF"}
            </button>
          </div>
          <SliderRow
            label="Solarize"
            value={adjustments.solarize}
            min={0}
            max={255}
            step={1}
            onChange={(v) => setScalar("solarize", v)}
            onReset={() => setScalar("solarize", 0)}
            onCommit={endDragSession}
          />
          <SliderRow
            label="Posterize"
            value={adjustments.posterize}
            min={0}
            max={255}
            step={1}
            onChange={(v) => setScalar("posterize", v)}
            onReset={() => setScalar("posterize", 0)}
            onCommit={endDragSession}
          />
          <SliderRow
            label="Threshold"
            value={adjustments.threshold}
            min={0}
            max={255}
            step={1}
            onChange={(v) => setScalar("threshold", v)}
            onReset={() => setScalar("threshold", 0)}
            onCommit={endDragSession}
          />

          <div className="space-y-1.5">
            <span className="text-[11px] text-main-text/80 block">Duotone</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={adjustments.duotone?.colorA ?? "#000000"}
                onChange={(e) => onDuotoneColorAChange(e.target.value)}
                className="w-8 h-8 rounded border border-main-border cursor-pointer"
                title="Shadow color"
              />
              <input
                type="color"
                value={adjustments.duotone?.colorB ?? "#ffffff"}
                onChange={(e) => onDuotoneColorBChange(e.target.value)}
                className="w-8 h-8 rounded border border-main-border cursor-pointer"
                title="Highlight color"
              />
              {(adjustments.duotone?.colorA !== "#000000" || adjustments.duotone?.colorB !== "#ffffff") && (
                <button
                  onClick={() => {
                    onDuotoneColorAChange("#000000");
                    onDuotoneColorBChange("#ffffff");
                  }}
                  className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-main-text/80 block">Tritone</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={adjustments.tritone?.colorA ?? "#000000"}
                onChange={(e) => onTritoneColorAChange(e.target.value)}
                className="w-7 h-7 rounded border border-main-border cursor-pointer"
                title="Shadow"
              />
              <input
                type="color"
                value={adjustments.tritone?.colorB ?? "#808080"}
                onChange={(e) => onTritoneColorBChange(e.target.value)}
                className="w-7 h-7 rounded border border-main-border cursor-pointer"
                title="Midtone"
              />
              <input
                type="color"
                value={adjustments.tritone?.colorC ?? "#ffffff"}
                onChange={(e) => onTritoneColorCChange(e.target.value)}
                className="w-7 h-7 rounded border border-main-border cursor-pointer"
                title="Highlight"
              />
              {(adjustments.tritone?.colorA !== "#000000" ||
                adjustments.tritone?.colorB !== "#808080" ||
                adjustments.tritone?.colorC !== "#ffffff") && (
                <button
                  onClick={() => {
                    onTritoneColorAChange("#000000");
                    onTritoneColorBChange("#808080");
                    onTritoneColorCChange("#ffffff");
                  }}
                  className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-main-text/80 block">Quadtone</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={adjustments.quadtone?.colorA ?? "#000000"}
                onChange={(e) => onQuadtoneColorAChange(e.target.value)}
                className="w-6 h-6 rounded border border-main-border cursor-pointer"
                title="0%"
              />
              <input
                type="color"
                value={adjustments.quadtone?.colorB ?? "#404040"}
                onChange={(e) => onQuadtoneColorBChange(e.target.value)}
                className="w-6 h-6 rounded border border-main-border cursor-pointer"
                title="33%"
              />
              <input
                type="color"
                value={adjustments.quadtone?.colorC ?? "#bfbfbf"}
                onChange={(e) => onQuadtoneColorCChange(e.target.value)}
                className="w-6 h-6 rounded border border-main-border cursor-pointer"
                title="67%"
              />
              <input
                type="color"
                value={adjustments.quadtone?.colorD ?? "#ffffff"}
                onChange={(e) => onQuadtoneColorDChange(e.target.value)}
                className="w-6 h-6 rounded border border-main-border cursor-pointer"
                title="100%"
              />
              {(adjustments.quadtone?.colorA !== "#000000" ||
                adjustments.quadtone?.colorB !== "#404040" ||
                adjustments.quadtone?.colorC !== "#bfbfbf" ||
                adjustments.quadtone?.colorD !== "#ffffff") && (
                <button
                  onClick={() => {
                    onQuadtoneColorAChange("#000000");
                    onQuadtoneColorBChange("#404040");
                    onQuadtoneColorCChange("#bfbfbf");
                    onQuadtoneColorDChange("#ffffff");
                  }}
                  className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection label="Split Toning">
          <SliderRow
            label="Shadows Hue"
            value={adjustments.splitToning?.shadowsHue ?? 0}
            min={0}
            max={360}
            step={1}
            onChange={(v) => setMergeField("splitToning", { shadowsHue: v }, DEFAULT_SPLIT)}
            onReset={() => setMergeField("splitToning", { shadowsHue: 0 }, DEFAULT_SPLIT)}
            unit="°"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Shadows Sat"
            value={adjustments.splitToning?.shadowsSaturation ?? 0}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setMergeField("splitToning", { shadowsSaturation: v }, DEFAULT_SPLIT)}
            onReset={() => setMergeField("splitToning", { shadowsSaturation: 0 }, DEFAULT_SPLIT)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Highlights Hue"
            value={adjustments.splitToning?.highlightsHue ?? 0}
            min={0}
            max={360}
            step={1}
            onChange={(v) => setMergeField("splitToning", { highlightsHue: v }, DEFAULT_SPLIT)}
            onReset={() => setMergeField("splitToning", { highlightsHue: 0 }, DEFAULT_SPLIT)}
            unit="°"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Highlights Sat"
            value={adjustments.splitToning?.highlightsSaturation ?? 0}
            min={0}
            max={100}
            step={1}
            onChange={(v) => setMergeField("splitToning", { highlightsSaturation: v }, DEFAULT_SPLIT)}
            onReset={() => setMergeField("splitToning", { highlightsSaturation: 0 }, DEFAULT_SPLIT)}
            unit="%"
            onCommit={endDragSession}
          />
          <SliderRow
            label="Balance"
            value={adjustments.splitToning?.balance ?? 0}
            min={-100}
            max={100}
            step={1}
            onChange={(v) => setMergeField("splitToning", { balance: v }, DEFAULT_SPLIT)}
            onReset={() => setMergeField("splitToning", { balance: 0 }, DEFAULT_SPLIT)}
            unit="%"
            onCommit={endDragSession}
          />
          {(adjustments.splitToning?.shadowsHue !== 0 ||
            adjustments.splitToning?.shadowsSaturation !== 0 ||
            adjustments.splitToning?.highlightsHue !== 0 ||
            adjustments.splitToning?.highlightsSaturation !== 0 ||
            adjustments.splitToning?.balance !== 0) && (
            <button
              onClick={() => {
                setMergeField(
                  "splitToning",
                  { shadowsHue: 0, shadowsSaturation: 0, highlightsHue: 0, highlightsSaturation: 0, balance: 0 },
                  DEFAULT_SPLIT
                );
                endDragSession();
              }}
              className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </CollapsibleSection>

        <CollapsibleSection label="Levels">
          <SliderRow
            label="Input Black"
            value={adjustments.levels?.inBlack ?? 0}
            min={0}
            max={254}
            step={1}
            onChange={(v) => setMergeField("levels", { inBlack: v }, DEFAULT_LEVELS)}
            onReset={() => setMergeField("levels", { inBlack: 0 }, DEFAULT_LEVELS)}
            onCommit={endDragSession}
          />
          <SliderRow
            label="Input White"
            value={adjustments.levels?.inWhite ?? 255}
            min={1}
            max={255}
            step={1}
            onChange={(v) => setMergeField("levels", { inWhite: v }, DEFAULT_LEVELS)}
            onReset={() => setMergeField("levels", { inWhite: 255 }, DEFAULT_LEVELS)}
            onCommit={endDragSession}
          />
          <SliderRow
            label="Gamma"
            value={adjustments.levels?.gamma ?? 1}
            min={0.1}
            max={9.99}
            step={0.01}
            onChange={(v) => setMergeField("levels", { gamma: v }, DEFAULT_LEVELS)}
            onReset={() => setMergeField("levels", { gamma: 1 }, DEFAULT_LEVELS)}
            onCommit={endDragSession}
          />
          <SliderRow
            label="Output Black"
            value={adjustments.levels?.outBlack ?? 0}
            min={0}
            max={254}
            step={1}
            onChange={(v) => setMergeField("levels", { outBlack: v }, DEFAULT_LEVELS)}
            onReset={() => setMergeField("levels", { outBlack: 0 }, DEFAULT_LEVELS)}
            onCommit={endDragSession}
          />
          <SliderRow
            label="Output White"
            value={adjustments.levels?.outWhite ?? 255}
            min={1}
            max={255}
            step={1}
            onChange={(v) => setMergeField("levels", { outWhite: v }, DEFAULT_LEVELS)}
            onReset={() => setMergeField("levels", { outWhite: 255 }, DEFAULT_LEVELS)}
            onCommit={endDragSession}
          />
          {(adjustments.levels?.inBlack !== 0 ||
            adjustments.levels?.inWhite !== 255 ||
            adjustments.levels?.gamma !== 1 ||
            adjustments.levels?.outBlack !== 0 ||
            adjustments.levels?.outWhite !== 255) && (
            <button
              onClick={() => {
                setMergeField(
                  "levels",
                  { inBlack: 0, inWhite: 255, gamma: 1, outBlack: 0, outWhite: 255 },
                  DEFAULT_LEVELS
                );
                endDragSession();
              }}
              className="text-[11px] text-muted-text hover:text-primary underline cursor-pointer"
            >
              Reset
            </button>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
