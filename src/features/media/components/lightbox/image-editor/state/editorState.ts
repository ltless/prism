import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Editor state: adjustments, transform, UI. The one source of truth.
 * Snapshots of this shape get shoved onto the undo/redo stack.
 */
export interface EditorState {
  // ─── Transform ─────────────────────────────────────────────────────
  rotation: number; // 0..360 degrees
  flipH: boolean;
  flipV: boolean;

  // ─── Adjustments ───────────────────────────────────────────────────
  adjustments: AdjustmentState;

  // ─── Crop (null = no crop) ─────────────────────────────────────────
  crop: CropState | null;

  // ─── UI state (not saved, not in undo stack) ───────────────────────
  activeTool: EditorTool;
  isDirty: boolean; // set true on any adjustment, cleared on save

  // ─── Actions ───────────────────────────────────────────────────────
  setAdjustment: <K extends keyof AdjustmentState>(
    key: K,
    value: AdjustmentState[K]
  ) => void;
  setTransform: (patch: {
    rotation?: number;
    flipH?: boolean;
    flipV?: boolean;
  }) => void;
  setCrop: (crop: CropState | null) => void;
  setActiveTool: (tool: EditorTool) => void;
  resetAdjustment: <K extends keyof AdjustmentState>(key: K) => void;
  resetAllAdjustments: () => void;
  resetAll: () => void; // adjustments + transform + crop
  setDirty: (dirty: boolean) => void;
  /** Switch the editor to a new image. Resets all state synchronously. */
  setImageId: (id: string) => void;
}

export type EditorTool =
  | "select"
  | "hand"
  | "crop"
  | "adjust"
  | "paint"
  | "eraser"
  | "text"
  | "eyedropper"
  | "zoom";

export type CropState = {
  x: number; // top-left x in original image pixels
  y: number;
  width: number;
  height: number;
  rotation: number; // degrees, -180..+180
};

/**
 * Default values for every adjustment. Neutral = no visual change.
 * Zero or identity. Touch any of these and the engine wakes up.
 */
export interface AdjustmentState {
  exposure: number;
  contrast: number;
  brightness: number;
  gamma: number;
  clarity: number;
  dehaze: number;
  saturation: number;
  vibrance: number;
  temperature: number;
  tint: number;
  hue: number;
  highlights: number;
  shadows: number;
  whites: number;
  blacks: number;
  texture: number;
  sharpening: number;
  sharpeningRadius: number;
  sharpeningDetail: number;
  sharpeningMasking: number;
  noiseReduction: number;
  noiseReductionDetail: number;
  vignette: number;
  grain: number;
  curvePoints: CurvePoint[];
  curveR: CurvePoint[];
  curveG: CurvePoint[];
  curveB: CurvePoint[];
  splitToning: SplitToning | null;
  colorGrading: ColorGrading | null;
  levels: Levels | null;
  hsl: Record<string, HSLAdjustment>;
  selectiveColor: Record<string, SelectiveColorAdjustment>;
  channelMixer: ChannelMixer | null;
  photoFilter: PhotoFilter | null;
  lutFile: string | null;
  colorBalance: {
    shadows: [number, number, number];
    midtones: [number, number, number];
    highlights: [number, number, number];
  };
  posterize: number;
  threshold: number;
  gradientMap: GradientMap | null;
  duotone: Duotone | null;
  tritone: Tritone | null;
  quadtone: Quadtone | null;
  invert: boolean;
  solarize: number;
  motionBlur: MotionBlur | null;
  gaussianBlur: number;
  medianFilter: number;
  lensCorrections: LensCorrections | null;
  perspective: Perspective | null;
}

export const DEFAULT_ADJUSTMENTS: AdjustmentState = {
  // Basic light & color
  exposure: 0, // -5..+5 stops
  contrast: 0, // -100..+100
  brightness: 0, // -100..+100
  gamma: 1, // 0.1..3.0 (1 = identity — midtone curve)

  // Tone & color detail
  clarity: 0, // -100..+100 (midtone local contrast)
  dehaze: 0, // -100..+100
  saturation: 0, // -100..+100
  vibrance: 0, // -100..+100
  temperature: 0, // -100..+100
  tint: 0, // -100..+100
  hue: 0, // -180..+180 degrees

  // Tone control
  highlights: 0, // -100..+100
  shadows: 0, // -100..+100
  whites: 0, // -100..+100
  blacks: 0, // -100..+100
  texture: 0, // -100..+100

  // Detail
  sharpening: 0, // 0..200 (Lightroom-scale)
  sharpeningRadius: 1, // 0.5..3.0 pixels
  sharpeningDetail: 25, // 0..100
  sharpeningMasking: 0, // 0..100
  noiseReduction: 0, // 0..100
  noiseReductionDetail: 25, // 0..100

  // Effects
  vignette: 0, // -100..+100 (negative = brighten edges, positive = darken edges)
  grain: 0, // 0..100

  // Advanced
  curvePoints: [] as CurvePoint[], // RGB tone curve
  curveR: [] as CurvePoint[],
  curveG: [] as CurvePoint[],
  curveB: [] as CurvePoint[],
  splitToning: null as SplitToning | null,
  colorGrading: null as ColorGrading | null,
  levels: null as Levels | null,
  hsl: {} as Record<string, HSLAdjustment>, // keyed by color name
  selectiveColor: {} as Record<string, SelectiveColorAdjustment>,
  channelMixer: null as ChannelMixer | null,
  photoFilter: null as PhotoFilter | null,
  lutFile: null as string | null,
  colorBalance: { shadows: [0, 0, 0], midtones: [0, 0, 0], highlights: [0, 0, 0] } as {
    shadows: [number, number, number];
    midtones: [number, number, number];
    highlights: [number, number, number];
  },
  posterize: 0, // 0 = off, 2..255 = levels
  threshold: 0, // 0 = off, 1..255 = threshold level
  gradientMap: null as GradientMap | null,
  duotone: null as Duotone | null,
  tritone: null as Tritone | null,
  quadtone: null as Quadtone | null,
  invert: false, // boolean toggle
  solarize: 0, // 0..255 threshold
  motionBlur: null as MotionBlur | null,
  gaussianBlur: 0, // 0..250 radius (px)
  medianFilter: 0, // 0..10 radius (px)
  lensCorrections: null as LensCorrections | null,
  perspective: null as Perspective | null,
};

export type CurvePoint = { x: number; y: number }; // x,y in 0..255

export type SplitToning = {
  shadowsHue: number; // 0..360
  shadowsSaturation: number; // 0..100
  highlightsHue: number;
  highlightsSaturation: number;
  balance: number; // -100..+100
};

export type ColorGrading = {
  shadowsLum: number; // luminance wheel: -100..+100
  shadowsHue: number;
  shadowsSat: number;
  midtonesLum: number;
  midtonesHue: number;
  midtonesSat: number;
  highlightsLum: number;
  highlightsHue: number;
  highlightsSat: number;
  blending: number; // 0..100
  globalSaturation: number;
};

export type Levels = {
  inBlack: number; // 0..255
  inWhite: number; // 0..255
  gamma: number; // 0.1..10.0
  outBlack: number;
  outWhite: number;
};

export type HSLAdjustment = {
  hue: number; // -180..+180
  saturation: number; // -100..+100
  luminance: number; // -100..+100
};

export type SelectiveColorAdjustment = {
  cyan: number; // -100..+100
  magenta: number;
  yellow: number;
  black: number;
};

export type ChannelMixer = {
  red: [number, number, number]; // R,G,B multipliers → output Red
  green: [number, number, number];
  blue: [number, number, number];
  monochrome: boolean;
};

export type PhotoFilter = {
  color: string; // hex
  density: number; // 0..100
  preserveLuminosity: boolean;
};

export type GradientMap = {
  stops: { position: number; color: string }[]; // sorted by position 0..1
};

export type Duotone = {
  colorA: string; // hex
  colorB: string;
};

export type Tritone = {
  colorA: string;
  colorB: string;
  colorC: string;
};

export type Quadtone = {
  colorA: string;
  colorB: string;
  colorC: string;
  colorD: string;
};

export type MotionBlur = {
  angle: number; // -360..+360
  distance: number; // 0..250 px
};

export type LensCorrections = {
  distortion: number; // -100..+100
  vignetting: number; // -100..+100
  chromaticAberrationRedCyan: number;
  chromaticAberrationBlueYellow: number;
  defringe: number; // 0..20
};

export type Perspective = {
  upright: "off" | "auto" | "vertical" | "horizontal" | "full";
  vertical: number; // -100..+100
  horizontal: number;
  rotate: number; // -180..+180
  aspect: number; // -100..+100
  scale: number; // 50..200
};

export const DEFAULT_STATE: Omit<
  EditorState,
  | "setAdjustment"
  | "setTransform"
  | "setCrop"
  | "setActiveTool"
  | "resetAdjustment"
  | "resetAllAdjustments"
  | "resetAll"
  | "setDirty"
  | "setImageId"
> = {
  rotation: 0,
  flipH: false,
  flipV: false,
  adjustments: DEFAULT_ADJUSTMENTS,
  crop: null,
  activeTool: "select",
  isDirty: false,
};

export const useEditorState = create<EditorState>()(
  devtools(
    (set) => ({
      ...DEFAULT_STATE,

      setAdjustment: (key, value) =>
        set((state) => ({
          adjustments: { ...state.adjustments, [key]: value },
          isDirty: true,
        })),

      setTransform: (patch) =>
        set((state) => ({
          ...state,
          ...patch,
          isDirty: true,
        })),

      setCrop: (crop) => set({ crop, isDirty: !!crop }),

      setActiveTool: (activeTool) => set({ activeTool }),

      resetAdjustment: (key) =>
        set((state) => ({
          adjustments: {
            ...state.adjustments,
            [key]: DEFAULT_ADJUSTMENTS[key],
          },
          isDirty: true,
        })),

      resetAllAdjustments: () =>
        set({ adjustments: DEFAULT_ADJUSTMENTS, isDirty: true }),

      resetAll: () =>
        set({
          rotation: 0,
          flipH: false,
          flipV: false,
          adjustments: DEFAULT_ADJUSTMENTS,
          crop: null,
          isDirty: true,
        }),

      setDirty: (isDirty) => set({ isDirty }),

      setImageId: (_id) => {
        // Synchronous reset on image switch — eliminates the race window where
        // a `useEffect([currentItem.id])` would run one render late and briefly
        // paint the previous image's adjustments on the new image.
        set({
          rotation: 0,
          flipH: false,
          flipV: false,
          adjustments: DEFAULT_ADJUSTMENTS,
          crop: null,
          isDirty: false,
        });
      },
    }),
    { name: "prism-editor-state" }
  )
);
