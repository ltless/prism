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
  if (error instanceof Error) {
    const combined = error.message.toLowerCase();
    if (hasMatchIn(internalPatterns, combined)) {
      return "An internal database or system error occurred";
    }
    return error.message;
  }

  if (typeof error === "string") {
    const combined = error.toLowerCase();
    if (hasMatchIn(internalPatterns, combined)) {
      return "An internal database or system error occurred";
    }
    if (hasMatchIn(stackPatterns, combined)) {
      return "An internal database or system error occurred";
    }
    return error;
  }

  const stringified = (() => {
    try { return JSON.stringify(error) || String(error); }
    catch { return String(error); }
  })();
  const combined = stringified.toLowerCase();
  if (hasMatchIn(internalPatterns, combined)) {
    return "An internal database or system error occurred";
  }
  return "An unexpected error occurred";
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
