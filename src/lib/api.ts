import { cookies } from "next/headers";
import type { z } from "zod";
import { validateApiResponse } from "./apiSchemas";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

const VAULT_TOKEN_COOKIE = "vault_token";
const VAULT_TOKEN_HEADER = "X-Vault-Token";
const VAULT_TOKEN_TTL_SECONDS = 15 * 60;

interface GoFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/** The short-lived vault-unlock token from Next's cookie store, if present. */
async function vaultTokenHeader(): Promise<Record<string, string>> {
  const ck = (await cookies()).get(VAULT_TOKEN_COOKIE)?.value;
  return ck ? { [VAULT_TOKEN_HEADER]: ck } : {};
}

/**
 * Replay Go's Set-Cookie for the vault_token into Next's response. Go mints
 * the token on PIN verify and expires it on lock / PIN disable; the browser
 * only ever sees it after this replays it from a server-action response.
 */
export async function mirrorVaultCookie(setCookie: string | null): Promise<void> {
  if (!setCookie) return;
  const first = setCookie.split(";")[0];
  const eq = first.indexOf("=");
  if (eq === -1) return;
  if (first.slice(0, eq).trim() !== VAULT_TOKEN_COOKIE) return;

  const value = first.slice(eq + 1);
  const cookieStore = await cookies();
  if (value === "") {
    cookieStore.delete(VAULT_TOKEN_COOKIE);
    return;
  }
  cookieStore.set(VAULT_TOKEN_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: VAULT_TOKEN_TTL_SECONDS,
  });
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
  return (await goFetchWithSetCookie(path, options, schema)).data;
}

/**
 * like goFetch, but also returns Go's Set-Cookie header so server actions can
 * replay HttpOnly cookies (the vault unlock token) into Next's response.
 */
export async function goFetchWithSetCookie<T = unknown>(
  path: string,
  options: GoFetchOptions = {},
  schema?: z.ZodType<T>,
): Promise<{ data: T; setCookie: string | null }> {
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
    headers: { ...headers, ...(await vaultTokenHeader()), ...(options.headers as Record<string, string>) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }

  const data: unknown = await res.json();
  if (schema) return { data: validateApiResponse(path, schema, data), setCookie: res.headers.get("set-cookie") };
  return { data: data as T, setCookie: res.headers.get("set-cookie") };
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
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(await vaultTokenHeader()) },
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
