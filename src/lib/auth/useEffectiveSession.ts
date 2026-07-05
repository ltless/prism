"use client";

import { useAuth } from "./AuthContext";

export interface EffectiveUser {
  id: string;
  name: string | null;
  role: string | null;
  image: string | null;
  coverImage: string | null;
}

export interface EffectiveSession {
  user: EffectiveUser;
  expires: string;
}

interface EffectiveSessionResult {
  session: EffectiveSession | null;
  isLoading: boolean;
}

export function useEffectiveSession(): EffectiveSessionResult {
  const { user, isLoading } = useAuth();

  if (user) {
    return {
      session: {
        user: {
          id: user.id,
          name: user.username,
          role: user.role,
          image: user.image ?? null,
          coverImage: user.coverImage ?? null,
        },
        expires: "",
      },
      isLoading: false,
    };
  }

  return { session: null, isLoading };
}
