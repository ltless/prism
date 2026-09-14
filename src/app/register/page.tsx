"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "motion/react";
import { BrandLogo } from "@/shared/components/BrandLogo";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const username = formData.get("username") as string;
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const inviteCode = (formData.get("inviteCode") as string).trim();

    try {
      if (!username || !password || !confirmPassword) {
        setError("All fields are required");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      if (password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }

      const result = await register(username, password, inviteCode || undefined);

      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/setup");
        }, 800);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-6 z-auth-overlay">
        <m.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-3"
        >
          <div className="mx-auto mb-4"><BrandLogo /></div>
          <h2 className="text-base font-semibold text-main-text">Account created</h2>
          <p className="text-[11px] text-muted-text">Redirecting to setup...</p>
        </m.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-6 z-auth-overlay opacity-100">
      <div className="w-full max-w-[320px] flex flex-col gap-8 relative z-10">
          {/* Logo */}
          <div className="flex flex-col items-center gap-3">
            <BrandLogo />
            <h1 className="text-base font-semibold text-main-text">Create account</h1>
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
                placeholder="Choose a username"
                className="w-full h-9 bg-surface-bg border border-main-border/50 rounded-md px-2.5 text-[13px] text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="inviteCode" className="text-[11px] font-medium text-muted-text">
                Invite code
              </label>
              <input
                id="inviteCode"
                name="inviteCode"
                type="text"
                placeholder="Enter invite code"
                className="w-full h-9 bg-surface-bg border border-main-border/50 rounded-md px-2.5 text-[13px] text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-[11px] font-medium text-muted-text">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                aria-required="true"
                placeholder="Create a password"
                className="w-full h-9 bg-surface-bg border border-main-border/50 rounded-md px-2.5 text-[13px] text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirmPassword" className="text-[11px] font-medium text-muted-text">Confirm password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                aria-required="true"
                placeholder="Confirm your password"
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
                "Create Account"
              )}
            </button>
          </form>

          <div className="text-center mt-4 pt-3 border-t border-main-border/30">
            <p className="text-[11px] text-muted-text">
              Already have an account?{" "}
              <Link href="/login" className="text-main-text hover:text-primary transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
