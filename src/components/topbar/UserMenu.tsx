"use client";

import { useState, useEffect, useRef } from "react";
import { GearSix, SignOut } from "@phosphor-icons/react";
import { motion, AnimatePresence } from "motion/react";
import Image from "next/image";
import { useAuth } from "@/lib/auth/AuthContext";
import type { EffectiveSession } from "@/lib/auth/useEffectiveSession";

interface UserMenuProps {
  session: EffectiveSession;
  onOpenSettings: () => void;
}

export function UserMenu({ session, onOpenSettings }: UserMenuProps) {
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      window.addEventListener("scroll", () => setIsOpen(false), { capture: true, once: true });
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open user menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="relative w-7 h-7 rounded-full flex items-center justify-center p-0.5 hover:ring-2 hover:ring-primary/15 transition-all duration-150 cursor-pointer overflow-hidden"
      >
        {session?.user?.image ? (
          <Image src={`/api/v1/media/files/${session.user.image}`} alt="User avatar" fill className="rounded-full object-cover" unoptimized priority />
        ) : (
          <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-[10px] font-semibold text-primary-foreground overflow-hidden">
            {session?.user?.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="menu"
            aria-label="User menu"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-9 right-0 w-44 bg-panel-bg border border-main-border/50 shadow-elevated rounded overflow-hidden z-[200]"
          >
            <div className="px-3 py-2 border-b border-main-border/30">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full shrink-0 relative overflow-hidden">
                  {session?.user?.image ? (
                    <Image src={`/api/v1/media/files/${session.user.image}`} alt="User avatar" fill className="rounded-full object-cover" unoptimized priority />
                  ) : (
                    <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-[10px] font-semibold text-primary-foreground">
                      {session?.user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-main-text truncate">{session?.user?.name || "User"}</p>
                  <p className="text-[10px] text-muted-text truncate">{session?.user?.role || "user"}</p>
                </div>
              </div>
            </div>

            <div className="p-0.5">
              <button
                role="menuitem"
                onClick={() => { onOpenSettings(); setIsOpen(false); }}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded transition-colors text-left group cursor-pointer hover:bg-surface-bg"
              >
                <GearSix size={13} weight="light" className="text-muted-text group-hover:text-main-text transition-colors" />
                <span className="text-[11px] font-medium text-muted-text group-hover:text-main-text">Settings</span>
              </button>
              <button
                role="menuitem"
                onClick={() => logout()}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded transition-colors text-left group cursor-pointer hover:bg-rose-500/5"
              >
                <SignOut size={13} weight="light" className="text-muted-text group-hover:text-rose-500 transition-colors" />
                <span className="text-[11px] font-medium text-muted-text group-hover:text-rose-500">Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
