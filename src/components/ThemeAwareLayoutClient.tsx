"use client";

import { useEffect } from "react";
import { Toaster } from "sonner";
import { useTheme } from "./ThemeProvider";

/**
 * lives at the bottom of the layout tree, doing client-side things
 * that server components cant touch. toaster. theme color meta tag.
 * the whole "wait this needs to run in the browser" bucket.
 */
export function ThemeAwareLayoutClient() {
 const { theme } = useTheme();

 // sync themeColor meta tag so mobile browsers dont look stupid
 useEffect(() => {
 const meta = document.querySelector('meta[name="theme-color"]');
  const color = theme === "dark" ? "#0A0A09" : "#FAF9F6";
 if (meta) {
 meta.setAttribute("content", color);
 } else {
 const m = document.createElement("meta");
 m.name = "theme-color";
 m.content = color;
 document.head.appendChild(m);
 }
 }, [theme]);

 return (
 <Toaster
 theme={theme}
 position="bottom-right"
 closeButton
 toastOptions={{
 classNames: {
 toast: "group-[.toaster]:bg-panel-bg group-[.toaster]:text-main-text group-[.toaster]:border group-[.toaster]:border-main-border/30 group-[.toaster]:rounded-lg group-[.toaster]:shadow-sm group-[.toaster]:p-4 group-[.toaster]:flex group-[.toaster]:items-center group-[.toaster]:gap-3",
  title: "group-[.toast]:text-xs group-[.toast]:font-bold group-[.toast]:uppercase group-[.toast]:tracking-[0.1em] group-[.toast]:text-main-text",
  description: "group-[.toast]:text-xs group-[.toast]:font-semibold group-[.toast]:uppercase group-[.toast]:tracking-wider group-[.toast]:text-muted-text",
  actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:uppercase group-[.toast]:",
  cancelButton: "group-[.toast]:bg-surface-bg group-[.toast]:text-muted-text group-[.toast]:rounded-lg group-[.toast]:text-xs group-[.toast]:uppercase group-[.toast]:",
 closeButton: "group-[.toast]:bg-panel-bg group-[.toast]:border-main-border/30 group-[.toast]:rounded-lg group-[.toast]:text-muted-text hover:group-[.toast]:text-main-text"
 }
 }}
 />
 );
}
