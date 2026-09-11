import { cookies } from "next/headers";

const GO_API_URL = process.env.GO_API_URL || "http://localhost:8080";

interface GoFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function goFetch<T = unknown>(
  path: string,
  options: GoFetchOptions = {},
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

  return res.json() as Promise<T>;
}

/** goFetch for multipart/form-data uploads — body is a FormData, never JSON. */
export async function goFetchUpload<T = unknown>(
  path: string,
  body: FormData,
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

  return res.json() as Promise<T>;
}
