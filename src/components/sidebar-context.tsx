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

const SidebarContext = createContext<SidebarContextType>({
  isMobileOpen: false,
  setMobileOpen: () => {},
  isCollapsed: false,
  setIsCollapsed: () => {},
  toggleCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isMobileOpen, setMobileOpen] = useState(false);
  // lazy-init from localStorage when available (client); SSR-safe fallback false.
  // ponytail: brief flash-of-expanded on first paint if user persisted collapsed — acceptable for a dev-facing app; move to cookie if it bothers.
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const setCollapsed = useCallback((collapsed: boolean) => {
    setIsCollapsed(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
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
