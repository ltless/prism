"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";

interface SidebarContextType {
 isMobileOpen: boolean;
 setMobileOpen: (open: boolean) => void;
 isCollapsed: boolean;
 setIsCollapsed: (collapsed: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
 isMobileOpen: false,
 setMobileOpen: () => {},
 isCollapsed: false,
 setIsCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
 const [isMobileOpen, setMobileOpen] = useState(false);
 const [isCollapsed, setIsCollapsed] = useState(false);
 const value = useMemo(
 () => ({ isMobileOpen, setMobileOpen, isCollapsed, setIsCollapsed }),
 [isMobileOpen, isCollapsed],
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
