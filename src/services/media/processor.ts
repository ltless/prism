import sharp from "sharp";
import exifr from "exifr";
import crypto from "crypto";
import { logger } from "@/core/utils/logger";

interface ExifData {
 make?: unknown;
 model?: unknown;
 software?: unknown;
 exposure?: unknown;
 f_number?: unknown;
 iso?: unknown;
 focal_length?: unknown;
 lens?: unknown;
 date: string | null;
 lat?: unknown;
 lng?: unknown;
 flash?: unknown;
 white_balance?: unknown;
 metering_mode?: unknown;
 exposure_program?: unknown;
 color_space?: unknown;
}

export const MediaProcessor = {
 async generateHash(buffer: Buffer): Promise<string> {
 return crypto.createHash("sha256").update(buffer).digest("hex");
 },

 async extractExif(buffer: Buffer): Promise<ExifData> {
 try {
 const raw = await exifr.parse(buffer, {
 tiff: true,
 exif: true,
 iptc: true,
 xmp: true,
 icc: true,
 jfif: true,
 });

 if (!raw) return { date: null };

 return {
 make: raw.Make || raw.make,
 model: raw.Model || raw.model,
 software: raw.Software || raw.software,
 exposure: raw.ExposureTime || raw.exposure,
 f_number: raw.FNumber || raw.fnumber || raw.f_number,
 iso: raw.ISO || raw.iso || raw.ISOSpeedRatings,
 focal_length: raw.FocalLength || raw.focallength,
 lens: raw.LensModel || raw.lens || raw.Lens,
 date: raw.DateTimeOriginal ? new Date(raw.DateTimeOriginal).toISOString() : null,
 lat: raw.latitude || raw.GPSLatitude,
 lng: raw.longitude || raw.GPSLongitude,
 flash: raw.Flash,
 white_balance: raw.WhiteBalance,
 metering_mode: raw.MeteringMode,
 exposure_program: raw.ExposureProgram,
 color_space: raw.ColorSpace,
 };
 } catch (err) {
 logger.warn("EXIF extraction failed", { error: String(err) });
 return { date: null };
 }
 },

 /**
 * Processes image to get dimensions and dominant color palette.
 */
 async processImage(buffer: Buffer): Promise<{ width: number; height: number; palette: string[] }> {
 const image = sharp(buffer);
 const metadata = await image.metadata();

 const { data } = await sharp(buffer)
 .resize(32, 32, { fit: "cover" })
 .removeAlpha()
 .raw()
 .toBuffer({ resolveWithObject: true });

 const buckets: Record<string, { rSum: number; gSum: number; bSum: number; count: number }> = {};

 for (let i = 0; i + 2 < data.length; i += 3) {
 const r = data[i];
 const g = data[i + 1];
 const b = data[i + 2];

 const qR = Math.round(r / 16) * 16;
 const qG = Math.round(g / 16) * 16;
 const qB = Math.round(b / 16) * 16;
 const bucketKey = `${qR},${qG},${qB}`;

 if (!buckets[bucketKey]) {
 buckets[bucketKey] = { rSum: 0, gSum: 0, bSum: 0, count: 0 };
 }
 buckets[bucketKey].rSum += r;
 buckets[bucketKey].gSum += g;
 buckets[bucketKey].bSum += b;
 buckets[bucketKey].count += 1;
 }

 const sortedBuckets = Object.values(buckets)
 .map((b) => ({
 r: Math.round(b.rSum / b.count),
 g: Math.round(b.gSum / b.count),
 b: Math.round(b.bSum / b.count),
 count: b.count,
 }))
 .sort((a, b) => b.count - a.count);

 const selectedColors: Array<{ r: number; g: number; b: number }> = [];
 const minDistance = 45;

 const getDistance = (c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }) => {
 return Math.sqrt((c1.r - c2.r) ** 2 + (c1.g - c2.g) ** 2 + (c1.b - c2.b) ** 2);
 };

 for (const bucket of sortedBuckets) {
 const isTooSimilar = selectedColors.some((sc) => getDistance(sc, bucket) < minDistance);

 if (!isTooSimilar) {
 selectedColors.push(bucket);
 }

 if (selectedColors.length >= 5) break;
 }

 if (selectedColors.length < 5 && sortedBuckets.length > selectedColors.length) {
 for (const bucket of sortedBuckets) {
 if (!selectedColors.some(sc => sc.r === bucket.r && sc.g === bucket.g && sc.b === bucket.b)) {
 selectedColors.push(bucket);
 }
 if (selectedColors.length >= 5) break;
 }
 }

 const palette = selectedColors.map((c) => {
 const hex = `#${c.r.toString(16).padStart(2, "0")}${c.g.toString(16).padStart(2, "0")}${c.b.toString(16).padStart(2, "0")}`;
 return hex;
 });

 return {
 width: metadata.width || 0,
 height: metadata.height || 0,
 palette,
 };
 }
};
