import { useState, useEffect, useRef } from "react";
import { MagnifyingGlass, X, List, Spinner, Sun, Moon, UploadSimple } from "@phosphor-icons/react";
import { m, AnimatePresence } from "motion/react";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { useSidebar } from "@/components/sidebar-context";
import { useUploadQueue } from "@/features/media/hooks/useUploadQueue";
import { useSystemStats } from "@/shared/hooks/useSystemStats";
import { TopBarStats } from "@/components/topbar/TopBarStats";
import { UserMenu } from "@/components/topbar/UserMenu";
import { UploadStatusToast } from "@/components/topbar/UploadStatusToast";
import { useTheme } from "@/components/ThemeProvider";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { useTopBarSearch } from "@/components/topbar/useTopBarSearch";


export function TopBar() {
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

  const { searchQuery, handleSearchChange, handleSearchSubmit } = useTopBarSearch();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches) {
          desktopSearchRef.current?.focus();
          desktopSearchRef.current?.select();
        } else {
          setMobileSearchOpen(true);
          setTimeout(() => mobileSearchRef.current?.focus(), 100);
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const ghostBtn = "w-8 h-8 flex items-center justify-center rounded-lg text-muted-text hover:text-main-text hover:bg-surface-bg transition-colors cursor-pointer";

  return (
    <>
      <div className="sticky top-0 z-topbar w-full pointer-events-none">
        <header className="w-full flex items-center gap-3 h-12 px-4 md:px-5 bg-app-bg/80 backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open sidebar"
              className={`md:hidden ${ghostBtn}`}
            >
              <List size={15} weight="light" />
            </button>

            {effectiveSession?.user?.role === "admin" && (
              <div className="hidden lg:block">
                <TopBarStats stats={stats} />
              </div>
            )}
          </div>

          <div className="flex-1 flex justify-center min-w-0">
            <form onSubmit={handleSearchSubmit} className="relative group w-full max-w-sm hidden md:block" role="search">
              <label htmlFor="topbar-search" className="sr-only">Search</label>
              <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-text/60 group-focus-within:text-main-text transition-colors pointer-events-none" weight="light" />
              <input
                id="topbar-search"
                ref={desktopSearchRef}
                type="search"
                name="search"
                autoComplete="off"
                spellCheck={false}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search library"
                className="w-full bg-surface-bg/50 border border-main-border/25 rounded-full h-8 pl-9 pr-14 text-xs font-medium text-main-text placeholder:text-muted-text/50 focus:outline-none focus:bg-surface-bg focus:border-primary/40 transition-colors"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => handleSearchChange('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-text/40 hover:text-main-text cursor-pointer"
                >
                  <X size={11} weight="light" />
                </button>
              ) : (
                <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 px-1.5 flex items-center rounded-md border border-main-border/40 bg-panel-bg/80 text-[10px] font-semibold text-muted-text/70 pointer-events-none select-none">
                  ⌘K
                </kbd>
              )}
            </form>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setTimeout(() => mobileSearchRef.current?.focus(), 100); }}
              aria-label="Toggle search"
              className={`md:hidden ${ghostBtn}`}
            >
              <MagnifyingGlass size={14} weight="light" />
            </button>

            <input
              type="file"
              multiple
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*,video/*"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload files"
              title="Upload files"
              className={ghostBtn}
            >
              {isUploading ? (
                <Spinner size={14} weight="bold" className="animate-spin text-primary" />
              ) : (
                <UploadSimple size={15} weight="light" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className={`${ghostBtn} overflow-hidden`}
            >
              <AnimatePresence mode="wait">
                {theme === "dark" ? (
                  <m.div
                    key="sun"
                    initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <Sun size={14} weight="light" />
                  </m.div>
                ) : (
                  <m.div
                    key="moon"
                    initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
                  >
                    <Moon size={14} weight="light" />
                  </m.div>
                )}
              </AnimatePresence>
            </button>

            {effectiveSession && <div className="ml-0.5"><UserMenu session={effectiveSession} onOpenSettings={() => setIsSettingsOpen(true)} /></div>}
            {authLoading && !effectiveSession && (
              <div className="w-7 h-7 rounded-full bg-surface-bg animate-pulse" aria-hidden="true" />
            )}
          </div>
        </header>

        <AnimatePresence>
          {mobileSearchOpen && (
            <m.form
              initial={{ scaleY: 0, opacity: 0 }}
              animate={{ scaleY: 1, opacity: 1 }}
              exit={{ scaleY: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: "top" }}
              onSubmit={handleSearchSubmit}
              className="md:hidden px-3 pb-2 bg-app-bg/80 backdrop-blur-md"
            >
              <div className="relative">
                <label htmlFor="mobile-search" className="sr-only">Search</label>
                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-text/50 pointer-events-none" weight="light" />
                <input
                  id="mobile-search"
                  ref={mobileSearchRef}
                  type="search"
                  name="search"
                  autoComplete="off"
                  spellCheck={false}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search library"
                  className="w-full bg-surface-bg/60 border border-main-border/25 rounded-full py-2 pl-9 pr-9 text-xs font-medium text-main-text placeholder:text-muted-text/50 focus:outline-none focus:bg-surface-bg focus:border-primary/40 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { handleSearchChange(''); setMobileSearchOpen(false); }}
                    aria-label="Clear search"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-text/40 cursor-pointer"
                  >
                    <X size={11} weight="light" />
                  </button>
                )}
              </div>
            </m.form>
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
