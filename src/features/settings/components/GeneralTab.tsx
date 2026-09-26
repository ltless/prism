"use client";

import type { EffectiveSession } from "@/lib/auth/useEffectiveSession";
import type { ImageKind } from "../hooks/useImageUpload";
import { ProfileCard } from "./ProfileCard";
import { ThemeSelectorCard } from "./ThemeSelectorCard";

interface GeneralTabProps {
  session: EffectiveSession;
  isUploading: ImageKind | null;
  coverSrc: string | null;
  profileSrc: string | null;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>, type: ImageKind) => void;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  profileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function GeneralTab({ session, isUploading, coverSrc, profileSrc, onFileSelect, coverInputRef, profileInputRef }: GeneralTabProps) {
  return (
    <div className="flex flex-col gap-6">
      <ProfileCard
        session={session}
        isUploading={isUploading}
        coverSrc={coverSrc}
        profileSrc={profileSrc}
        onFileSelect={onFileSelect}
        coverInputRef={coverInputRef}
        profileInputRef={profileInputRef}
      />
      <ThemeSelectorCard />
    </div>
  );
}
