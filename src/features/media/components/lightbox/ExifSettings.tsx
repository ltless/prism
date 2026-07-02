"use client";

import { Camera } from "@phosphor-icons/react";
import { SectionCard, Field } from "@/shared/components/SectionCard";

interface ExifSettingsProps {
  metadata: {
    make?: string;
    model?: string;
    lens?: string;
    software?: string;
    exposure?: string;
    f_number?: number;
    iso?: number;
    focal_length?: number;
    flash?: number;
    white_balance?: number;
    metering_mode?: number;
    exposure_program?: number;
    color_space?: number;
  };
}

function formatFlash(val?: number): string | null {
  if (val === undefined || val === null) return null;
  const map: Record<number, string> = {
    0: "Off", 1: "Fired", 5: "Fired (no return)", 7: "Fired (compulsory)",
    9: "Fired (compulsory, return)", 16: "Off (compulsory)", 24: "Auto",
    25: "Fired (auto)", 29: "Fired (auto, return)", 32: "Off (auto)",
  };
  return map[val] ?? String(val);
}

function formatExposureProgram(val?: number): string | null {
  if (val === undefined || val === null) return null;
  const map: Record<number, string> = {
    0: "Not defined", 1: "Manual", 2: "Normal", 3: "Aperture priority",
    4: "Shutter priority", 5: "Creative", 6: "Action",
    7: "Portrait", 8: "Landscape",
  };
  return map[val] ?? String(val);
}

function formatMeteringMode(val?: number): string | null {
  if (val === undefined || val === null) return null;
  const map: Record<number, string> = {
    1: "Average", 2: "Center-weighted", 3: "Spot",
    4: "Multi-spot", 5: "Pattern", 6: "Partial",
  };
  return map[val] ?? String(val);
}

function formatWhiteBalance(val?: number): string | null {
  if (val === undefined || val === null) return null;
  if (val === 0) return "Auto";
  if (val === 1) return "Manual";
  return String(val);
}

function formatColorSpace(val?: number): string | null {
  if (val === undefined || val === null) return null;
  if (val === 1) return "sRGB";
  if (val === 65535) return "Uncalibrated";
  return String(val);
}

export function ExifSettings({ metadata }: ExifSettingsProps) {
  const fields = [
    { label: "Make", value: metadata.make ?? null },
    { label: "Model", value: metadata.model ?? null },
    { label: "Lens", value: metadata.lens ?? null },
    { label: "Software", value: metadata.software ?? null },
    { label: "Exposure", value: metadata.exposure ?? null },
    { label: "Aperture", value: metadata.f_number ? `f/${metadata.f_number}` : null },
    { label: "ISO", value: metadata.iso != null ? String(metadata.iso) : null },
    { label: "Focal", value: metadata.focal_length ? `${metadata.focal_length}mm` : null },
    { label: "Flash", value: formatFlash(metadata.flash) },
    { label: "WB", value: formatWhiteBalance(metadata.white_balance) },
    { label: "Metering", value: formatMeteringMode(metadata.metering_mode) },
    { label: "Program", value: formatExposureProgram(metadata.exposure_program) },
    { label: "Color", value: formatColorSpace(metadata.color_space) },
  ].filter(f => f.value !== null && f.value !== undefined && f.value !== "");

  if (fields.length === 0) return null;

  return (
    <SectionCard compact icon={Camera} title="Camera">
      <div className="grid grid-cols-2 gap-2.5">
        {fields.map(f => (
          <Field key={f.label} label={f.label} value={f.value} />
        ))}
      </div>
    </SectionCard>
  );
}
