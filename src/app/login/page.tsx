"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrandLogo } from "@/shared/components/BrandLogo";

export default function LoginPage() {
  const { login } = useAuth();
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
      } else {
        // dashboard layout redirects incomplete setup to /setup
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-6 z-auth-overlay opacity-100">
      <div className="w-full max-w-[320px] flex flex-col gap-8 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <BrandLogo />
          <h1 className="text-base font-semibold text-main-text">Sign in to Prism</h1>
        </div>

        {/* Card */}
        <div className="bg-panel-bg rounded-xl p-6 shadow-elevated border border-main-border">
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {error && (
              <div role="alert" aria-live="assertive" className="text-[11px] font-medium text-rose-500 text-center py-2 rounded-md bg-rose-500/5 border border-rose-500/10 animate-in fade-in slide-in-from-top-2">
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
                className="w-full h-9 bg-surface-bg border border-main-border/50 rounded-md px-2.5 text-[13px] text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
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
                className="w-full h-9 bg-surface-bg border border-main-border/50 rounded-md px-2.5 text-[13px] text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-primary text-primary-foreground rounded-md flex items-center justify-center gap-2 text-[12px] font-medium hover:opacity-90 active:scale-[0.98] disabled:opacity-50 transition-[opacity,transform] cursor-pointer mt-1"
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
