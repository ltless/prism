import { logger } from "@/core/utils/logger";

const internalPatterns = [
  "sqlite",
  "drizzle",
  "better-sqlite3",
  "filesystem",
  "node:fs",
  "\\bfs\\b",
  "enoent",
  "eperm",
  "eacces",
  "eexist",
  "eisdir",
  "enotdir",
  "econnrefused",
  "syscall",
  "errno",
  "node:internal",
  "webpack-internal",
];

const stackPatterns = [
  "stack",
  "\\n\\s+at ",
];

function hasMatchIn(patterns: string[], target: string): boolean {
  return patterns.some((p) => new RegExp(p, "i").test(target));
}

export function toSafeMessage(error: unknown): string {
  let raw: string;
  let fallback: string;

  if (error instanceof Error) {
    raw = error.message;
    fallback = error.message;
  } else if (typeof error === "string") {
    raw = error;
    fallback = error;
  } else {
    try { raw = JSON.stringify(error) || String(error); }
    catch { raw = String(error); }
    fallback = "An unexpected error occurred";
  }

  const combined = raw.toLowerCase();
  if (hasMatchIn(internalPatterns, combined)) {
    return "An internal database or system error occurred";
  }
  if (typeof error === "string" && hasMatchIn(stackPatterns, combined)) {
    return "An internal database or system error occurred";
  }
  return fallback;
}

export type ActionResult<T = Record<string, unknown>> =
  | ({ success: true } & T)
  | { success: false; error: string };

export async function safeAction<T extends Record<string, unknown>>(
  label: string,
  fn: () => Promise<T>
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    const { success: _success, ...rest } = data;
    return { ...rest, success: true as const } as ActionResult<T>;
  } catch (error: unknown) {
    logger.error("safeAction error", { label, error: String(error) });
    return { success: false, error: toSafeMessage(error) };
  }
}
