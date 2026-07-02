"use client";

import { createContext, useContext, useState, ReactNode } from "react";

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
 return (
 <SidebarContext.Provider value={{ isMobileOpen, setMobileOpen, isCollapsed, setIsCollapsed }}>
 {children}
 </SidebarContext.Provider>
 );
}

export function useSidebar() {
 return useContext(SidebarContext);
}
