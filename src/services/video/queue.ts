import crypto from "crypto"
import fs from "fs/promises"
import path from "path"
import Database from "better-sqlite3"
import { transcodeToWeb, extractThumbnail, getVideoMetadata, checkFFmpeg } from "./transcode"
import { logger } from "@/core/utils/logger"

export interface TranscodeJob {
 jobId: string
 userId: string
 mediaId: string
 inputPath: string
 outputDir: string
 thumbDir: string
 dbPath: string
 hash: string
 storageLimit: number | null
}

const queue: TranscodeJob[] = []
let isProcessing = false

const ALLOWED_COLUMNS = new Set(["duration", "width", "height", "fileSize", "mimeType"])

function updateTranscodeStatus(dbPath: string, mediaId: string, status: string, extra?: Record<string, unknown>) {
 const db = new Database(dbPath)
 try {
 const sets = ["transcode_status = ?"]
 const params: unknown[] = [status]

 if (extra) {
 for (const [key, value] of Object.entries(extra)) {
 if (!ALLOWED_COLUMNS.has(key)) continue
 if (value !== undefined) {
 sets.push(`${key} = ?`)
 params.push(value)
 }
 }
 }

 params.push(mediaId)
 db.prepare(`UPDATE media SET ${sets.join(", ")} WHERE id = ?`).run(...params)
 } catch (err) {
 logger.error("Failed to update transcode status", { mediaId, status, error: String(err) })
 } finally {
 db.close()
 }
}

async function processJob(job: TranscodeJob): Promise<void> {
 const { jobId, mediaId, inputPath, outputDir, thumbDir, dbPath, hash } = job

 logger.info("Transcode started", { jobId, mediaId })
 updateTranscodeStatus(dbPath, mediaId, "processing")

 const transcodedFilename = `${hash}_web.mp4`
 const outputPath = path.join(outputDir, transcodedFilename)
 const thumbPath = path.join(thumbDir, `${path.basename(inputPath)}.webp`)

 try {
 const meta = await getVideoMetadata(inputPath)
 updateTranscodeStatus(dbPath, mediaId, "processing", {
 duration: meta.duration,
 width: meta.width,
 height: meta.height,
 })

 await fs.mkdir(thumbDir, { recursive: true })
 await extractThumbnail(inputPath, thumbPath)
 logger.info("Thumbnail extracted", { jobId, thumbPath })

 await transcodeToWeb(inputPath, outputPath)

 if (job.storageLimit !== null) {
 const stat = await fs.stat(outputPath)
 const db = new Database(dbPath)
 let row: { total: number }
 try {
 row = db.prepare("SELECT COALESCE(SUM(size), 0) as total FROM media").get() as { total: number }
 } finally {
 db.close()
 }

 if (row.total + stat.size > job.storageLimit) {
 await fs.unlink(outputPath).catch(() => {})
 updateTranscodeStatus(dbPath, mediaId, "failed")
 logger.warn("Transcode output exceeds storage limit, deleted", { jobId })
 return
 }
 }

 updateTranscodeStatus(dbPath, mediaId, "done")
 logger.info("Transcode complete", { jobId, mediaId })
 } catch (err) {
 logger.error("Transcode failed", { jobId, mediaId, error: String(err) })
 updateTranscodeStatus(dbPath, mediaId, "failed")
 await fs.unlink(outputPath).catch(() => {})
 }
}

async function processNext() {
 if (queue.length === 0) {
 isProcessing = false
 return
 }

 isProcessing = true
 const job = queue.shift()
 if (!job) return

 try {
 await processJob(job)
 } catch (err) {
 logger.error("Unexpected transcode queue error", { error: String(err) })
 }

 processNext()
}

export async function enqueueTranscodeJob(job: Omit<TranscodeJob, "jobId">): Promise<string | null> {
 const available = await checkFFmpeg()
 if (!available) {
 logger.info("FFmpeg not available, skipping transcode", { mediaId: job.mediaId })
 return null
 }

 const jobId = crypto.randomUUID()
 queue.push({ ...job, jobId })

 if (!isProcessing) processNext()
 return jobId
}

export function pendingTranscodeJobs(): number {
 return queue.length
}
