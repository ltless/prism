"use client";

import { useState, useEffect, useRef } from "react";
import { GearSix, SignOut } from "@phosphor-icons/react";
import Image from "next/image";
import { useAuth } from "@/lib/auth/AuthContext";
import type { EffectiveSession } from "@/lib/auth/useEffectiveSession";

interface UserMenuProps {
  session: EffectiveSession;
  onOpenSettings: () => void;
  onOpenChange?: (open: boolean) => void;
  visible?: boolean;
}

function Avatar({ image, name, size }: { image: string | null | undefined; name: string; size: number }) {
  if (image) {
    return (
      <Image
        src={`/api/v1/media/files/${image}`}
        alt=""
        fill
        sizes={`${size}px`}
        className="rounded-full object-cover"
        unoptimized
        priority
      />
    );
  }
  return (
    <span className="flex h-full w-full items-center justify-center rounded-full bg-main-text text-[11px] font-medium text-primary-foreground">
      {name[0]?.toUpperCase() || "U"}
    </span>
  );
}

export function UserMenu({ session, onOpenSettings, onOpenChange, visible = true }: UserMenuProps) {
  const { logout } = useAuth();
  const [isOpen, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => { onOpenChangeRef.current = onOpenChange; }, [onOpenChange]);
  const setIsOpen = (open: boolean) => { setOpen(open); onOpenChangeRef.current?.(open); };
  const name = session?.user?.name || "User";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
    }
    const handleScroll = (event: Event) => {
      const node = event.target;
      if (node instanceof Node && ref.current?.contains(node)) return;
      setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("scroll", handleScroll, { capture: true, once: true });
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const item = "flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-[13px] tracking-[-0.01em] text-main-text/80 hover:bg-main-text/[0.05] hover:text-main-text cursor-pointer";

  return (
    <div className={visible ? "relative" : "relative hidden"} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open user menu"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="relative flex h-9 w-9 cursor-pointer items-center justify-center overflow-hidden rounded-full ring-1 ring-main-text/10"
      >
        <Avatar image={session?.user?.image} name={name} size={36} />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="User menu"
          className="absolute right-0 top-12 z-[200] w-60 rounded-[1.5rem] bg-main-text/[0.05] p-1.5 ring-1 ring-main-text/10"
        >
          <div className="rounded-[calc(1.5rem-0.375rem)] bg-panel-bg p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2.5 px-2.5 py-2">
              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full">
                <Avatar image={session?.user?.image} name={name} size={32} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium tracking-[-0.01em] text-main-text">{name}</span>
                <span className="block truncate text-[10px] uppercase tracking-[0.14em] text-muted-text">{session?.user?.role || "user"}</span>
              </span>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => { onOpenSettings(); setIsOpen(false); }}
              className={item}
            >
              <GearSix size={15} weight="light" />
              Settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => logout()}
              className="flex h-9 w-full items-center gap-2.5 rounded-full px-3 text-[13px] tracking-[-0.01em] text-muted-text hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
            >
              <SignOut size={15} weight="light" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
