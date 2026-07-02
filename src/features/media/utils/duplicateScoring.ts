import type { MediaItem } from "../types";

const FORMAT_SCORES: Record<string, number> = {
 'image/x-adobe-dng': 1.0,
 'image/tiff': 0.95,
 'image/png': 0.85,
 'image/heic': 0.8,
 'image/heif': 0.8,
 'image/jpeg': 0.7,
 'image/webp': 0.65,
 'image/gif': 0.5,
 'video/quicktime': 0.75,
 'video/mp4': 0.7,
 'video/webm': 0.6,
};

function getFormatScore(mimeType: string): number {
 return FORMAT_SCORES[mimeType] ?? 0.5;
}

function getMetadataScore(item: MediaItem): number {
 const meta = (item.metadata ?? {}) as Record<string, unknown>;
 let score = 0;

 const keys = Object.keys(meta);
 if (keys.length > 0) score += 0.2;
 if (keys.length > 3) score += 0.2;
 if (keys.length > 6) score += 0.1;

 if (meta.gps || meta.latitude || meta.longitude) score += 0.2;
 if (meta.camera || meta.Make || meta.Model) score += 0.15;
 if (meta.exposureTime || meta.aperture || meta.iso) score += 0.15;

 return Math.min(score, 1);
}

export interface DuplicateScore {
 total: number;
 resolution: number;
 compression: number;
 format: number;
 metadata: number;
}

export function scoreDuplicateItem(item: MediaItem): DuplicateScore {
 const width = item.width ?? 0;
 const height = item.height ?? 0;
 const resolution = width * height;

 const compression = resolution > 0 ? item.size / resolution : 0;

 const format = getFormatScore(item.mimeType);
 const metadata = getMetadataScore(item);

 const resolutionNorm = Math.min(resolution / (4000 * 3000), 1);
 const compressionNorm = compression > 0 ? Math.min(1 / (compression * 0.01), 1) : 0;

 const total = (resolutionNorm * 0.4) + (compressionNorm * 0.25) + (format * 0.2) + (metadata * 0.15);

 return {
 total,
 resolution: resolutionNorm,
 compression: compressionNorm,
 format,
 metadata,
 };
}

export function findBestItem(items: MediaItem[]): { item: MediaItem; score: DuplicateScore } | null {
 if (items.length === 0) return null;

 let best = items[0];
 let bestScore = scoreDuplicateItem(best);

 for (let i = 1; i < items.length; i++) {
 const score = scoreDuplicateItem(items[i]);
 if (score.total > bestScore.total) {
 best = items[i];
 bestScore = score;
 }
 }

 return { item: best, score: bestScore };
}
