const isDev = process.env.NODE_ENV === "development";

function safeStringify(value: unknown): string {
 try { return JSON.stringify(value); } catch { return '{"error":"failed to stringify"}'; }
}

const errorCache = new Map<string, number>();
const ERROR_THROTTLE_MS = 5000;

export const logger = {
 info(message: string, meta?: Record<string, unknown>) {
 if (isDev) { console.log(message, meta ?? ""); }
 else { console.log(safeStringify({ level: "info", message, meta, timestamp: new Date().toISOString() })); }
 },
 warn(message: string, meta?: Record<string, unknown>) {
 if (isDev) { console.warn(message, meta ?? ""); }
 else { console.warn(safeStringify({ level: "warn", message, meta, timestamp: new Date().toISOString() })); }
 },
 error(message: string, meta?: Record<string, unknown>) {
 const entry = { level: "error", message, meta, timestamp: new Date().toISOString() };
 if (isDev) { console.error(message, meta ?? ""); }
 else { console.error(safeStringify(entry)); }
 if (typeof window !== "undefined") {
 const key = message + (meta ? safeStringify(meta) : "");
 const now = Date.now();
 const last = errorCache.get(key) ?? 0;
 if (now - last < ERROR_THROTTLE_MS) return;
 errorCache.set(key, now);
 if (errorCache.size > 100) {
 const oldest = [...errorCache.entries()].sort((a, b) => a[1] - b[1]);
 for (let i = 0; i < 50; i++) errorCache.delete(oldest[i][0]);
 }
 fetch("/api/log", { method: "POST", headers: { "Content-Type": "application/json" }, body: safeStringify(entry) }).catch(() => {});
 }
 },
};
