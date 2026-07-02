"use client";

import { useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { useAuth } from "./AuthContext";

export function useEffectiveSession(): Session | null {
  const { data: session } = useSession();
  const { user: goUser } = useAuth();
  return session ?? (goUser
    ? {
        user: {
          id: goUser.id,
          name: goUser.username,
          role: goUser.role,
          image: goUser.image ?? null,
          coverImage: goUser.coverImage ?? null,
        },
        expires: "",
      } as Session
    : null);
}
