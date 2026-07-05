import { z } from "zod";
import { ALLOWED_VARIANTS } from "@/features/ai/constants";

export const AiDownloadModelSchema = z.object({
  modelId: z.string().min(1).max(200),
});

export const AiEmbedTextSchema = z.object({
  text: z.string().min(1).max(5000),
  variant: z.enum(ALLOWED_VARIANTS as [string, ...string[]]).optional().default("standard"),
});

export const AiEmbedImageSchema = z.object({
  filePath: z.string().min(1).max(512),
  variant: z.enum(ALLOWED_VARIANTS as [string, ...string[]]).optional().default("standard"),
});

export const AiGenerateTagsSchema = z.object({
  filePath: z.string().min(1).max(512),
  variant: z.enum(ALLOWED_VARIANTS as [string, ...string[]]).optional().default("standard"),
  tagThreshold: z.number().min(0).max(1).optional().default(0.3),
});

export const AiLoadModelSchema = z.object({
 variant: z.enum(ALLOWED_VARIANTS as [string, ...string[]]),
});
