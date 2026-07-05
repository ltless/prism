export const SIDECAR_MODEL_IDS = {
  standard: 'openai/clip-vit-base-patch32',
  sharp: 'openai/clip-vit-base-patch16',
  high: 'openai/clip-vit-large-patch14',
} as const;

export type ModelVariantType = keyof typeof SIDECAR_MODEL_IDS;

export const ALLOWED_VARIANTS = Object.keys(SIDECAR_MODEL_IDS) as ModelVariantType[];

export const AESTHETIC_MODEL_ID = 'shunk031/aesthetics-predictor-v2-sac-logos-ava1-l14-linearMSE';
