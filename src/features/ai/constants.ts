export const SIDECAR_MODEL_IDS = {
 standard: 'openai/clip-vit-base-patch32',
 sharp: 'openai/clip-vit-base-patch16',
 high: 'openai/clip-vit-large-patch14',
} as const;

export type ModelVariantType = keyof typeof SIDECAR_MODEL_IDS;

export const ALLOWED_VARIANTS = Object.keys(SIDECAR_MODEL_IDS) as ModelVariantType[];

export const AESTHETIC_MODEL_ID = 'shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE';
export const TAGGER_MODEL_ID = 'microsoft/Florence-2-base';

export { TAG_CANDIDATES } from "./tag-candidates.mts";

export const AI_MODEL_TIERS = {
 standard: {
 name: "Standard",
 family: "CLIP",
 variants: {
 base: {
 name: "Base",
 model: "openai/clip-vit-base-patch32",
 vram: "~0.5GB",
 accuracy: "Baseline",
 speed: "Fastest",
 description: "Fastest indexing. Low VRAM usage.",
 },
 sharp: {
 name: "Sharp",
 model: "openai/clip-vit-base-patch16",
 vram: "~0.5GB",
 accuracy: "+5% vs Base",
 speed: "Fast",
 description: "Better accuracy with patch16.",
 },
 high: {
 name: "High",
 model: "openai/clip-vit-large-patch14",
 vram: "~1.7GB",
 accuracy: "+10% vs Base",
 speed: "Moderate",
 description: "Highest precision. Requires more VRAM.",
 },
 },
 features: ["search", "tagging", "aesthetic"],
 description: "CLIP family. Choose variant based on accuracy/speed needs.",
 },
} as const;

export type ModelTier = keyof typeof AI_MODEL_TIERS;
export type CLIPVariant = keyof typeof AI_MODEL_TIERS.standard.variants;

export const AESTHETIC_MODELS = {
 clip: {
 name: "CLIP-based",
 description: "Uses CLIP embeddings with prompt-pair scoring",
 model: null,
 vram: "0GB (uses existing CLIP)",
 },
 laion: {
 name: "LAION Aesthetic v2.5",
 description: "PyTorch ViT-L/14 + MLP head (shunk031)",
 model: "shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE",
 vram: "~1.2GB",
 },
} as const;

export type AestheticModel = keyof typeof AESTHETIC_MODELS;

export const TIER_FEATURES = {
 search: "Smart Search (embedding)",
 tagging: "Auto Tagging",
 aesthetic: "Aesthetic Scoring",
} as const;
