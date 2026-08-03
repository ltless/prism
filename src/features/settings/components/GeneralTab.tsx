"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Camera, Image as ImageIcon, Spinner, FloppyDisk, Palette, User } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { SectionCard } from "@/shared/components/SectionCard";
import { useTheme } from "@/components/ThemeProvider";
import { updateUsernameAction } from "@/features/profile/services/profileActions";
import { toast } from "sonner";
import type { EffectiveSession } from "@/lib/auth/useEffectiveSession";

interface GeneralTabProps {
  session: EffectiveSession;
  isUploading: "image" | "coverImage" | null;
  coverSrc: string | null;
  profileSrc: string | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: "image" | "coverImage") => void;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  profileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function GeneralTab({ session, isUploading, coverSrc, profileSrc, onFileSelect, coverInputRef, profileInputRef }: GeneralTabProps) {
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState(session?.user?.name || "");
  const [isSavingUsername, setIsSavingUsername] = useState(false);

  const handleSaveUsername = async () => {
    setIsSavingUsername(true);
    try {
      const res = await updateUsernameAction(username);
      if (res.success) {
        toast.success("Username updated");
      } else {
        toast.error(res.error || "Failed to update username");
      }
    } finally {
      setIsSavingUsername(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-main-text">General Settings</h3>
        <p className="text-[11px] text-muted-text">Manage your identity, profile appearance, and display theme.</p>
      </div>

      {/* Profile & Identity Card */}
      <SectionCard icon={User} title="Identity & Profile" bodyClassName="flex flex-col gap-6">
          {/* Images Area */}
          <div className="relative">
            {/* Cover Image */}
            <div
              className="relative h-32 w-full rounded-xl overflow-hidden bg-surface-bg border border-main-border/40 group cursor-pointer shadow-inner transition-colors hover:border-primary/40"
              onClick={() => coverInputRef.current?.click()}
            >
              {coverSrc ? (
                <Image src={coverSrc} alt="Cover" fill sizes="(max-width: 768px) 100vw, 600px" className="object-cover transition-transform duration-500 group-hover:scale-105" unoptimized priority />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-tr from-surface-bg to-panel-bg flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-muted-text/30" weight="light" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="px-3 py-1.5 rounded-lg bg-black/60 text-white text-[11px] font-medium flex items-center gap-2 backdrop-blur-sm">
                  {isUploading === "coverImage" ? <Spinner className="w-3.5 h-3.5 animate-spin" weight="light" /> : <Camera className="w-3.5 h-3.5" weight="light" />}
                  Change Cover
                </div>
              </div>
              <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => onFileSelect(e, "coverImage")} />
            </div>

            {/* Profile Avatar Overlay */}
            <div className="flex items-end gap-4 -mt-10 px-4 relative z-10">
              <div
                className="relative w-20 h-20 rounded-full overflow-hidden bg-app-bg border-4 border-panel-bg group cursor-pointer shadow-md transition-transform hover:scale-105 shrink-0"
                onClick={() => profileInputRef.current?.click()}
              >
                {profileSrc ? (
                  <Image src={profileSrc} alt="Profile" fill sizes="80px" className="object-cover" unoptimized priority />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center text-2xl font-semibold text-primary-foreground uppercase">
                    {session?.user?.name?.[0] || "U"}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {isUploading === "image" ? <Spinner className="w-5 h-5 text-white animate-spin" weight="light" /> : <Camera className="w-5 h-5 text-white" weight="light" />}
                </div>
                <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={(e) => onFileSelect(e, "image")} />
              </div>

              {/* Glassmorphic info block for readability next to avatar */}
              <div 
                className="mb-2 backdrop-blur-md border border-main-border/50 px-3.5 py-2.5 rounded-xl shadow-sm flex flex-col gap-1"
                style={{
                  backgroundColor: theme === "dark" ? "rgba(26, 26, 25, 0.95)" : "rgba(255, 255, 255, 0.95)"
                }}
              >
                <h3 className="text-sm font-bold text-main-text leading-none">
                  {session?.user?.name || "Prism User"}
                </h3>
                <div>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold uppercase tracking-wide">
                    {session?.user?.role || "user"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Username form */}
          <div className="space-y-2 max-w-md pt-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-main-text">Username</label>
              <p className="text-xs text-muted-text">This will update your unique login handle and profile display name.</p>
            </div>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="flex-1 px-3 py-2 bg-app-bg border border-main-border/50 rounded-lg text-[12px] text-main-text placeholder:text-muted-text/50 focus:border-primary focus:bg-panel-bg outline-none transition-colors duration-200"
                placeholder="Enter username..."
              />
              <button
                type="button"
                onClick={handleSaveUsername}
                disabled={isSavingUsername || !username.trim() || username === session?.user?.name}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-[11px] font-medium flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity duration-200 cursor-pointer shrink-0 shadow-sm"
              >
                {isSavingUsername ? <Spinner size={12} className="animate-spin" weight="light" /> : <FloppyDisk size={12} weight="light" />}
                Save
              </button>
            </div>
            <p className="text-[11px] text-muted-text/60 italic">3-32 characters: letters, numbers, underscores.</p>
          </div>
      </SectionCard>

      {/* Theme Settings Card */}
      <SectionCard icon={Palette} title="Display Theme" bodyClassName="flex flex-col gap-4">
          <p className="text-[11px] text-muted-text">Select how you want the Prism interface to look on your device.</p>
          
          <div className="grid grid-cols-2 gap-4">
            {/* Dark Theme Mockup Option */}
            <button
              type="button"
              onClick={() => setTheme("dark")}
              aria-pressed={theme === "dark"}
              className={cn(
                "p-3 rounded-xl border relative overflow-hidden group cursor-pointer transition-[border-color,background-color,transform] duration-300 text-left",
                theme === "dark" 
                  ? "border-primary bg-primary/[0.02] shadow-sm scale-[1.01]" 
                  : "border-main-border/50 bg-app-bg/30 hover:border-main-border/80 hover:bg-app-bg/50"
              )}
            >
              {/* Premium dark UI Mockup preview */}
              <div className="w-full h-16 bg-[#0E0E0D] border border-white/5 rounded-lg mb-3 flex p-1.5 gap-1.5 overflow-hidden shadow-sm">
                <div className="w-7 h-full bg-[#181816] rounded flex flex-col gap-1 p-1">
                  <div className="h-1 w-full bg-[#2B2B28] rounded-full" />
                  <div className="h-1 w-4 bg-[#2B2B28] rounded-full" />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="h-2 w-full bg-[#181816] rounded flex items-center px-1">
                    <div className="w-1.5 h-1 bg-primary rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    <div className="bg-[#181816] rounded border border-white/5 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-primary/20 rounded-full" />
                    </div>
                    <div className="bg-[#181816] rounded border border-white/5" />
                    <div className="bg-[#181816] rounded border border-white/5" />
                  </div>
                </div>
              </div>
              <p className={cn(
                "text-[11px] text-center font-medium transition-colors",
                theme === "dark" ? "text-main-text font-semibold" : "text-muted-text group-hover:text-main-text"
              )}>Dark Mode</p>
              {theme === "dark" && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-sm">
                  <Check size={10} weight="bold" />
                </div>
              )}
            </button>

            {/* Light Theme Mockup Option */}
            <button
              type="button"
              onClick={() => setTheme("light")}
              aria-pressed={theme === "light"}
              className={cn(
                "p-3 rounded-xl border relative overflow-hidden group cursor-pointer transition-[border-color,background-color,transform] duration-300 text-left",
                theme === "light" 
                  ? "border-primary bg-primary/[0.01] shadow-sm scale-[1.01]" 
                  : "border-main-border/50 bg-app-bg/30 hover:border-main-border/80 hover:bg-app-bg/50"
              )}
            >
              {/* Premium light UI Mockup preview */}
              <div className="w-full h-16 bg-[#F9F8F6] border border-black/5 rounded-lg mb-3 flex p-1.5 gap-1.5 overflow-hidden shadow-sm">
                <div className="w-7 h-full bg-[#EDEDE9] rounded flex flex-col gap-1 p-1">
                  <div className="h-1 w-full bg-[#D6D6D0] rounded-full" />
                  <div className="h-1 w-4 bg-[#D6D6D0] rounded-full" />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="h-2 w-full bg-[#EDEDE9] rounded flex items-center px-1">
                    <div className="w-1.5 h-1 bg-[#D6D6D0] rounded-full" />
                  </div>
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    <div className="bg-white rounded border border-black/5 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 bg-primary/20 rounded-full" />
                    </div>
                    <div className="bg-white rounded border border-black/5" />
                    <div className="bg-white rounded border border-black/5" />
                  </div>
                </div>
              </div>
              <p className={cn(
                "text-[11px] text-center font-medium transition-colors",
                theme === "light" ? "text-main-text font-semibold" : "text-muted-text group-hover:text-main-text"
              )}>Light Mode</p>
              {theme === "light" && (
                <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-sm">
                  <Check size={10} weight="bold" />
                </div>
              )}
            </button>
          </div>
      </SectionCard>
    </div>
  );
}
