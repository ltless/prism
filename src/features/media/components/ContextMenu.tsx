"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { CaretRight } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

export interface ContextMenuItem {
 label: string;
 icon?: React.ElementType;
 onClick: () => void;
 variant?: "default" | "danger" | "success";
 divider?: boolean;
 subItems?: ContextMenuItem[];
}

interface ContextMenuProps {
 items: ContextMenuItem[];
 children: React.ReactNode;
 className?: string;
}

const CLOSE_ALL_MENUS_EVENT = "prism-close-all-context-menus";

export function ContextMenu({ items, children, className }: ContextMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubMenu, setActiveSubMenu] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [submenuLeft, setSubmenuLeft] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered = useRef(false);

 const closeMenu = useCallback(() => {
 setIsOpen(false);
 setActiveSubMenu(null);
 }, []);

 const handleContextMenu = (e: React.MouseEvent) => {
 e.preventDefault();
 e.stopPropagation();
 window.dispatchEvent(new CustomEvent(CLOSE_ALL_MENUS_EVENT));
 setPos({ x: e.clientX, y: e.clientY });
 setIsOpen(true);
 };

 const handleTouchStart = (e: React.TouchEvent) => {
 longPressTriggered.current = false;
 longPressTimer.current = setTimeout(() => {
 longPressTriggered.current = true;
 e.preventDefault();
 const touch = e.touches[0];
 window.dispatchEvent(new CustomEvent(CLOSE_ALL_MENUS_EVENT));
 setPos({ x: touch.clientX, y: touch.clientY });
 setIsOpen(true);
 }, 500);
 };

 const handleTouchEnd = () => {
 if (longPressTimer.current) {
 clearTimeout(longPressTimer.current);
 longPressTimer.current = null;
 }
 };

 const handleTouchMove = () => {
 if (longPressTimer.current) {
 clearTimeout(longPressTimer.current);
 longPressTimer.current = null;
 }
 };

 useEffect(() => {
 const handleGlobalClose = () => { if (isOpen) closeMenu(); };
 window.addEventListener(CLOSE_ALL_MENUS_EVENT, handleGlobalClose);
 return () => window.removeEventListener(CLOSE_ALL_MENUS_EVENT, handleGlobalClose);
 }, [isOpen, closeMenu]);

  useEffect(() => {
  if (isOpen) {
  const wheelOpts: AddEventListenerOptions = { passive: true };
  window.addEventListener("click", closeMenu);
  window.addEventListener("wheel", closeMenu, wheelOpts);
  window.addEventListener("touchmove", closeMenu, wheelOpts);
  window.addEventListener("contextmenu", closeMenu);
  return () => {
  window.removeEventListener("click", closeMenu);
  window.removeEventListener("wheel", closeMenu, wheelOpts);
  window.removeEventListener("touchmove", closeMenu, wheelOpts);
  window.removeEventListener("contextmenu", closeMenu);
  };
  }
  return;
  }, [isOpen, closeMenu]);

  useEffect(() => {
  if (!isOpen) return;
  const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === "Escape") closeMenu();
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeMenu]);

  useLayoutEffect(() => {
  if (isOpen && menuRef.current) {
  const menu = menuRef.current;
  const rect = menu.getBoundingClientRect();
  const padding = 10;
  let newX = pos.x;
  let newY = pos.y;

  if (pos.x + rect.width > window.innerWidth - padding) newX = window.innerWidth - rect.width - padding;
  if (pos.y + rect.height > window.innerHeight - padding) newY = window.innerHeight - rect.height - padding;

  if (newX !== pos.x || newY !== pos.y) setPos({ x: newX, y: newY });
  }
  }, [isOpen, pos.x, pos.y]);

  // Clamp submenu to viewport — open left if main menu near right edge
  useLayoutEffect(() => {
  if (!isOpen || activeSubMenu === null || !menuRef.current) return;
  const menu = menuRef.current;
  const rect = menu.getBoundingClientRect();
  const subW = 176;
  setSubmenuLeft(rect.left + rect.width + subW + 12 <= window.innerWidth);
  }, [isOpen, activeSubMenu]);

 return (
 <div
 onContextMenu={handleContextMenu}
 onTouchStart={handleTouchStart}
 onTouchEnd={handleTouchEnd}
 onTouchMove={handleTouchMove}
 className={cn("relative", className)}
 >
 {children}

 {typeof document !== "undefined" && createPortal(
 <AnimatePresence>
 {isOpen && (
 <motion.div
 ref={menuRef}
 initial={{ opacity: 0, y: -4 }}
 animate={{ opacity: 1, y: 0 }}
 exit={{ opacity: 0, y: -4 }}
 transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
 style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: "var(--z-context-menu)" }}
 className="w-52 bg-panel-bg border border-main-border/50 shadow-xl rounded-xl p-1 overflow-visible"
 >
  {items.map((item, idx) => (
  <div key={idx} className="relative">
  <button
  aria-haspopup={item.subItems ? "menu" : undefined}
  aria-expanded={item.subItems ? activeSubMenu === idx : undefined}
  onMouseEnter={() => item.subItems ? setActiveSubMenu(idx) : setActiveSubMenu(null)}
  onFocus={() => item.subItems ? setActiveSubMenu(idx) : setActiveSubMenu(null)}
  onClick={(e) => {
  e.stopPropagation();
  if (!item.subItems) {
  item.onClick();
  closeMenu();
  }
  }}
  className={cn(
  "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors duration-150 cursor-pointer group",
  item.variant === "danger"
  ? "text-rose-500 hover:bg-rose-500/5"
  : item.variant === "success"
  ? "text-emerald-500 hover:bg-emerald-500/5"
  : "text-muted-text hover:text-main-text hover:bg-surface-bg"
  )}
  >
 <div className="flex items-center gap-2">
 {item.icon && (
 <item.icon
 size={14}
 weight="light"
 className={cn(
 "transition-colors duration-150",
 item.variant === "danger" ? "text-rose-500" : "text-muted-text group-hover:text-main-text"
 )}
 />
 )}
 <span>{item.label}</span>
 </div>
 {item.subItems && (
 <CaretRight size={10} weight="bold" className="text-muted-text/40 group-hover:text-muted-text transition-colors duration-150" />
 )}
 </button>

  <AnimatePresence>
  {item.subItems && activeSubMenu === idx && (
  <motion.div
  initial={{ opacity: 0, x: submenuLeft ? -4 : 4 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: submenuLeft ? -4 : 4 }}
  transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
  className="absolute top-0 w-44 bg-panel-bg border border-main-border/50 shadow-xl rounded-xl p-1 z-context-menu"
  style={{ left: submenuLeft ? "calc(100% + 4px)" : "auto", right: submenuLeft ? "auto" : "calc(100% + 4px)" }}
  >
 {item.subItems.map((sub, sIdx) => (
 <button
 key={sIdx}
 onClick={(e) => {
 e.stopPropagation();
 sub.onClick();
 closeMenu();
 }}
 className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-muted-text hover:text-main-text hover:bg-surface-bg transition-colors duration-150 cursor-pointer group"
 >
 {sub.icon && <sub.icon size={13} weight="light" className="text-muted-text group-hover:text-main-text transition-colors duration-150" />}
 <span className="truncate">{sub.label}</span>
 </button>
 ))}
 {item.subItems.length === 0 && (
 <p className="p-3 text-[11px] text-muted-text/40 text-center">No folders</p>
 )}
 </motion.div>
 )}
 </AnimatePresence>

 {item.divider && <div className="my-1 h-px bg-main-border/40 mx-2" />}
 </div>
 ))}
 </motion.div>
 )}
 </AnimatePresence>,
 document.body
 )}
 </div>
 );
}
