"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { m } from "motion/react";
import { Check } from "@phosphor-icons/react";
import { AuthShell, AuthError, AuthField, AuthSubmit } from "@/shared/components/AuthShell";
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
      <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-app-bg p-6">
        <m.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.32, 0.72, 0, 1] }}
          className="flex w-full max-w-sm flex-col items-center gap-6 rounded-[2rem] bg-black/[0.03] p-1.5 text-center ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10"
        >
          <div className="flex w-full flex-col items-center gap-5 rounded-[calc(2rem-0.375rem)] bg-panel-bg px-8 py-12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            <BrandLogo size={44} />
            <m.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 480, damping: 26, delay: 0.12 }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check size={16} weight="bold" />
            </m.span>
            <h2 className="text-[20px] font-medium tracking-tight text-main-text">Account created</h2>
            <p className="text-[13px] text-muted-text">Taking you to setup…</p>
          </div>
        </m.div>
      </div>
    );
  }

  return (
    <AuthShell
      headline="Start your local library."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="text-main-text underline decoration-main-border underline-offset-4 transition-colors hover:decoration-main-text">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-text">Register</p>
          <h2 className="mt-1.5 text-[22px] font-medium tracking-tight text-main-text">Create an account</h2>
        </div>

        {error && <AuthError message={error} />}

        <AuthField
          id="username"
          name="username"
          label="Username"
          type="text"
          autoComplete="username"
          placeholder="Choose a username"
        />
        <AuthField
          id="inviteCode"
          name="inviteCode"
          label="Invite code"
          type="text"
          placeholder="Enter invite code"
          required={false}
          aria-required={false}
        />
        <AuthField
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <AuthField
          id="confirmPassword"
          name="confirmPassword"
          label="Confirm"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat your password"
        />

        <AuthSubmit loading={loading}>Create account</AuthSubmit>
      </form>
    </AuthShell>
  );
}
