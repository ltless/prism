"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthToken } from "@/lib/api";

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
  token: string | null;
  login: (username: string, password: string) => Promise<{ error?: string }>;
  register: (username: string, password: string) => Promise<{ error?: string; success?: boolean }>;
  logout: () => void;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface MeResponse {
  id: string;
  username: string;
  role: string;
  image?: string | null;
  cover_image?: string | null;
  has_completed_setup?: boolean;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/me", { credentials: "include" });
        if (res.ok) {
          const data: MeResponse = await res.json();
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
      const data: MeResponse = await res.json();
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
      const data = await res.json();
      if (!res.ok) return { error: data.message || "Invalid credentials." };
      setAuthToken(data.token);
      setToken(data.token);
      setUser({ id: data.user_id, username: data.username, role: data.role, image: null, coverImage: null, hasCompletedSetup: false });
      refreshProfile();
      return {};
    } catch {
      return { error: "Cannot reach server. Make sure the backend is running." };
    }
  }, [refreshProfile]);

  const register = useCallback(async (username: string, password: string) => {
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.message || "Registration failed." };
      setAuthToken(data.token);
      setToken(data.token);
      setUser({ id: data.user_id, username: data.username, role: data.role, image: null, coverImage: null, hasCompletedSetup: false });
      refreshProfile();
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
    setAuthToken(null);
    setToken(null);
    setUser(null);
    window.location.href = "/login";
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
