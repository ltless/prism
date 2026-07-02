"use client";
import dynamic from "next/dynamic";

export const TopBar = dynamic(() => import("./TopBarClient").then(mod => mod.TopBar), { 
 ssr: false,
 loading: () => (
 <div className="sticky top-0 z-topbar w-full bg-app-bg px-4 md:px-8 py-3">
 <div className="w-full h-9 bg-panel-bg/30 border border-main-border/30 rounded-lg animate-pulse" />
 </div>
 )
});
