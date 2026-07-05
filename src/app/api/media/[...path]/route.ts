import { auth } from "@/auth";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { createThumbnail } from "@/services/media/thumbnail";
import { getUserPaths, getUserDb } from "@/services/db/multitenant";
import { logger } from "@/core/utils/logger";
import { db as globalDb } from "@/services/db";
import { users as usersSchema, media as mediaSchema } from "@/services/db/schema";
import { eq } from "drizzle-orm";
import type { ReadStream } from "fs";

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm"]);

function streamToReadable(stream: ReadStream): ReadableStream {
  return new ReadableStream({
  start(controller) {
  stream.on("data", (chunk) => { try { controller.enqueue(chunk); } catch {} });
  stream.on("end", () => { try { controller.close(); } catch {} });
  stream.on("error", (err: Error) => { try { controller.error(err); } catch {} });
  },
  cancel() { stream.destroy(); }
  });
}
function routeError(context: string) {
  return (err: unknown) => logger.error(`[...path] ${context} failed`, { error: err instanceof Error ? err.message : String(err) });
}

export async function GET(
 request: Request,
 { params }: { params: Promise<{ path: string[] }> }
) {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) return new Response("Unauthorized", { status: 401 });

 const { searchParams } = new URL(request.url);
 const isThumbnail = searchParams.get("thumb") === "1";

 const resolvedParams = await params;

 // Sanitize path segments — no traversal on our watch
 const rawFilename = path.join(...resolvedParams.path);
 const normalized = path.normalize(rawFilename);
 if (normalized.includes('..') || path.isAbsolute(normalized)) {
 return new Response("Forbidden", { status: 403 });
 }

 const { mediaDir, thumbDir } = await getUserPaths(userId);
 const { db } = await getUserDb(userId);
 const absolutePath = path.join(mediaDir, normalized);

 const resolvedMediaDir = path.resolve(mediaDir);
 if (!path.resolve(absolutePath).startsWith(resolvedMediaDir + path.sep) &&
 path.resolve(absolutePath) !== resolvedMediaDir) {
 return new Response("Forbidden", { status: 403 });
 }

 // check if this is the profile pic or a real media file
 const dbUser = globalDb.select({
 image: usersSchema.image,
 coverImage: usersSchema.coverImage
 })
 .from(usersSchema)
 .where(eq(usersSchema.id, userId))
 .limit(1)
 .get();

  const formattedNormalized = normalized.replace(/\\/g, "/");

  const isProfileOrCover = dbUser && (
  (dbUser.image && dbUser.image.replace(/\\/g, "/") === formattedNormalized) ||
  (dbUser.coverImage && dbUser.coverImage.replace(/\\/g, "/") === formattedNormalized)
  );

  if (!isProfileOrCover) {
 const dbMedia = db.select()
 .from(mediaSchema)
 .where(eq(mediaSchema.filePath, normalized))
 .limit(1)
 .get();

 if (!dbMedia) {
 return new Response("Forbidden", { status: 403 });
 }
 }

 try {
 if (isThumbnail) {
 const thumbnailPath = path.join(thumbDir, `${normalized}.webp`);

 // make sure the thumbnail isn't trying to escape to the parent directory
 const resolvedThumbDir = path.resolve(thumbDir);
 const resolvedThumbPath = path.resolve(thumbnailPath);
 if (!resolvedThumbPath.startsWith(resolvedThumbDir + path.sep) &&
 resolvedThumbPath !== resolvedThumbDir) {
 return new Response("Forbidden", { status: 403 });
 }

 try {
 await fsp.access(thumbnailPath);
  const stream = fs.createReadStream(thumbnailPath);
  return new NextResponse(streamToReadable(stream), {
 headers: {
 "Content-Type": "image/webp",
 "Cache-Control": "private, max-age=31536000, immutable",
 },
 });
 } catch {
 // For videos, we can't generate a thumbnail with sharp.
 // SVG placeholder for missing video thumbnails.
 const ext = path.extname(absolutePath).toLowerCase();
  if (VIDEO_EXTS.has(ext)) {
 try {
 await fsp.access(absolutePath);
 const svgPlaceholder = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400"><rect width="400" height="400" fill="#151518"/><circle cx="200" cy="200" r="40" fill="#27272a" stroke="#3f3f46" stroke-width="2"/><polygon points="192,185 192,215 215,200" fill="#a1a1aa"/><text x="200" y="270" fill="#71717a" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" text-anchor="middle" letter-spacing="0.05em">VIDEO</text></svg>`;
 return new NextResponse(svgPlaceholder, {
 headers: {
 "Content-Type": "image/svg+xml",
 "Cache-Control": "private, max-age=60",
 },
 });
 } catch (err) {
 routeError("video existence check")(err);
 return new Response("Not Found", { status: 404 });
 }
 }

 // Generate thumbnail if it doesn't exist (images only)
 const originalFile = await fsp.readFile(absolutePath);
 const thumbBuffer = await createThumbnail(originalFile);

 fsp.writeFile(thumbnailPath, thumbBuffer).catch(err => 
 logger.error("Failed to save thumbnail", { error: String(err) })
 );

 return new NextResponse(new Uint8Array(thumbBuffer), {
 headers: {
 "Content-Type": "image/webp",
 "Cache-Control": "private, max-age=31536000, immutable",
 },
 });
 }
 }

  let servePath = absolutePath;
  const ext = path.extname(absolutePath).toLowerCase();

  if (VIDEO_EXTS.has(ext)) {
 const basename = path.basename(absolutePath, ext);
 const webPath = path.join(mediaDir, `${basename}_web.mp4`);
 try {
 await fsp.access(webPath);
 servePath = webPath;
 } catch (err) {
 routeError("transcode access")(err);
 }
 }

 const stats = await fsp.stat(servePath);
 const mimeMap: Record<string, string> = {
 ".jpg": "image/jpeg",
 ".jpeg": "image/jpeg",
 ".png": "image/png",
 ".gif": "image/gif",
 ".webp": "image/webp",
 ".heic": "image/heic",
 ".heif": "image/heif",
 ".mp4": "video/mp4",
 ".mov": "video/quicktime",
 ".webm": "video/webm",
 };
 const serveExt = path.extname(servePath).toLowerCase();
 const contentType = mimeMap[serveExt] || "application/octet-stream";

 // Range Request support for video seeking
 const rangeHeader = request.headers.get("range");
 if (rangeHeader && contentType.startsWith("video/")) {
 const parts = rangeHeader.replace(/bytes=/, "").split("-");
 const start = parseInt(parts[0], 10);
 if (!Number.isFinite(start) || start < 0) {
 return new NextResponse("Invalid range", { status: 416 });
 }
 let end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
 if (!Number.isFinite(end)) {
 return new NextResponse("Invalid range", { status: 416 });
 }

 if (end >= stats.size) {
 end = stats.size - 1;
 }

 if (start >= stats.size || start > end) {
 return new NextResponse(null, {
 status: 416,
 headers: {
 "Content-Range": `bytes */${stats.size}`,
 "Accept-Ranges": "bytes",
 },
 });
 }

 const chunkSize = end - start + 1;

  const stream = fs.createReadStream(servePath, { start, end });
  return new NextResponse(streamToReadable(stream), {
 status: 206,
 headers: {
 "Content-Range": `bytes ${start}-${end}/${stats.size}`,
 "Accept-Ranges": "bytes",
 "Content-Length": chunkSize.toString(),
 "Content-Type": contentType,
 },
 });
 }

  const stream = fs.createReadStream(servePath);
  return new NextResponse(streamToReadable(stream), {
 headers: {
 "Content-Type": contentType,
 "Content-Length": stats.size.toString(),
 "Accept-Ranges": "bytes",
 "Cache-Control": "private, max-age=31536000, immutable",
 },
 });
 } catch (error) {
 logger.error("Media API error", { error: String(error) });
 return new Response("Not Found", { status: 404 });
 }
}
