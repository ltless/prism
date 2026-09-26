import { m } from "motion/react";
import type { ReactNode } from "react";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";
import { BrandLogo } from "@/shared/components/BrandLogo";

const PILLARS = [
  "Encrypted at rest, on your own disk",
  "Nothing syncs anywhere",
  "Your photos stay yours",
];

export function AuthShell({
  headline,
  children,
  footer,
}: {
  headline: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const reduced = useReducedMotion();

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-app-bg p-4 sm:p-6">
      <m.div
        initial={{ opacity: 0, y: reduced ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        className="relative grid w-full max-w-4xl gap-1.5 overflow-hidden rounded-[2rem] bg-black/[0.03] p-1.5 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10 md:grid-cols-[1fr_1.1fr]"
      >
        <aside className="hidden flex-col justify-between gap-10 rounded-[calc(2rem-0.375rem)] bg-panel-bg p-9 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] md:flex">
          <BrandLogo size={38} />
          <div>
            <h1 className="max-w-[14ch] text-[2.6rem] font-medium leading-[1.02] tracking-[-0.03em] text-main-text text-balance">
              {headline}
            </h1>
            <ul className="mt-8 flex flex-col gap-3">
              {PILLARS.map((pillar) => (
                <li key={pillar} className="flex items-center gap-2.5 text-[13px] tracking-tight text-muted-text">
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {pillar}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-text/70">
            Prism · local-first
          </p>
        </aside>

        <div className="flex flex-col justify-center gap-7 rounded-[calc(2rem-0.375rem)] bg-panel-bg p-8 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] sm:p-10">
          <div className="md:hidden">
            <BrandLogo size={38} />
          </div>
          {children}
          <div className="border-t border-main-border/60 pt-5 text-[13px] text-muted-text">
            {footer}
          </div>
        </div>
      </m.div>
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  return (
    <p
      role="alert"
      aria-live="assertive"
      className="rounded-full bg-rose-500/10 px-4 py-2.5 text-center text-[12px] font-medium text-rose-500 ring-1 ring-rose-500/20"
    >
      {message}
    </p>
  );
}

export function AuthField({
  id,
  label,
  ...props
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-text">
        {label}
      </label>
      <input
        id={id}
        required
        aria-required="true"
        className="h-11 w-full rounded-full bg-surface-bg px-5 text-[14px] tracking-tight text-main-text ring-1 ring-black/[0.07] outline-none transition-all duration-500 ease-spring placeholder:text-muted-text/50 focus:ring-2 focus:ring-primary/60 dark:ring-white/[0.09]"
        {...props}
      />
    </div>
  );
}

export function AuthSubmit({
  loading,
  children,
}: {
  loading: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="group mt-1 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-[13px] font-medium tracking-tight text-primary-foreground transition-all duration-500 ease-spring hover:opacity-90 disabled:opacity-50 cursor-pointer"
    >
      {loading ? (
        <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-primary-foreground/30 border-t-primary-foreground" />
      ) : (
        children
      )}
    </button>
  );
}
