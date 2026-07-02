"use client";
import { motion } from "framer-motion";
import { useReducedMotion } from "@/shared/hooks/useReducedMotion";

interface EmptyLibraryProps {
  isFolder: boolean;
}

function FolderIllustration({ inf }: { inf: number }) {
  return (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500/40">
  <motion.path
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
  d="M12 28V20C12 17.7909 13.7909 16 16 16H28.5L32.5 22H64C66.2091 22 68 23.7909 68 26V28H12Z"
  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
  />
  <motion.path
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
  d="M12 28V58C12 60.2091 13.7909 62 16 62H64C66.2091 62 68 60.2091 68 58V28H12Z"
  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
  />
  <motion.path
  initial={{ opacity: 0 }}
  animate={{ opacity: [0, 1, 0] }}
  transition={{ duration: 2.5, delay: 1.2, repeat: inf, ease: "easeInOut" }}
  d="M34 42H56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  <motion.path
  initial={{ opacity: 0 }}
  animate={{ opacity: [0, 1, 0] }}
  transition={{ duration: 2.5, delay: 1.6, repeat: inf, ease: "easeInOut" }}
  d="M30 48H52" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
  );
}

function UploadIllustration({ inf }: { inf: number }) {
  return (
  <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-500/40">
  <motion.rect
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
  x="14" y="18" width="52" height="44" rx="4" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinejoin="round"
  />
  <motion.circle
  initial={{ scale: 0 }}
  animate={{ scale: 1 }}
  transition={{ duration: 0.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
  cx="40" cy="38" r="8" stroke="currentColor" strokeWidth="2.5" fill="none"
  />
  <motion.path
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 0.5, delay: 0.7, ease: [0.16, 1, 0.3, 1] }}
  d="M40 34V42" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
  />
  <motion.path
  initial={{ pathLength: 0 }}
  animate={{ pathLength: 1 }}
  transition={{ duration: 0.5, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
  d="M36 38H44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
  />
  <motion.path
  initial={{ opacity: 0 }}
  animate={{ opacity: [0, 1, 0] }}
  transition={{ duration: 2, delay: 1.5, repeat: inf, ease: "easeInOut" }}
  d="M26 56L34 50L38 54L46 46L54 52L56 56" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
  />
  </svg>
  );
}

export function EmptyLibrary({ isFolder }: EmptyLibraryProps) {
  const reduced = useReducedMotion();
  const inf = reduced ? 0 : Infinity;
  return (
  <div className="flex h-full items-center justify-center p-12">
  <div className="max-w-md w-full text-center space-y-8">
  <div className="relative mx-auto w-32 h-32 flex items-center justify-center">
  {/* Subtle Glow Aura */}
  <motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.3, 0.6, 0.3] }}
  transition={{ duration: 4, repeat: inf, ease: "easeInOut" }}
  className="absolute inset-0 bg-indigo-500/15 blur-[40px] rounded-full"
  />
  
  <motion.div 
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ duration: 1, ease: "easeOut" }}
  className="absolute inset-4 bg-surface-bg/50 rounded-full border border-main-border/10" 
  />
  
  <motion.div
  initial={{ y: 10, opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  transition={{ delay: 0.3, duration: 0.8 }}
  className="relative"
  >
  {isFolder ? <FolderIllustration inf={inf} /> : <UploadIllustration inf={inf} />}
  </motion.div>
  <motion.div 
  initial={{ scaleX: 0 }}
  animate={{ scaleX: 1 }}
  transition={{ delay: 0.5, duration: 1 }}
  className="absolute -bottom-4 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-main-border to-transparent"
  />
  </div>

  <div className="space-y-3">
  <motion.p 
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 0.6 }}
  className="text-[12px] text-main-text "
  >
  {isFolder ? "Folder Empty" : "No Files Yet"}
  </motion.p>
  <motion.p 
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 0.8 }}
  className="text-xs font-medium text-muted-text leading-relaxed max-w-[220px] mx-auto antialiased"
  >
  {isFolder 
  ? "Drop files here or use the upload button above."
  : "Drag and drop files anywhere, or click upload to start building your library."}
  </motion.p>
  </div>
  </div>
  </div>
  );
}
