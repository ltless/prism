"use client";

import { SlidersHorizontal } from "@phosphor-icons/react";
import { PanelHeader } from "../../EditorSidebar";
import { BasicLightSection } from "./adjust/BasicLightSection";
import { ToneSection } from "./adjust/ToneSection";
import { ColorSection } from "./adjust/ColorSection";
import { DetailSection } from "./adjust/DetailSection";
import { NoiseReductionSection } from "./adjust/NoiseReductionSection";
import { BlurSection } from "./adjust/BlurSection";
import { LensCorrectionsSection } from "./adjust/LensCorrectionsSection";
import { PerspectiveSection } from "./adjust/PerspectiveSection";
import { EffectsSection } from "./adjust/EffectsSection";
import { WhiteBalanceSection } from "./adjust/WhiteBalanceSection";
import { CreativeSection } from "./adjust/CreativeSection";
import { SplitToningSection } from "./adjust/SplitToningSection";
import { LevelsSection } from "./adjust/LevelsSection";

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
  return (
    <div>
      <PanelHeader
        icon={SlidersHorizontal}
        label="Adjust"
        onClose={onClose}
      />
      <div className="px-3 pb-3 pt-2 flex flex-col gap-2">
        <BasicLightSection />
        <ToneSection />
        <ColorSection />
        <DetailSection />
        <NoiseReductionSection />
        <BlurSection />
        <LensCorrectionsSection />
        <PerspectiveSection />
        <EffectsSection />
        <WhiteBalanceSection />
        <CreativeSection
          onInvertChange={onInvertChange}
          onDuotoneColorAChange={onDuotoneColorAChange}
          onDuotoneColorBChange={onDuotoneColorBChange}
          onTritoneColorAChange={onTritoneColorAChange}
          onTritoneColorBChange={onTritoneColorBChange}
          onTritoneColorCChange={onTritoneColorCChange}
          onQuadtoneColorAChange={onQuadtoneColorAChange}
          onQuadtoneColorBChange={onQuadtoneColorBChange}
          onQuadtoneColorCChange={onQuadtoneColorCChange}
          onQuadtoneColorDChange={onQuadtoneColorDChange}
        />
        <SplitToningSection />
        <LevelsSection />
      </div>
    </div>
  );
}
