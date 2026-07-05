"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { UserPlus } from "@phosphor-icons/react";

export default function RegisterPage() {
  const { register, user } = useAuth();
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

 if (!username || !password || !confirmPassword) {
 setError("All fields are required");
 setLoading(false);
 return;
 }

 if (password !== confirmPassword) {
 setError("Passwords do not match");
 setLoading(false);
 return;
 }

 if (password.length < 8) {
 setError("Password must be at least 8 characters");
 setLoading(false);
 return;
 }

 const result = await register(username, password);

  if (result?.error) {
  setError(result.error);
  setLoading(false);
  } else {
  setSuccess(true);
  setTimeout(() => {
  router.push("/setup");
  }, 800);
  }
  }

  // Redirect to /setup if user hasn't completed setup, otherwise /dashboard
  useEffect(() => {
    if (user && !user.hasCompletedSetup) {
      router.push("/setup");
    }
  }, [user, router]);

 if (success) {
 return (
 <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-6 z-auth-overlay">
 <motion.div 
 initial={{ opacity: 0, scale: 0.95 }}
 animate={{ opacity: 1, scale: 1 }}
 className="text-center space-y-3"
 >
 <div className="w-14 h-14 bg-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4">
 <svg xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
 </div>
 <h2 className="text-lg font-semibold text-main-text">Identity Created</h2>
 <p className="text-[11px] text-muted-text">Redirecting to sign in...</p>
 </motion.div>
 </div>
 );
 }

 return (
 <div className="fixed inset-0 bg-app-bg flex items-center justify-center p-6 z-auth-overlay animate-in fade-in duration-500">
 <div className="w-full max-w-[360px] flex flex-col gap-10 relative z-10">
 {/* Logo */}
 <div className="flex flex-col items-center gap-3">
 <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
 <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-primary-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
 </div>
 <div className="text-center">
 <h1 className="text-lg font-semibold text-main-text">Register</h1>
 <p className="text-[11px] text-muted-text mt-0.5">Create Your Local Identity</p>
 </div>
 </div>

 {/* Card */}
 <div className="bg-panel-bg rounded-xl p-6 border border-main-border/50">
 <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
 {error && (
 <div className="text-[11px] text-rose-500 text-center py-2.5 rounded-lg bg-rose-500/5 border border-rose-500/10 animate-in fade-in slide-in-from-top-2">
 {error}
 </div>
 )}

  <div className="flex flex-col gap-1.5">
  <label htmlFor="username" className="text-xs font-medium text-muted-text">Username</label>
  <input
  id="username"
  name="username"
  type="text"
  autoComplete="username"
  required
  aria-required="true"
  placeholder="Choose a username"
  className="w-full h-10 bg-surface-bg border border-main-border/50 rounded-lg px-3 text-sm text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
  />
  </div>

  <div className="flex flex-col gap-1.5">
  <label htmlFor="inviteCode" className="text-xs font-medium text-muted-text">Invite Code <span className="text-muted-text/40">(optional)</span></label>
  <input
  id="inviteCode"
  name="inviteCode"
  type="text"
  placeholder="Enter invite code"
  className="w-full h-10 bg-surface-bg border border-main-border/50 rounded-lg px-3 text-sm text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
  />
  </div>

  <div className="flex flex-col gap-1.5">
  <label htmlFor="password" className="text-xs font-medium text-muted-text">Password</label>
  <input
  id="password"
  name="password"
  type="password"
  autoComplete="new-password"
  required
  aria-required="true"
  placeholder="Create a password"
  className="w-full h-10 bg-surface-bg border border-main-border/50 rounded-lg px-3 text-sm text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
  />
  </div>

  <div className="flex flex-col gap-1.5">
  <label htmlFor="confirmPassword" className="text-xs font-medium text-muted-text">Confirm Password</label>
  <input
  id="confirmPassword"
  name="confirmPassword"
  type="password"
  autoComplete="new-password"
  required
  aria-required="true"
  placeholder="Confirm your password"
  className="w-full h-10 bg-surface-bg border border-main-border/50 rounded-lg px-3 text-sm text-main-text placeholder:text-muted-text/40 focus:border-primary outline-none transition-colors"
  />
  </div>

 <button 
 type="submit"
 disabled={loading}
 className="w-full h-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center gap-2 text-[12px] font-medium hover:opacity-90 disabled:opacity-50 transition-colors cursor-pointer mt-2"
 >
 {loading ? (
 <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
 ) : (
 <>
 <UserPlus size={14} weight="light" />
 Create Account
 </>
 )}
 </button>
 </form>

 <div className="text-center mt-6 pt-4 border-t border-main-border/30">
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
