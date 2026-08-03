"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await login(
        formData.get("username") as string,
        formData.get("password") as string,
      );

      if (result?.error) {
        setError(result.error);
      } else if (user && !user.hasCompletedSetup) {
        router.push("/setup");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (user && !user.hasCompletedSetup) {
      router.push("/setup");
    }
  }, [user, router]);

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-6 z-auth-overlay animate-in fade-in duration-300">
      <div className="w-full max-w-[320px] flex flex-col gap-8 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          </div>
          <h1 className="text-base font-semibold text-main-text">Sign in to Prism</h1>
        </div>

        {/* Card */}
        <div className="bg-panel-bg rounded-lg p-5 shadow-card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {error && (
              <div role="alert" aria-live="assertive" className="text-[11px] font-medium text-rose-500 text-center py-2 rounded bg-rose-500/5 border border-rose-500/10 animate-in fade-in slide-in-from-top-2">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-[11px] font-medium text-muted-text">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                aria-required="true"
                placeholder="Enter username"
                className="w-full h-9 bg-surface-bg border border-main-border/50 rounded px-2.5 text-[13px] text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[11px] font-medium text-muted-text">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                aria-required="true"
                placeholder="Enter password"
                className="w-full h-9 bg-surface-bg border border-main-border/50 rounded px-2.5 text-[13px] text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-primary text-primary-foreground rounded flex items-center justify-center gap-2 text-[12px] font-medium hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer mt-1"
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-[1.5px] border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="text-center mt-4 pt-3 border-t border-main-border/30">
            <p className="text-[11px] text-muted-text">
              New here?{" "}
              <Link href="/register" className="text-main-text hover:text-primary transition-colors">
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
