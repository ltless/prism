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
 <div className="space-y-5 w-full flex flex-col items-center">
 <input type="file" className="hidden" ref={coverInputRef} onChange={(e) => onFileUpload(e, 'cover')} accept="image/*" />
 <input type="file" className="hidden" ref={profileInputRef} onChange={(e) => onFileUpload(e, 'profile')} accept="image/*" />

  <div className="w-full relative">
  <button type="button" onClick={() => coverInputRef.current?.click()} className="w-full h-28 rounded-xl bg-surface-bg border border-main-border/50 overflow-hidden group cursor-pointer relative block">
  {coverImage ? (
  <Image src={`/api/v1/media/files/${coverImage}`} alt="Cover" fill sizes="(max-width: 768px) 100vw, 500px" className="object-cover" unoptimized priority />
  ) : (
  <div className="w-full h-full flex items-center justify-center text-muted-text/30 group-hover:text-muted-text/50 transition-colors">
  {isUploading === 'cover' ? <Spinner className="animate-spin" weight="light" /> : <ImageIcon size={24} weight="light" />}
  </div>
  )}
  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
  <div className="bg-panel-bg/90 p-2 rounded-lg shadow-sm">
  <Camera size={14} weight="light" className="text-main-text" />
  </div>
  </div>
  </button>

  <div className="absolute -bottom-7 left-5">
  <button type="button" onClick={() => profileInputRef.current?.click()} className="w-16 h-16 rounded-full bg-app-bg border-[3px] border-panel-bg shadow-md overflow-hidden group cursor-pointer relative block">
  {profileImage ? (
  <Image src={`/api/v1/media/files/${profileImage}`} alt="Profile" fill sizes="64px" className="object-cover" unoptimized priority />
  ) : (
  <div className="w-full h-full bg-surface-bg flex items-center justify-center text-muted-text/30 group-hover:text-muted-text/50 transition-colors">
  {isUploading === 'profile' ? <Spinner className="animate-spin" weight="light" /> : <User size={20} weight="light" />}
  </div>
  )}
  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
  <Plus size={16} weight="bold" className="text-white" />
  </div>
  </button>
  </div>
  </div>

 <div className="pt-8 w-full text-center">
 <p className="text-[11px] text-muted-text">
 Click to upload your profile and cover photo.
 </p>
 </div>
 </div>
 );
}
