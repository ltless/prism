"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/core/utils/cn";

const EASE = "cubic-bezier(0.32,0.72,0,1)";

/**
 * Fixed chrome island. Deliberately opaque: no translucency, no backdrop-filter.
 * The name used to be GlassIsland, which was a lie — the fill is solid #0c0c0e.
 */
export function ChromeIsland({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "pointer-events-auto rounded-full p-1",
        "bg-[#0c0c0e] ring-1 ring-white/12",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]",
        className,
      )}
      style={{ transition: `transform 500ms ${EASE}, opacity 500ms ${EASE}` }}
    >
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  );
}

export function IslandButton({
  active,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "group relative flex h-9 w-9 items-center justify-center rounded-full cursor-pointer",
        "text-white/75 hover:text-white",
        "active:scale-[0.96]",
        active ? "bg-white text-[#0c0c0e]" : "hover:bg-white/10",
        className,
      )}
      style={{ transition: `transform 400ms ${EASE}, background-color 400ms ${EASE}, color 400ms ${EASE}` }}
      {...props}
    >
      {children}
    </button>
  );
}

export const CHROME_EASE = EASE;
