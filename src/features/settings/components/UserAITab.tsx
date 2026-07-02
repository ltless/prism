"use client";

import { Sparkle, MagnifyingGlass, Star, Heart } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";
import { toast } from "sonner";
import { Toggle } from "@/shared/components/ui/Toggle";

import type { UserAIPreferences } from "@/features/ai/types";
import type { AITabProps } from "./AITab";

export function UserAITab({ ai }: AITabProps) {
 const modelReady = ai.activeVariant && ai.status === "ready";
 const modelAvailable = ai.loadedModels.length > 0;

 const savePreferences = () => {
 const prefs = ai.toUserPreferences() as unknown as UserAIPreferences;
 import("@/features/settings/services/preferencesActions").then(({ updatePreferencesAction }) => {
 updatePreferencesAction({ ai: prefs }).then(res => {
 if (!res.success) toast.error("Failed to save AI preferences");
 });
 });
 };

 return (
 <div className="flex flex-col gap-5 py-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
 <div className="flex items-center justify-between border-b border-main-border/50 pb-3">
 <div className="flex items-center gap-2">
 <Sparkle size={16} weight="light" className="text-muted-text" />
 <div>
 <h3 className="text-[12px] font-semibold text-main-text">AI Preferences</h3>
 <p className="text-xs text-muted-text mt-0.5">Personalize search & tagging</p>
 </div>
 </div>
 {modelReady ? (
 <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-xs font-medium">
 <div className="w-1 h-1 rounded-full bg-emerald-500" />{ai.activeVariant} Mode
 </div>
 ) : (
 <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted-text/10 text-muted-text text-xs font-medium">
 <div className="w-1 h-1 rounded-full bg-muted-text" />{modelAvailable ? "Ready to load" : "No Model Available"}
 </div>
 )}
 </div>

 <div className={cn("p-4 rounded-xl border transition-colors", ai.isEnabled ? "border-main-border/50 bg-surface-bg" : "border-main-border/30 opacity-70")}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", ai.isEnabled ? "bg-primary/10 text-primary" : "bg-main-border/30 text-muted-text")}><MagnifyingGlass size={15} weight="light" /></div>
 <div>
 <h4 className="text-[11px] font-medium text-main-text">Smart Search</h4>
 <p className="text-xs text-muted-text">Find media by writing normal text descriptions</p>
 </div>
 </div>
 <Toggle checked={ai.isEnabled} onChange={() => { ai.setEnabled(!ai.isEnabled); savePreferences(); }} />
 </div>
 </div>

 <div className={cn("p-4 rounded-xl border transition-colors", ai.aestheticEnabled ? "border-main-border/50 bg-surface-bg" : "border-main-border/30 opacity-70")}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-3">
 <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-colors", ai.aestheticEnabled ? "bg-amber-500/10 text-amber-500" : "bg-main-border/30 text-muted-text")}><Star size={15} weight={ai.aestheticEnabled ? "fill" : "light"} /></div>
 <div>
 <h4 className="text-[11px] font-medium text-main-text">Aesthetic Assessment</h4>
 <p className="text-xs text-muted-text">Sort and filter media based on quality scores</p>
 </div>
 </div>
 <Toggle checked={ai.aestheticEnabled} onChange={() => { ai.setAestheticEnabled(!ai.aestheticEnabled); savePreferences(); }} color="amber" />
 </div>
 {ai.aestheticEnabled && (
 <div className="mt-4 pt-3 border-t border-main-border/30 flex items-center justify-between animate-in slide-in-from-top-1 duration-200">
 <div className="flex items-center gap-2"><Heart size={11} weight="fill" className="text-rose-500" /><span className="text-xs font-medium text-muted-text">Auto-Favorite High Quality</span></div>
 <Toggle checked={ai.autoFavoriteEnabled} onChange={() => { ai.setAutoFavoriteEnabled(!ai.autoFavoriteEnabled); savePreferences(); }} size="sm" color="rose" />
 </div>
 )}
 </div>

 {!modelReady && <p className="text-xs text-muted-text text-center px-4 leading-relaxed">Ask an administrator to download and enable core AI models if features are unavailable.</p>}
 </div>
 );
}
