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
    <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-12">
      <div className="md:col-span-7">
        <ProfileCard
          session={session}
          isUploading={isUploading}
          coverSrc={coverSrc}
          profileSrc={profileSrc}
          onFileSelect={onFileSelect}
          coverInputRef={coverInputRef}
          profileInputRef={profileInputRef}
        />
      </div>
      <div className="md:col-span-5">
        <ThemeSelectorCard />
      </div>
    </div>
  );
}
