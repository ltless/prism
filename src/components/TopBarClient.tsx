import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { MagnifyingGlass, X, Spinner, Sun, Moon, UploadSimple } from "@phosphor-icons/react";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { useUploadQueue } from "@/features/media/hooks/useUploadQueue";
import { useSystemStats } from "@/shared/hooks/useSystemStats";
import { TopBarStats } from "@/components/topbar/TopBarStats";
import { UserMenu } from "@/components/topbar/UserMenu";
import { UploadStatusToast } from "@/components/topbar/UploadStatusToast";
import { useTheme } from "@/components/ThemeProvider";
import { useEffectiveSession } from "@/lib/auth/useEffectiveSession";
import { useTopBarSearch } from "@/components/topbar/useTopBarSearch";
import { cn } from "@/core/utils/cn";

const iconBtn =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-text hover:bg-panel-bg hover:text-main-text cursor-pointer";
const motion = "duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";
const fold = `grid transition-[grid-template-columns] ${motion}`;
const EXPANDED = 672;

export function TopBar() {
  const { session, isLoading: authLoading } = useEffectiveSession();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const stats = useSystemStats(session?.user?.role === "admin" && !authLoading);
  const { theme, setTheme } = useTheme();
  const { isUploading, uploadProgress, uploadResult, waitingCount, fileInputRef, startUpload, setUploadResult } = useUploadQueue();
  const { searchQuery, handleSearchChange, handleSearchSubmit } = useTopBarSearch();

  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement>(null);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellW, setShellW] = useState(0);
  const focusSearch = useRef(false);
  const leaveTimer = useRef(0);
  const lastScrollY = useRef(0);

  const compact = scrolled && !pinned && !menuOpen && !mobileSearchOpen && !searchQuery;

  useEffect(() => {
    const onScroll = (e: Event) => {
      const el = e.target;
      const y = el instanceof HTMLElement ? el.scrollTop : window.scrollY;
      if (y <= 8) setScrolled(false);
      else if (y > lastScrollY.current + 6) setScrolled(true);
      lastScrollY.current = y;
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const measure = () => setShellW(shell.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(shell);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      if (window.matchMedia("(min-width: 768px)").matches) {
        focusSearch.current = true;
        setPinned(true);
        return;
      }
      setMobileSearchOpen(true);
      setTimeout(() => mobileSearchRef.current?.focus(), 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!pinned || !focusSearch.current) return;
    focusSearch.current = false;
    desktopSearchRef.current?.focus();
    desktopSearchRef.current?.select();
  }, [pinned]);

  useEffect(() => {
    const onUpload = (e: CustomEvent) => { if (e.detail?.files) startUpload(e.detail.files); };
    window.addEventListener("prism-upload" as `${string}`, onUpload as EventListener);
    return () => window.removeEventListener("prism-upload" as `${string}`, onUpload as EventListener);
  }, [startUpload]);

  const hold = () => { window.clearTimeout(leaveTimer.current); setPinned(true); };
  const release = () => { leaveTimer.current = window.setTimeout(() => setPinned(false), 120); };
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");
  const themeLabel = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const themeIcon = theme === "dark" ? <Sun size={15} weight="light" /> : <Moon size={15} weight="light" />;
  const uploadIcon = isUploading
    ? <Spinner size={14} weight="bold" className="animate-spin" />
    : <UploadSimple size={15} weight="light" />;

  const buttons = 3 + (session || authLoading ? 1 : 0);
  // search slot stays in the flex at width 0, so it still owns one gap
  const compactW = 12 + buttons * 36 + buttons * 4;
  const expandedW = shellW ? Math.min(EXPANDED, shellW) : 0;

  return (
    <>
      <div
        ref={shellRef}
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-topbar flex justify-center px-4 transition-[padding] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)] md:top-5 md:px-10 md:pl-[calc(var(--sidebar-w)+2.5rem)]"
      >
      <header
        onMouseEnter={hold}
        onMouseLeave={release}
        style={expandedW ? { width: compact ? compactW : expandedW } : undefined}
        className={cn(
          "pointer-events-auto flex items-center gap-1 rounded-full bg-app-bg/80 p-1.5 ring-1 ring-main-text/10 backdrop-blur-2xl",
          "transition-[width]",
          motion,
          !expandedW && "w-[min(42rem,100%)]",
        )}
      >
          <input
            type="file"
            multiple
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => { if (e.target.files) startUpload(e.target.files); }}
            accept="image/*,video/*"
          />

          {session?.user?.role === "admin" && (
            <div className={cn("hidden lg:grid", fold, compact ? "grid-cols-[0fr]" : "grid-cols-[1fr]")}>
              <div className="overflow-hidden">
                <div className="flex h-9 items-center whitespace-nowrap rounded-full bg-panel-bg px-3.5">
                  <TopBarStats stats={stats} />
                </div>
              </div>
            </div>
          )}

          <div className="hidden min-w-0 overflow-hidden md:block md:flex-1">
            <form onSubmit={handleSearchSubmit} className="relative w-full min-w-0" role="search">
              <label htmlFor="topbar-search" className="sr-only">Search</label>
              <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-text/70" weight="light" />
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
                className="h-9 w-full min-w-0 rounded-full bg-panel-bg pl-10 pr-12 text-[13px] tracking-[-0.01em] text-main-text placeholder:text-muted-text/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] focus:outline-none dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
              />
              {searchQuery ? (
                <button type="button" onClick={() => handleSearchChange("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-text hover:text-main-text cursor-pointer">
                  <X size={11} weight="light" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-1.5 top-1/2 flex h-6 -translate-y-1/2 select-none items-center rounded-full bg-main-text/[0.06] px-2 text-[10px] font-medium tracking-[0.08em] text-muted-text">⌘K</kbd>
              )}
            </form>
          </div>

          <div className={cn(fold, "grid-cols-[1fr]", compact ? "md:grid-cols-[1fr]" : "md:grid-cols-[0fr]")}>
            <div className="overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (window.matchMedia("(min-width: 768px)").matches) { focusSearch.current = true; setPinned(true); return; }
                  setMobileSearchOpen(true);
                  setTimeout(() => mobileSearchRef.current?.focus(), 0);
                }}
                aria-label="Search"
                className={iconBtn}
              >
                <MagnifyingGlass size={15} weight="light" />
              </button>
            </div>
          </div>

          <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Upload files" className="flex h-9 shrink-0 items-center rounded-full bg-main-text text-app-bg cursor-pointer">
            <span className={cn(fold, compact ? "grid-cols-[0fr]" : "grid-cols-[1fr]")}>
              <span className="overflow-hidden">
                <span className="block whitespace-nowrap pl-3.5 text-[12px] font-medium tracking-[-0.01em]">{isUploading ? "Uploading" : "Upload"}</span>
              </span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center">{uploadIcon}</span>
          </button>
          <button type="button" onClick={toggleTheme} aria-label={themeLabel} className={iconBtn}>{themeIcon}</button>
          {session && <UserMenu session={session} onOpenSettings={() => setSettingsOpen(true)} onOpenChange={setMenuOpen} />}
          {authLoading && !session && <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-main-text/10" aria-hidden="true" />}
      </header>
      </div>

      {mobileSearchOpen && (
        <form onSubmit={handleSearchSubmit} className="fixed left-4 right-4 top-[calc(max(0.75rem,env(safe-area-inset-top))+3.5rem)] z-topbar md:hidden" role="search">
            <label htmlFor="mobile-search" className="sr-only">Search</label>
            <MagnifyingGlass className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-text/70" weight="light" />
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
              className="h-9 w-full rounded-full bg-app-bg/80 pl-10 pr-10 text-[13px] text-main-text ring-1 ring-main-text/10 placeholder:text-muted-text/60 focus:outline-none"
            />
            {searchQuery && (
              <button type="button" onClick={() => { handleSearchChange(""); setMobileSearchOpen(false); }} aria-label="Clear search" className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-text cursor-pointer">
                <X size={11} weight="light" />
              </button>
            )}
          </form>
      )}

      <UploadStatusToast
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadResult={uploadResult}
        waitingCount={waitingCount}
        onDismiss={() => setUploadResult(null)}
      />
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
