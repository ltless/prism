"use client";

import { useRef } from "react";
import Image from "next/image";
import { User, Image as ImageIcon, Camera, Plus, Spinner } from "@phosphor-icons/react";

interface ProfileStepProps {
 profileImage: string | null;
 coverImage: string | null;
 isUploading: string | null;
 onFileUpload: (e: React.ChangeEvent<HTMLInputElement>, type: 'profile' | 'cover') => void;
}

export function ProfileStep({ profileImage, coverImage, isUploading, onFileUpload }: ProfileStepProps) {
 const profileInputRef = useRef<HTMLInputElement>(null);
 const coverInputRef = useRef<HTMLInputElement>(null);

 return (
 <div className="flex w-full flex-col items-center gap-5">
 <input type="file" className="hidden" ref={coverInputRef} onChange={(e) => onFileUpload(e, 'cover')} accept="image/*" />
 <input type="file" className="hidden" ref={profileInputRef} onChange={(e) => onFileUpload(e, 'profile')} accept="image/*" />

  <div className="relative w-full rounded-[1.75rem] bg-black/[0.03] p-1.5 ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
  <div className="relative overflow-hidden rounded-[calc(1.75rem-0.375rem)] bg-surface-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
  <button type="button" onClick={() => coverInputRef.current?.click()} aria-label="Upload cover photo" className="group relative block h-28 w-full cursor-pointer overflow-hidden">
  {coverImage ? (
  <Image src={`/api/v1/media/files/${coverImage}`} alt="Cover" fill sizes="(max-width: 768px) 100vw, 500px" className="object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.03]" unoptimized priority />
  ) : (
  <div className="flex h-full w-full items-center justify-center text-muted-text/40 transition-colors duration-500 ease-spring group-hover:text-muted-text/70">
  {isUploading === 'cover' ? <Spinner size={22} className="animate-spin" weight="light" /> : <ImageIcon size={22} weight="light" />}
  </div>
  )}
  <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-500 ease-spring group-hover:opacity-100">
  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-panel-bg">
  <Camera size={15} weight="light" className="text-main-text" />
  </span>
  </span>
  </button>
  </div>

  <div className="absolute -bottom-7 left-5">
  <button type="button" onClick={() => profileInputRef.current?.click()} aria-label="Upload profile photo" className="group relative block h-16 w-16 cursor-pointer overflow-hidden rounded-full bg-surface-bg ring-[3px] ring-panel-bg">
  {profileImage ? (
  <Image src={`/api/v1/media/files/${profileImage}`} alt="Profile" fill sizes="64px" className="object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.06]" unoptimized priority />
  ) : (
  <div className="flex h-full w-full items-center justify-center text-muted-text/40 transition-colors duration-500 ease-spring group-hover:text-muted-text/70">
  {isUploading === 'profile' ? <Spinner size={18} className="animate-spin" weight="light" /> : <User size={18} weight="light" />}
  </div>
  )}
  <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-500 ease-spring group-hover:opacity-100">
  <Plus size={15} weight="light" className="text-white" />
  </span>
  </button>
  </div>
  </div>

 <p className="pt-8 text-center text-[12px] text-muted-text">
 Click to upload a profile and cover photo. You can change both later.
 </p>
 </div>
 );
}
