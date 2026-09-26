"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, Image as ImageIcon, Spinner } from "@phosphor-icons/react";
import { SettingsGroup } from "./SettingsGroup";
import { pillPrimary, field } from "@/shared/components/ui/styles";
import { updateUsernameAction } from "@/features/profile/services/profileActions";
import { toast } from "sonner";
import type { EffectiveSession } from "@/lib/auth/useEffectiveSession";
import type { ImageKind } from "../../settings/hooks/useImageUpload";

interface ProfileCardProps {
  session: EffectiveSession;
  isUploading: ImageKind | null;
  coverSrc: string | null;
  profileSrc: string | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: ImageKind) => void;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  profileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function ProfileCard({ session, isUploading, coverSrc, profileSrc, onFileSelect, coverInputRef, profileInputRef }: ProfileCardProps) {
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

  const dirty = username.trim() !== "" && username !== session?.user?.name;

  return (
    <SettingsGroup title="Profile" description="Shown on your account and used to sign in.">
      <button
        type="button"
        onClick={() => coverInputRef.current?.click()}
        aria-label="Change cover image"
        className="group relative block h-28 w-full cursor-pointer overflow-hidden bg-surface-bg"
      >
        {coverSrc ? (
          <Image src={coverSrc} alt="" fill sizes="640px" className="object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.03]" unoptimized />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-black/[0.04] to-black/[0.1] dark:from-white/[0.04] dark:to-white/[0.1]">
            <ImageIcon className="h-5 w-5 text-muted-text" weight="light" />
          </span>
        )}
        {isUploading === "coverImage" && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Spinner className="h-4 w-4 animate-spin text-white" />
          </span>
        )}
        <input type="file" ref={coverInputRef} className="hidden" accept="image/*" onChange={(e) => onFileSelect(e, "coverImage")} />
      </button>

      <div className="px-5 pb-5">
        <div className="flex items-end gap-4">
          <button
            type="button"
            onClick={() => profileInputRef.current?.click()}
            aria-label="Change profile photo"
            className="group relative -mt-8 h-16 w-16 shrink-0 overflow-hidden rounded-full bg-surface-bg ring-[3px] ring-panel-bg cursor-pointer"
          >
            {profileSrc ? (
              <Image src={profileSrc} alt="" fill sizes="64px" className="object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.06]" unoptimized />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary text-lg font-medium text-primary-foreground uppercase">
                {session?.user?.name?.[0] || "U"}
              </span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              {isUploading === "image" ? <Spinner className="h-4 w-4 animate-spin text-white" /> : <Camera className="h-4 w-4 text-white" weight="light" />}
            </span>
            <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={(e) => onFileSelect(e, "image")} />
          </button>
          <div className="min-w-0 pb-1">
            <p className="truncate text-[15px] font-medium tracking-tight text-main-text">{session?.user?.name || "Prism User"}</p>
            <p className="text-[12px] capitalize text-muted-text">{session?.user?.role || "user"}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <label htmlFor="username-input" className="text-[12px] text-muted-text">Username</label>
          <div className="flex gap-2">
            <input
              id="username-input"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className={`${field} h-10 flex-1`}
            />
            <button
              type="button"
              onClick={handleSaveUsername}
              disabled={isSavingUsername || !dirty}
              className={`${pillPrimary} shrink-0 px-5`}
            >
              {isSavingUsername ? "Saving" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </SettingsGroup>
  );
}
