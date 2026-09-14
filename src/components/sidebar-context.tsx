"use client";

import { createContext, useContext, useState, useMemo, ReactNode, useCallback } from "react";

interface SidebarContextType {
  isMobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
}

const STORAGE_KEY = "prism-sidebar-collapsed";
const COOKIE_KEY = "prism-sidebar-collapsed";

const SidebarContext = createContext<SidebarContextType>({
  isMobileOpen: false,
  setMobileOpen: () => {},
  isCollapsed: false,
  setIsCollapsed: () => {},
  toggleCollapsed: () => {},
});

export function SidebarProvider({
  initialCollapsed,
  children,
}: {
  /** Read from the cookie in the server layout so SSR and client agree on first paint. */
  initialCollapsed?: boolean;
  children: ReactNode;
}) {
  const [isMobileOpen, setMobileOpen] = useState(false);
  // Collapsed state comes from the server-rendered cookie value — no
  // localStorage lazy-init, no hydration mismatch on refresh.
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed ?? false);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
      // Cookie (not localStorage) is what the server reads on refresh —
      // this is what keeps the grid from snapping back to expanded layout.
      document.cookie = `${COOKIE_KEY}=${collapsed ? "1" : "0"};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!isCollapsed);
  }, [isCollapsed, setCollapsed]);

  const value = useMemo(
    () => ({ isMobileOpen, setMobileOpen, isCollapsed, setIsCollapsed: setCollapsed, toggleCollapsed }),
    [isMobileOpen, isCollapsed, setCollapsed, toggleCollapsed],
  );

  return (
    <SidebarContext.Provider value={value}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
