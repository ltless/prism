"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
 SquaresFour,
 Clock,
  Star,
  Copy,
 Lock,
  Trash,
  CaretDown,
  Plus,
  X,
  CaretLeft,
  CaretRight
} from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import type { Folder as FolderType } from "@/features/media/types";
import { FolderModal } from "@/features/media/components/FolderModal";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebar } from "@/components/sidebar-context";
import { SidebarLogo } from "@/components/sidebar/SidebarLogo";
import { SidebarNavItem } from "@/components/sidebar/SidebarNavItem";
import { FolderListSection } from "@/components/sidebar/FolderListSection";

const SIDEBAR_WIDTH = 260;

const menuSections = [
 {
 title: 'Space',
 items: [
  { name: 'Library', icon: SquaresFour, path: '/dashboard' },
  { name: 'Recent', icon: Clock, path: '/dashboard?v=recent' },
 { name: 'Favorite', icon: Star, path: '/dashboard?v=favorite' },
  { name: 'Vault', icon: Lock, path: '/dashboard/vault' },
 { name: 'Trash', icon: Trash, path: '/dashboard/trash' }
 ]
 },
 {
 title: 'Folders',
 isFolderSection: true,
 items: []
 },
 {
 title: 'Tools',
 items: [
  { name: 'Duplicates', icon: Copy, path: '/dashboard/duplicates' }
 ]
 }
];

export function Sidebar({ folders = [], onMoveMedia }: { folders?: FolderType[], onMoveMedia?: (ids: string[], folderId: string | null) => void }) {
 const searchParams = useSearchParams();
 const activeFolderId = searchParams.get('f');
 const [foldersExpanded, setFoldersExpanded] = useState(true);
 const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [colBtnHovered, setColBtnHovered] = useState(false);

  const { isMobileOpen, setMobileOpen, isCollapsed, setIsCollapsed } = useSidebar();

  // Close mobile sidebar on Escape
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isMobileOpen, setMobileOpen]);

  return (
 <>
 {/* Mobile backdrop */}
 <AnimatePresence>
 {isMobileOpen && (
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
 onClick={() => setMobileOpen(false)}
 className="fixed inset-0 bg-black/60 z-sidebar md:hidden"
 />
 )}
 </AnimatePresence>

  {/* Desktop sidebar */}
  <aside
  className={cn(
  "hidden md:flex flex-col z-sidebar relative",
  "fixed top-0 bottom-0 left-0",
  "bg-app-bg border-r border-main-border/30 shadow-xl",
  "transition-[width] duration-300 ease-out-expo"
  )}
  style={{ width: isCollapsed ? 64 : SIDEBAR_WIDTH }}
  >
  <button
  onClick={() => setIsCollapsed(!isCollapsed)}
  onMouseEnter={() => setColBtnHovered(true)}
  onMouseLeave={() => setColBtnHovered(false)}
  aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
  className="absolute inset-y-0 my-auto right-0 translate-x-[55%] z-40 flex items-center justify-center w-5 h-10 rounded-full bg-panel-bg text-main-text hover:bg-surface-bg transition-all duration-300 cursor-pointer shadow-md"
  >
  {isCollapsed ? <CaretRight size={12} weight="bold" /> : <CaretLeft size={12} weight="bold" />}
  </button>

  <div className={cn("absolute right-0 top-1/2 -translate-y-1/2 w-[2px] h-1/2 bg-gradient-to-b from-transparent via-primary/40 to-transparent pointer-events-none transition-opacity duration-300 z-30", colBtnHovered ? "opacity-100" : "opacity-0")} />

  <div className="relative flex flex-col h-full">
  <SidebarLogo isExpanded={!isCollapsed} />

  <div className={cn("flex-1 overflow-y-auto custom-scroll py-2", isCollapsed ? "px-1" : "px-2")}>
  {menuSections.map((section, idx) => (
  <div key={idx} className={cn("mb-4", isCollapsed && "mb-2")}>
  {!isCollapsed && (
  <div className="flex items-center justify-between mb-2 px-3">
  {section.isFolderSection ? (
  <>
  <button
  onClick={() => setFoldersExpanded(!foldersExpanded)}
  aria-label={foldersExpanded ? "Collapse folders" : "Expand folders"}
  className="flex items-center gap-2 group/title cursor-pointer"
  >
  <h3 className="text-xs font-bold text-muted-text group-hover/title:text-main-text transition-colors">{section.title}</h3>
  <div className={cn(
  "p-1 hover:bg-surface-bg rounded-md text-muted-text group-hover/title:text-main-text transition-transform duration-300 ease-out-expo",
  foldersExpanded ? "rotate-0" : "-rotate-90"
  )}>
  <CaretDown size={12} weight="bold" />
  </div>
  </button>
  <button
  onClick={() => setShowFolderModal(true)}
  aria-label="Create Folder"
  className="p-1 hover:bg-surface-bg rounded-md transition-colors group/add cursor-pointer"
  >
  <Plus size={12} weight="bold" className="text-muted-text/60 group-hover/add:text-primary" />
  </button>
  </>
  ) : (
  <h3 className="text-xs font-bold text-muted-text ">{section.title}</h3>
  )}
  </div>
  )}

  <div className="space-y-0.5">
  {section.isFolderSection ? (
  <FolderListSection
  folders={folders}
  foldersExpanded={foldersExpanded}
  dragOverFolderId={dragOverFolderId}
  onDragOver={setDragOverFolderId}
   onMoveMedia={onMoveMedia}
   isExpanded={!isCollapsed}
   />
   ) : (
   section.items.map((item) => (
   <SidebarNavItem
   key={item.path}
   item={item}
   activeFolderId={activeFolderId}
   isExpanded={!isCollapsed}
  />
  ))
  )}
  </div>
  </div>
  ))}
  </div>
  </div>
 </aside>

 {/* Mobile sidebar (slide-in, same as before) */}
 <AnimatePresence>
 {isMobileOpen && (
 <motion.aside
 initial={{ x: "-100%" }}
 animate={{ x: 0 }}
 exit={{ x: "-100%" }}
  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 className="fixed inset-y-0 left-0 w-72 flex flex-col bg-app-bg z-mobile-sidebar md:hidden shadow-2xl"
 >
 <button
 onClick={() => setMobileOpen(false)}
 aria-label="Close sidebar"
 className="absolute top-6 right-6 z-10 p-2 bg-main-border/30 rounded-full text-muted-text hover:text-main-text transition-colors cursor-pointer"
 >
 <X size={16} weight="light" />
 </button>

 <SidebarLogo isExpanded={true} />

 <div className="flex-1 overflow-y-auto px-4 space-y-6 custom-scroll">
 {menuSections.map((section, idx) => (
 <div key={idx}>
 <div className="flex items-center justify-between mb-3 px-2">
 {section.isFolderSection ? (
 <>
 <button
 onClick={() => setFoldersExpanded(!foldersExpanded)}
 className="flex items-center gap-2 group/title cursor-pointer"
 >
 <h3 className="text-xs font-bold text-muted-text group-hover/title:text-main-text transition-colors">{section.title}</h3>
 <div className={cn(
 "p-1 hover:bg-surface-bg rounded-md text-muted-text group-hover/title:text-main-text transition-transform duration-300",
 foldersExpanded ? "rotate-0" : "-rotate-90"
 )}>
 <CaretDown size={12} weight="bold" />
 </div>
 </button>
 <button
 onClick={() => setShowFolderModal(true)}
 className="p-1 hover:bg-surface-bg rounded-md transition-colors group/add cursor-pointer"
 >
 <Plus size={12} weight="bold" className="text-muted-text/60 group-hover/add:text-primary" />
 </button>
 </>
 ) : (
 <h3 className="text-xs font-bold text-muted-text ">{section.title}</h3>
 )}
 </div>

 <div className="space-y-0.5">
 {section.isFolderSection ? (
 <FolderListSection
 folders={folders}
 foldersExpanded={foldersExpanded}
 dragOverFolderId={dragOverFolderId}
 onDragOver={setDragOverFolderId}
 onMoveMedia={onMoveMedia}
 isExpanded={true}
 />
 ) : (
 section.items.map((item) => (
 <SidebarNavItem
 key={item.path}
 item={item}
 activeFolderId={activeFolderId}
 isExpanded={true}
 />
 ))
 )}
 </div>
 </div>
 ))}
 </div>
 </motion.aside>
 )}
 </AnimatePresence>

 {showFolderModal && <FolderModal onClose={() => setShowFolderModal(false)} />}
 </>
 );
}
