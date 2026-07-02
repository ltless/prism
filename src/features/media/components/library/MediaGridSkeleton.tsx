"use client";

import { m } from "motion/react";
import { MEDIA_GRID_CLASS } from "./MediaGrid";

export function MediaGridSkeleton() {
  return (
  <div className={MEDIA_GRID_CLASS}>
  {Array.from({ length: 28 }).map((_, i) => (
  <m.div
  key={i}
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.9 }}
  transition={{ duration: 0.25, delay: i * 0.015, ease: [0.16, 1, 0.3, 1] }}
  className="aspect-square rounded-lg overflow-hidden bg-main-border/20 relative"
  >
  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
  </m.div>
  ))}
  <style>{`
  @keyframes shimmer {
  100% { transform: translateX(100%); }
  }
  `}</style>
  </div>
  );
}
