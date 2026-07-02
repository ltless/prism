"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { meResponseSchema, validateApiResponse } from "@/lib/apiSchemas";

interface User {
  id: string;
  username: string;
  role: string;
  image: string | null;
  coverImage: string | null;
  hasCompletedSetup: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, password: string, inviteCode?: string) => Promise<{ error?: string; success?: boolean }>;
  logout: () => void;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface LoginResponse {
  message?: string;
  user_id?: string;
  username?: string;
  role?: string;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (res.ok) {
          const data = validateApiResponse("/api/v1/auth/me", meResponseSchema, await res.json());
          if (!cancelled) {
            setUser({
              id: data.id,
              username: data.username,
              role: data.role,
              image: data.image ?? null,
              coverImage: data.cover_image ?? null,
              hasCompletedSetup: data.has_completed_setup ?? false,
            });
          }
        }
      } catch {
        // network error — leave user null
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me", { credentials: "include" });
      if (!res.ok) return;
      const data = validateApiResponse("/api/v1/auth/me", meResponseSchema, await res.json());
      setUser(prev => prev ? {
        ...prev,
        image: data.image ?? null,
        coverImage: data.cover_image ?? null,
        hasCompletedSetup: data.has_completed_setup ?? prev.hasCompletedSetup,
      } : prev);
    } catch {
      // non-fatal
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data: LoginResponse | null = await res.json().catch(() => null);
        return { error: data?.message || "Invalid username or password." };
      }
      const data: LoginResponse = await res.json().catch(() => null as unknown as LoginResponse);
      if (!data?.user_id || !data.username || !data.role) {
        return { error: "Malformed server response." };
      }
      setUser({ id: data.user_id, username: data.username, role: data.role, image: null, coverImage: null, hasCompletedSetup: false });
      await refreshProfile();
      return {};
    } catch {
      return { error: "Cannot reach server. Make sure the backend is running." };
    }
  }, [refreshProfile]);

  const register = useCallback(async (username: string, password: string, inviteCode?: string) => {
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password, invite_code: inviteCode || undefined }),
      });
      if (!res.ok) {
        const data: LoginResponse | null = await res.json().catch(() => null);
        return { error: data?.message || `Registration failed: ${res.status}` };
      }
      const data: LoginResponse = await res.json().catch(() => null as unknown as LoginResponse);
      if (!data?.user_id || !data.username || !data.role) {
        return { error: "Malformed server response." };
      }
      setUser({ id: data.user_id, username: data.username, role: data.role, image: null, coverImage: null, hasCompletedSetup: false });
      await refreshProfile();
      return { success: true };
    } catch {
      return { error: "Cannot reach server. Make sure the backend is running." };
    }
  }, [refreshProfile]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // ignore — clear local state anyway
    }
    setUser(null);
    window.location.href = "/login";
  }, []);

  const value = useMemo(
    () => ({ user, login, register, logout, isLoading, refreshProfile }),
    [user, login, register, logout, isLoading, refreshProfile],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
