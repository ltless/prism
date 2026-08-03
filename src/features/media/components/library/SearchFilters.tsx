"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Image as ImageIcon, Video, X, Calendar } from "@phosphor-icons/react";

export function SearchFilters() {
 const router = useRouter();
 const pathname = usePathname();
 const searchParams = useSearchParams();

 const mimeType = searchParams.get("type");
 const dateFrom = searchParams.get("from");
 const dateTo = searchParams.get("to");

 const hasFilters = mimeType || dateFrom || dateTo;

 const updateParam = (key: string, value: string | null) => {
 const p = new URLSearchParams(searchParams.toString());
 if (value) p.set(key, value);
 else p.delete(key);
 router.push(`${pathname}?${p.toString()}`);
 };

 const clearAll = () => {
 const p = new URLSearchParams(searchParams.toString());
 p.delete("type");
 p.delete("from");
 p.delete("to");
 router.push(`${pathname}?${p.toString()}`);
 };

 return (
 <div className="flex items-center gap-2 flex-wrap">
 {/* Media type toggle */}
 {!mimeType ? (
 <>
 <button
 type="button"
 onClick={() => updateParam("type", "image")}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-main-border bg-surface-bg text-xs font-bold text-muted-text hover:text-main-text hover:border-primary/30 transition-colors ease-out-expo cursor-pointer"
 >
 <ImageIcon size={12} weight="light" />
 Images
 </button>
 <button
 type="button"
 onClick={() => updateParam("type", "video")}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-main-border bg-surface-bg text-xs font-bold text-muted-text hover:text-main-text hover:border-primary/30 transition-colors ease-out-expo cursor-pointer"
 >
 <Video size={12} weight="light" />
 Videos
 </button>
 </>
 ) : (
 <Chip onClear={() => updateParam("type", null)}>
 {mimeType === "image" ? "Images" : "Videos"}
 </Chip>
 )}

 {/* Date range */}
 <div className="flex items-center gap-1">
 <div className="relative">
 <Calendar size={12} weight="light" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
 <input
 type="date"
 value={dateFrom ?? ""}
 onChange={(e) => updateParam("from", e.target.value || null)}
 placeholder="From"
 className="w-32 pl-7 pr-2 py-1.5 rounded-full border border-main-border bg-surface-bg text-xs font-bold text-main-text focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-[border-color,box-shadow] [color-scheme:light] dark:[color-scheme:dark]"
 />
 </div>
 <span className="text-xs text-muted-text">-</span>
 <div className="relative">
 <Calendar size={12} weight="light" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-text pointer-events-none" />
 <input
 type="date"
 value={dateTo ?? ""}
 onChange={(e) => updateParam("to", e.target.value || null)}
 placeholder="To"
 className="w-32 pl-7 pr-2 py-1.5 rounded-full border border-main-border bg-surface-bg text-xs font-bold text-main-text focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 transition-[border-color,box-shadow] [color-scheme:light] dark:[color-scheme:dark]"
 />
 </div>
 </div>

 {dateFrom && (
 <Chip onClear={() => updateParam("from", null)}>
 From: {dateFrom}
 </Chip>
 )}
 {dateTo && (
 <Chip onClear={() => updateParam("to", null)}>
 To: {dateTo}
 </Chip>
 )}

 {hasFilters && (
 <button
 type="button"
 onClick={clearAll}
 className="text-xs font-bold text-muted-text hover:text-main-text underline underline-offset-2 transition-colors cursor-pointer"
 >
 Clear filters
 </button>
 )}
 </div>
 );
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
 return (
 <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-xs font-bold text-primary">
 {children}
 <button type="button" onClick={onClear} className="hover:text-main-text transition-colors cursor-pointer">
 <X size={10} weight="light" />
 </button>
 </span>
 );
}