"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { SquaresFour, Lock, Trash, DotsThree, Clock, Star, PencilSimple, Copy, Plus, X } from "@phosphor-icons/react";
import { m, AnimatePresence } from "motion/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { FolderListSection } from "./sidebar/FolderListSection";
import { FolderModal } from "@/features/media/components/FolderModal";

const tabs = [
  { id: "library", label: "Library", icon: SquaresFour, href: "/dashboard", match: (p: string) => p === "/dashboard" },
  { id: "vault", label: "Vault", icon: Lock, href: "/dashboard/vault", match: (p: string) => p === "/dashboard/vault" },
  { id: "trash", label: "Trash", icon: Trash, href: "/dashboard/trash", match: (p: string) => p === "/dashboard/trash" },
] as const;

export function MobileBottomNav({ folders }: { folders: FolderType[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [moreOpen, setMoreOpen] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);

  // Close the sheet when navigation happens (folder/tool links), render-phase
  // reset — the same pattern MediaLibrary uses for fresh page-1 data.
  const [prevNav, setPrevNav] = useState(`${pathname}${searchParams}`);
  if (`${pathname}${searchParams}` !== prevNav) {
    setPrevNav(`${pathname}${searchParams}`);
    setMoreOpen(false);
  }

  return (
    <>
      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 inset-x-0 z-mobile-sidebar px-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] pointer-events-none"
      >
        <div className="pointer-events-auto flex h-16 items-center justify-around rounded-full bg-panel-bg p-1.5 ring-1 ring-main-text/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_16px_40px_rgba(10,10,11,0.08)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_16px_40px_rgba(0,0,0,0.4)]">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.match(pathname);
            return (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full py-1"
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full",
                    active ? "bg-main-text text-app-bg" : "text-muted-text",
                  )}
                >
                  {active ? (
                    <m.span
                      key="active"
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="absolute inset-0 rounded-full bg-main-text"
                    />
                  ) : null}
                  <Icon size={16} weight={active ? "fill" : "light"} className={cn("relative", active && "text-app-bg")} />
                </span>
                <span className={cn("text-[10px] font-medium tracking-[-0.01em]", active ? "text-main-text" : "text-muted-text")}>
                  {tab.label}
                </span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More options"
            aria-expanded={moreOpen}
            className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full py-1"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-full text-muted-text">
              <DotsThree size={16} weight="light" />
            </span>
            <span className="text-[10px] font-medium text-muted-text">More</span>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <>
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMoreOpen(false)}
              className="fixed inset-0 z-modal-backdrop bg-black/40 md:hidden"
            />
            <m.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="mobile-more-title"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-x-2 bottom-2 z-modal flex max-h-[75vh] flex-col overflow-hidden rounded-[1.6rem] bg-panel-bg p-1.5 ring-1 ring-main-text/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_-20px_60px_rgba(10,10,11,0.12)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] pb-[env(safe-area-inset-bottom)]"
            >
              <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-main-text/15" />
              <div className="flex h-11 shrink-0 items-center justify-between px-4">
                <h2 id="mobile-more-title" className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-text">More</h2>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-text hover:bg-main-text/6 hover:text-main-text"
                >
                  <X size={14} weight="light" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scroll px-2 pb-3">
                <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-text/80">Views</p>
                <Link
                  href="/dashboard?v=recent"
                  className="flex h-10 items-center gap-2.5 rounded-full pl-2 pr-2.5 text-muted-text hover:bg-main-text/5 hover:text-main-text"
                >
                  <Clock size={16} weight="light" />
                  <span className="text-[12px] font-medium">Recent</span>
                </Link>
                <Link
                  href="/dashboard?v=favorite"
                  className="flex h-10 items-center gap-2.5 rounded-full pl-2 pr-2.5 text-muted-text hover:bg-main-text/5 hover:text-main-text"
                >
                  <Star size={16} weight="light" />
                  <span className="text-[12px] font-medium">Favorite</span>
                </Link>

                <div className="h-px bg-main-border/50 mx-3 my-2" />

                <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-text/80">Folders</p>
                <FolderListSection
                  folders={folders}
                  dragOverFolderId={null}
                  onDragOver={() => {}}
                  onMoveMedia={undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowFolderModal(true)}
                  className="flex h-10 w-full items-center gap-2.5 rounded-full pl-2 pr-2.5 text-muted-text hover:bg-main-text/5 hover:text-main-text"
                >
                  <Plus size={16} weight="regular" />
                  <span className="text-[12px] font-medium">New folder</span>
                </button>

                <div className="h-px bg-main-border/50 mx-3 my-2" />

                <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-text/80">Tools</p>
                <Link
                  href="/editor"
                  className="flex h-10 items-center gap-2.5 rounded-full pl-2 pr-2.5 text-muted-text hover:bg-main-text/5 hover:text-main-text"
                >
                  <PencilSimple size={16} weight="light" />
                  <span className="text-[12px] font-medium">Editor</span>
                </Link>
                <Link
                  href="/dashboard/duplicates"
                  className="flex h-10 items-center gap-2.5 rounded-full pl-2 pr-2.5 text-muted-text hover:bg-main-text/5 hover:text-main-text"
                >
                  <Copy size={16} weight="light" />
                  <span className="text-[12px] font-medium">Duplicates</span>
                </Link>
              </div>
            </m.div>
          </>
        )}
      </AnimatePresence>

      {showFolderModal && <FolderModal onClose={() => setShowFolderModal(false)} />}
    </>
  );
}