import { cookies } from "next/headers";
import type { z } from "zod";
import { validateApiResponse } from "./apiSchemas";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

interface GoFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Fetch JSON from the Go API. Pass `schema` to validate the response body at
 * the boundary (F10); without it, the old `as Promise<T>` cast behavior
 * applies — see apiSchemas.ts for the incremental coverage plan.
 */
export async function goFetch<T = unknown>(
  path: string,
  options: GoFetchOptions = {},
  schema?: z.ZodType<T>,
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${GO_API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }

  const data: unknown = await res.json();
  if (schema) return validateApiResponse(path, schema, data);
  return data as T;
}

/** goFetch for multipart/form-data uploads — body is a FormData, never JSON. */
export async function goFetchUpload<T = unknown>(
  path: string,
  body: FormData,
  schema?: z.ZodType<T>,
): Promise<T> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  const res = await fetch(`${GO_API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string; message?: string }).error || (err as { message?: string }).message || `API error: ${res.status}`);
  }

  const data: unknown = await res.json();
  if (schema) return validateApiResponse(path, schema, data);
  return data as T;
}
