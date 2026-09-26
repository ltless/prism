/** Shared pill/field styles. Solid fills + hairline rings only — no blur, no glass. */

export const pillPrimary =
  "rounded-full bg-primary px-4 py-2 text-[13px] font-medium tracking-tight text-primary-foreground transition-all duration-500 ease-spring hover:opacity-90 disabled:opacity-40 cursor-pointer";

export const pillGhost =
  "rounded-full bg-black/[0.04] px-4 py-2 text-[13px] font-medium tracking-tight text-main-text ring-1 ring-black/[0.06] transition-all duration-500 ease-spring hover:bg-black/[0.07] disabled:opacity-40 cursor-pointer dark:bg-white/[0.07] dark:ring-white/[0.08] dark:hover:bg-white/[0.12]";

export const pillDanger =
  "rounded-full bg-rose-500/10 px-4 py-2 text-[13px] font-medium tracking-tight text-rose-500 transition-all duration-500 ease-spring hover:bg-rose-500 hover:text-white disabled:opacity-40 cursor-pointer";

export const pillDangerSolid =
  "rounded-full bg-rose-500 px-4 py-2 text-[13px] font-medium tracking-tight text-white transition-all duration-500 ease-spring hover:bg-rose-600 disabled:opacity-40 cursor-pointer";

export const field =
  "w-full rounded-full bg-surface-bg px-4 text-[13px] text-main-text ring-1 ring-black/[0.07] outline-none transition-all duration-500 ease-spring placeholder:text-muted-text/60 focus:ring-2 focus:ring-primary/60 focus-visible:outline-none dark:ring-white/[0.09]";
