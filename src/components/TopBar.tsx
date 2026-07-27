"use client";
import dynamic from "next/dynamic";

export const TopBar = dynamic(() => import("./TopBarClient").then(mod => mod.TopBar), {
  ssr: false,
  loading: () => (
    <div className="sticky top-0 z-topbar w-full bg-app-bg px-4 md:px-6 py-2">
      <div className="w-full h-8 bg-surface-bg/50 rounded animate-pulse" />
    </div>
  )
});
