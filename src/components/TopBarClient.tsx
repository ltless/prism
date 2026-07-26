"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MagnifyingGlass, ArrowUp, X, List, Spinner, Sun, Moon } from "@phosphor-icons/react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { useSidebar } from "@/components/sidebar-context";
import { useUploadQueue } from "@/features/media/hooks/useUploadQueue";
import { useSystemStats } from "@/shared/hooks/useSystemStats";
import { TopBarStats } from "@/components/topbar/TopBarStats";
import { UserMenu } from "@/components/topbar/UserMenu";
import { UploadStatusToast } from "@/components/topbar/UploadStatusToast";
import { useTheme } from "@/components/ThemeProvider";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";



export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session: effectiveSession, isLoading: authLoading } = useEffectiveSession();
 const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const stats = useSystemStats(effectiveSession?.user?.role === "admin" && !authLoading);

 const { theme, setTheme } = useTheme();

 const { isUploading, uploadProgress, uploadResult, waitingCount, fileInputRef, startUpload, setUploadResult } = useUploadQueue();

 const { setMobileOpen } = useSidebar();

 useEffect(() => {
 const handleGlobalUpload = (e: CustomEvent) => {
 if (e.detail?.files) startUpload(e.detail.files);
 };
 window.addEventListener('prism-upload' as `${string}`, handleGlobalUpload as EventListener);
 return () => window.removeEventListener('prism-upload' as `${string}`, handleGlobalUpload as EventListener);
 }, [startUpload]);

 const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
 if (e.target.files) startUpload(e.target.files);
 };

 const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || "");
 const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
 const mobileSearchRef = useRef<HTMLInputElement>(null);
 const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 const pushSearch = useCallback((q: string) => {
 const params = new URLSearchParams(searchParams.toString());
 if (q) params.set('q', q);
 else params.delete('q');
 router.push(`${pathname}?${params.toString()}`);
 }, [searchParams, pathname, router]);

 const handleSearchChange = (q: string) => {
 setSearchQuery(q);
 if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
 if (!q) {
 pushSearch('');
 } else {
    searchTimerRef.current = setTimeout(() => pushSearch(q), 250);
 }
 };

 const handleSearch = (e: React.FormEvent) => {
 e.preventDefault();
 if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
 pushSearch(searchQuery);
 };

 useEffect(() => {
 return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
 }, []);

 return (
 <>
 <div className="sticky top-0 z-topbar w-full pointer-events-none">
 <header className="w-full flex items-center justify-between px-4 md:px-6 py-2.5 bg-app-bg pointer-events-auto">
 <div className="flex items-center gap-2">
 <button
 onClick={() => setMobileOpen(true)}
 aria-label="Open sidebar"
 className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-text hover:text-main-text hover:bg-surface-bg transition-all duration-300 cursor-pointer"
 >
 <List size={15} weight="light" />
 </button>

 {effectiveSession?.user?.role === "admin" && (
 <div className="hidden md:block">
 <TopBarStats stats={stats} />
 </div>
 )}
 </div>

 <div className="flex items-center gap-1">
 <button
 onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setTimeout(() => mobileSearchRef.current?.focus(), 100); }}
 aria-label="Toggle search"
 className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg text-muted-text hover:text-main-text hover:bg-surface-bg transition-all duration-300 cursor-pointer"
 >
 <MagnifyingGlass size={14} weight="light" />
 </button>

 <form onSubmit={handleSearch} className="relative group hidden md:block" role="search">
 <label htmlFor="topbar-search" className="sr-only">Search</label>
 <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-text/50 group-focus-within:text-muted-text transition-colors" weight="light" />
 <input
 id="topbar-search"
 type="search"
 name="search"
 autoComplete="off"
 spellCheck={false}
 value={searchQuery}
 onChange={(e) => handleSearchChange(e.target.value)}
 placeholder="Search..."
 className="bg-transparent border-0 rounded-lg py-1.5 pl-8 pr-8 text-[11px] font-medium text-main-text placeholder:text-muted-text/40 focus:outline-none focus:bg-surface-bg transition-all duration-300 ease-out-expo w-36 focus:w-64"
 />
 {searchQuery ? (
 <button
 type="button"
 onClick={() => handleSearchChange('')}
 className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-text/40 hover:text-muted-text cursor-pointer"
 >
 <X size={12} weight="light" />
 </button>
 ) : null}
 </form>

 <input
 type="file"
 multiple
 className="hidden"
 ref={fileInputRef}
 onChange={handleFileChange}
 accept="image/*,video/*"
 />

 <button
 onClick={() => fileInputRef.current?.click()}
 aria-label="Upload files"
 className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-300 cursor-pointer text-muted-text hover:text-main-text hover:bg-surface-bg "
 >
 {isUploading ? (
 <Spinner size={14} weight="bold" className="animate-spin text-primary" />
 ) : (
 <ArrowUp size={14} weight="light" />
 )}
 </button>

 <button
 onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
 aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
 className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-text hover:text-main-text hover:bg-surface-bg transition-all duration-300 cursor-pointer overflow-hidden "
 >
 <AnimatePresence mode="wait">
 {theme === "dark" ? (
 <motion.div
 key="sun"
 initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
 animate={{ rotate: 0, opacity: 1, scale: 1 }}
 exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
 transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
 >
 <Sun size={14} weight="light" />
 </motion.div>
 ) : (
 <motion.div
 key="moon"
 initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
 animate={{ rotate: 0, opacity: 1, scale: 1 }}
 exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
 transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
 >
 <Moon size={14} weight="light" />
 </motion.div>
 )}
 </AnimatePresence>
 </button>

  {effectiveSession && <div className="ml-1"><UserMenu session={effectiveSession} onOpenSettings={() => setIsSettingsOpen(true)} /></div>}
 {authLoading && !effectiveSession && (
 <div className="w-8 h-8 rounded-full bg-surface-bg animate-pulse" aria-hidden="true" />
 )}
 </div>
 </header>

 <AnimatePresence>
 {mobileSearchOpen && (
 <motion.form
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: "auto", opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
 onSubmit={handleSearch}
 className="md:hidden px-3 pb-2 bg-app-bg"
 >
 <div className="relative">
 <label htmlFor="mobile-search" className="sr-only">Search</label>
 <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-text/40" weight="light" />
 <input
 id="mobile-search"
 ref={mobileSearchRef}
 type="search"
 name="search"
 autoComplete="off"
 spellCheck={false}
 value={searchQuery}
 onChange={(e) => handleSearchChange(e.target.value)}
 placeholder="Search..."
 className="w-full bg-surface-bg/50 border-0 rounded-lg py-2.5 pl-9 pr-9 text-[11px] font-medium text-main-text placeholder:text-muted-text/40 focus:outline-none focus:bg-surface-bg transition-all"
 />
 {searchQuery && (
 <button
 type="button"
 onClick={() => { handleSearchChange(''); setMobileSearchOpen(false); }}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text/40 cursor-pointer"
 >
 <X size={12} weight="light" />
 </button>
 )}
 </div>
 </motion.form>
 )}
 </AnimatePresence>
 </div>

 <UploadStatusToast
 isUploading={isUploading}
 uploadProgress={uploadProgress}
 uploadResult={uploadResult}
 waitingCount={waitingCount}
 onDismiss={() => setUploadResult(null)}
 />

 <SettingsModal
 isOpen={isSettingsOpen}
 onClose={() => setIsSettingsOpen(false)}
 />
 </>
 );
}
