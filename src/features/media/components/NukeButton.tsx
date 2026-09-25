"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@phosphor-icons/react";
import { nukeLibraryAction } from "../services/mediaCrud";
import { useAuth } from "@/lib/auth/AuthContext";
import { toast } from "sonner";

export function NukeButton({ disabled }: { disabled: boolean }) {
  const { user } = useAuth();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isNuking, setIsNuking] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // ponytail: rAF so layout settles before scrolling the confirm buttons into the modal
    if (!isConfirming) return;
    const id = requestAnimationFrame(() =>
      confirmRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" }),
    );
    return () => cancelAnimationFrame(id);
  }, [isConfirming]);

  const username = user?.username ?? "";
  const canConfirm = username !== "" && confirmText.trim() === username;

  const handleNuke = async () => {
    setIsNuking(true);
    try {
      const res = await nukeLibraryAction(confirmText);
      if (res.success) {
        setIsConfirming(false);
        setConfirmText("");
        toast.success("Library reset");
      } else {
        toast.error("Nuke failed: " + res.error);
      }
    } catch {
      toast.error("Nuke failed unexpectedly");
    } finally {
      setIsNuking(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-3">
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        disabled={disabled || isConfirming || isNuking}
        className="shrink-0 rounded-lg bg-rose-500/10 px-3 py-1.5 text-[12px] text-rose-500 transition-colors hover:bg-rose-500 hover:text-white disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
      >
        Reset library
      </button>

      {isConfirming && (
          <div ref={confirmRef} className="w-full rounded-lg border border-main-border bg-app-bg p-3 sm:w-72">
            <p className="text-[13px] font-medium text-main-text">Reset library</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-text">
              Deletes every photo and video in your library. This cannot be undone.
            </p>
            <label className="mt-3 block text-[12px] text-muted-text">
              Type <span className="font-mono text-main-text">{username || "your username"}</span> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canConfirm) void handleNuke();
              }}
              disabled={isNuking}
              placeholder={username || "username"}
              autoFocus
              autoComplete="off"
              className="mt-1.5 mb-3 w-full rounded-lg border border-main-border bg-app-bg px-3 py-1.5 text-[13px] text-main-text outline-none focus:border-border-medium disabled:opacity-50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setIsConfirming(false); setConfirmText(""); }}
                disabled={isNuking}
                className="flex-1 rounded-lg border border-main-border bg-surface-bg px-3 py-1.5 text-[12px] text-muted-text transition-colors hover:text-main-text cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleNuke}
                disabled={isNuking || !canConfirm}
                className="flex-1 rounded-lg bg-rose-500 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-rose-600 disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
              >
                {isNuking ? <Spinner size={12} weight="light" className="mx-auto animate-spin" /> : "Reset"}
              </button>
            </div>
          </div>
      )}
    </div>
  );
}