import { spawn, execFile } from "child_process"
import { VIDEO_LIMITS } from "@/core/constants"
import { logger } from "@/core/utils/logger"

let ffmpegAvailable: boolean | null = null

export async function checkFFmpeg(): Promise<boolean> {
 if (ffmpegAvailable !== null) return ffmpegAvailable

 return new Promise((resolve) => {
 execFile("ffmpeg", ["-version"], (error) => {
 ffmpegAvailable = !error
 if (!ffmpegAvailable) {
 logger.warn("FFmpeg not found on system — video transcoding disabled")
 }
 resolve(ffmpegAvailable)
 })
 })
}



export interface VideoMetadata {
 duration: number
 width: number
 height: number
 codec: string
}

export async function getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
 return new Promise((resolve, reject) => {
 const args = [
 "-v", "error",
 "-select_streams", "v:0",
 "-show_entries", "stream=width,height,codec_name,duration",
 "-show_entries", "format=duration",
 "-of", "json",
 inputPath,
 ]

 const proc = spawn("ffprobe", args)
 let stdout = ""
 let stderr = ""

 proc.stdout.on("data", (chunk) => { stdout += chunk })
 proc.stderr.on("data", (chunk) => { stderr += chunk })

 proc.on("close", (code) => {
 if (code !== 0) {
 return reject(new Error(`ffprobe failed (code ${code}): ${stderr}`))
 }

 try {
 const data = JSON.parse(stdout)
 const stream = data.streams?.[0] ?? {}
 const format = data.format ?? {}
 const duration = parseFloat(stream.duration || format.duration || "0")

 resolve({
 duration: Math.round(duration),
 width: stream.width || 0,
 height: stream.height || 0,
 codec: stream.codec_name || "unknown",
 })
 } catch {
 reject(new Error(`Failed to parse ffprobe output: ${stdout}`))
 }
 })
 })
}

export async function transcodeToWeb(
 inputPath: string,
 outputPath: string,
): Promise<void> {
 return new Promise((resolve, reject) => {
 const args = [
 "-i", inputPath,
 "-threads", "2",
 "-c:v", "libx264",
 "-preset", VIDEO_LIMITS.TRANSCODE_PRESET,
 "-crf", String(VIDEO_LIMITS.TRANSCODE_CRF),
 "-c:a", "aac",
 "-b:a", VIDEO_LIMITS.AUDIO_BITRATE,
 "-movflags", "+faststart",
 "-y",
 outputPath,
 ]

 const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] })
 let stderr = ""

 proc.stderr.on("data", (chunk) => { stderr += chunk })

 const timeout = setTimeout(() => {
 proc.kill("SIGKILL")
 reject(new Error("Transcode timed out after 10 minutes"))
 }, VIDEO_LIMITS.MAX_TRANSCODE_TIMEOUT_MS)

 proc.on("close", (code) => {
 clearTimeout(timeout)
 if (code !== 0) {
 return reject(new Error(`FFmpeg transcode failed (code ${code}): ${stderr.slice(-500)}`))
 }
 resolve()
 })

 proc.on("error", (err) => {
 clearTimeout(timeout)
 reject(err)
 })
 })
}

export async function extractThumbnail(
 inputPath: string,
 outputPath: string,
): Promise<void> {
 return new Promise((resolve, reject) => {
 const seekTime = String(VIDEO_LIMITS.THUMBNAIL_SEEK_SECONDS)
 const args = [
 "-i", inputPath,
 "-ss", seekTime,
 "-vframes", "1",
 "-vf", "scale=400:400:force_original_aspect_ratio=decrease,pad=400:400:(ow-iw)/2:(oh-ih)/2:color=black",
 "-c:v", "libwebp",
 "-quality", "80",
 "-y",
 outputPath,
 ]

 const proc = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] })

 proc.on("close", (code) => {
 if (code !== 0) return reject(new Error(`Thumbnail extraction failed (code ${code})`))
 resolve()
 })

 proc.on("error", reject)
 })
}
