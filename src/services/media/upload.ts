import crypto from "crypto";
import sharp from "sharp";
import { createThumbnail } from "./thumbnail";
import path from "path";
import fs from "fs/promises";
import { eq } from "drizzle-orm";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "@/services/db/schema";
import { MEDIA_LIMITS } from "@/core/constants";
import { MediaProcessor } from "./processor";
import { getVideoMetadata, checkFFmpeg, extractThumbnail } from "@/services/video/transcode";
import { logger } from "@/core/utils/logger";

const ALLOWED_MIME_TYPES = new Set(MEDIA_LIMITS.ALLOWED_MIME_TYPES);
const ALLOWED_EXTENSIONS = new Set(MEDIA_LIMITS.ALLOWED_EXTENSIONS);
const MAX_FILE_SIZE_BYTES = MEDIA_LIMITS.MAX_FILE_SIZE_BYTES;

type DB = BetterSQLite3Database<typeof schema>;

export interface UploadResult {
 success: boolean;
 isDuplicate?: boolean;
 filename?: string;
 mediaId?: string;
 isVideo?: boolean;
 hash?: string;
 error?: string;
}

export function validateFileType(file: File): string | null {
 if (file.size > MAX_FILE_SIZE_BYTES) return "File too large (max 200MB)";
 if (!ALLOWED_MIME_TYPES.has(file.type)) return "File type not allowed";
 const ext = (file.name.split('.').pop() ?? '').toLowerCase();
 if (!ALLOWED_EXTENSIONS.has(ext)) return "File extension not allowed";
 return null;
}

export function checkMagicBytes(buffer: Buffer): boolean {
 if (buffer.length < 3) {
 // under 3 bytes = not a real file
 return false;
 }

 // JPEG: 0xFF, 0xD8, 0xFF
 if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
 return true;
 }

 if (buffer.length < 4) return false;

 // PNG: 0x89, 0x50, 0x4E, 0x47
 if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
 return true;
 }

 // GIF: 0x47, 0x49, 0x46, 0x38
 if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
 return true;
 }

 // WEBP: Starts with RIFF (0x52, 0x49, 0x46, 0x46) and has WEBP (0x57, 0x45, 0x42, 0x50) at offset 8
 if (buffer.length >= 12 &&
 buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
 buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
 return true;
 }

 // MP4/MOV/HEIC: Container files with ftyp (0x66, 0x74, 0x79, 0x70) starting at offset 4
 if (buffer.length >= 8 &&
 buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
 return true;
 }

 // WEBM: EBML container starting with 0x1A, 0x45, 0xDF, 0xA3
 if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) {
 return true;
 }

 // no known magic bytes matched
 return false;
}

export async function processMediaUpload(
 file: File,
 db: DB,
 mediaDir: string,
 thumbDir: string
): Promise<UploadResult> {
 try {
 const validationError = validateFileType(file);
 if (validationError) return { success: false, error: validationError };

 const bytes = await file.arrayBuffer();
 const buffer = Buffer.from(bytes);

 if (!checkMagicBytes(buffer)) {
 return { success: false, error: "Invalid file signature" };
 }

 const hash = crypto.createHash("sha256").update(buffer).digest("hex");
 const extension = file.name.split('.').pop();
 const isVideo = file.type.startsWith("video/");

 const existing = await db.select().from(schema.media).where(eq(schema.media.hash, hash)).limit(1);
 const isDuplicate = existing.length > 0;

 let filename: string;
 if (isDuplicate) {
 filename = existing[0].filePath;
 } else {
 filename = `${hash}.${extension}`;
 const storagePath = path.join(mediaDir, filename);
 await fs.mkdir(path.dirname(storagePath), { recursive: true });
 await fs.writeFile(storagePath, buffer);

 if (isVideo) {
 const hasFFmpeg = await checkFFmpeg();
 if (hasFFmpeg) {
 try {
 const thumbPath = path.join(thumbDir, `${filename}.webp`);
 await fs.mkdir(path.dirname(thumbPath), { recursive: true });
 await extractThumbnail(storagePath, thumbPath);
 } catch (err) {
 logger.warn("Video thumbnail extraction failed", { error: String(err) });
 }
 }
 } else {
 const thumbFilename = `${filename}.webp`;
 const thumbPath = path.join(thumbDir, thumbFilename);
 await fs.mkdir(path.dirname(thumbPath), { recursive: true });
 const thumbBuffer = await createThumbnail(buffer);
 await fs.writeFile(thumbPath, thumbBuffer);
 }
 }

 let width = 0;
 let height = 0;
 let duration: number | undefined;
 let capturedAt: Date | null = null;
 let metadataJson: Record<string, unknown> | undefined;

 if (isVideo) {
 try {
 const hasFFmpeg = await checkFFmpeg();
 if (hasFFmpeg) {
 const storagePath = path.join(mediaDir, filename);
 const videoMeta = await getVideoMetadata(storagePath);
 width = videoMeta.width;
 height = videoMeta.height;
 duration = videoMeta.duration;
 metadataJson = { codec: videoMeta.codec };
 }
 } catch (err) {
 logger.warn("Video metadata extraction failed", { error: String(err) });
 }
 } else {
 const sharpMeta = await sharp(buffer).metadata();
 const imgProcess = await MediaProcessor.processImage(buffer);
 width = imgProcess.width || sharpMeta.width || 0;
 height = imgProcess.height || sharpMeta.height || 0;

 const exifData = await MediaProcessor.extractExif(buffer);
 capturedAt = exifData?.date ? new Date(exifData.date) : null;
 metadataJson = {
 ...(Object.keys(exifData).length > 0 ? exifData : {}),
 palette: imgProcess.palette || [],
 };
  }

	const mediaId = crypto.randomUUID();
	await db.insert(schema.media).values({
	id: mediaId,
	title: file.name,
 filePath: filename,
 mimeType: file.type || "image/jpeg",
 size: file.size,
 width,
 height,
 hash,
 capturedAt,
 metadata: metadataJson,
 duration,
 transcodeStatus: isVideo ? "pending" : undefined,
 createdAt: new Date(),
 updatedAt: new Date(),
 });

 return { success: true, isDuplicate, filename, mediaId, isVideo, hash };
 } catch (error: unknown) {
 const message = error instanceof Error ? error.message : "Upload failed";
 return { success: false, error: message };
 }
}
