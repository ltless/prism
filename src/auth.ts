import { cookies } from "next/headers";

export interface AuthSession {
  user: {
    id: string;
    name: string;
    role: string;
    image: string | null;
    coverImage: string | null;
    hasCompletedSetup: boolean;
  };
}

export async function auth(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;

  try {
    const apiUrl = process.env.GO_API_URL || "http://localhost:8080";
    const res = await fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: { Cookie: `auth_token=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    return {
      user: {
        id: data.id,
        name: data.username,
        role: data.role,
        image: data.image ?? null,
        coverImage: data.cover_image ?? null,
        hasCompletedSetup: data.has_completed_setup ?? false,
      },
    };
  } catch {
    return null;
  }
}
