"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AuthShell, AuthError, AuthField, AuthSubmit } from "@/shared/components/AuthShell";

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
    <AuthShell
      headline="Your photos, on your disk."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="text-main-text underline decoration-main-border underline-offset-4 transition-colors hover:decoration-main-text">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-text">Sign in</p>
          <h2 className="mt-1.5 text-[22px] font-medium tracking-tight text-main-text">Welcome back</h2>
        </div>

        {error && <AuthError message={error} />}

        <AuthField
          id="username"
          name="username"
          label="Username"
          type="text"
          autoComplete="username"
          placeholder="Enter username"
        />
        <AuthField
          id="password"
          name="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter password"
        />

        <AuthSubmit loading={loading}>Sign in</AuthSubmit>
      </form>
    </AuthShell>
  );
}
