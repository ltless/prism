"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Image as ImageIcon, Video, X } from "@phosphor-icons/react";
import { cn } from "@/core/utils/cn";

const chip = "flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-main-text/[0.04] ring-1 ring-main-text/[0.06] text-[12px] text-muted-text hover:text-main-text cursor-pointer";

/** By name matches the file title. Describe also matches AI tags. */
export function SearchModeToggle({ mode }: { mode: "name" | "describe" }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setMode = (next: "name" | "describe") => {
    const p = new URLSearchParams(searchParams.toString());
    if (next === "name") p.set("mode", "name");
    else p.delete("mode");
    router.push(`${pathname}?${p.toString()}`);
  };

  const tab = (active: boolean) => cn(
    "h-7 px-3 rounded-full text-[12px] cursor-pointer",
    active ? "bg-panel-bg text-main-text shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]" : "text-muted-text hover:text-main-text",
  );

  return (
    <div role="group" aria-label="Search mode" className="inline-flex items-center gap-0.5 rounded-full bg-main-text/[0.04] p-1 ring-1 ring-main-text/[0.06]">
      <button type="button" aria-pressed={mode === "name"} onClick={() => setMode("name")} className={tab(mode === "name")}>
        By name
      </button>
      <button type="button" aria-pressed={mode === "describe"} onClick={() => setMode("describe")} className={tab(mode === "describe")}>
        Describe
      </button>
    </div>
  );
}

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
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => updateParam("type", mimeType === "image" ? null : "image")}
        aria-pressed={mimeType === "image"}
        className={cn(chip, mimeType === "image" && "bg-main-text text-app-bg ring-main-text")}
      >
        <ImageIcon size={13} weight="regular" />
        Images
      </button>
      <button
        type="button"
        onClick={() => updateParam("type", mimeType === "video" ? null : "video")}
        aria-pressed={mimeType === "video"}
        className={cn(chip, mimeType === "video" && "bg-main-text text-app-bg ring-main-text")}
      >
        <Video size={13} weight="regular" />
        Videos
      </button>

      <label className={cn(chip, "cursor-pointer", dateFrom && "text-main-text")}>
        <span>From</span>
        <input
          type="date"
          value={dateFrom ?? ""}
          onChange={(e) => updateParam("from", e.target.value || null)}
          aria-label="Date from"
          className="bg-transparent text-[12px] text-main-text outline-none [color-scheme:light] dark:[color-scheme:dark]"
        />
      </label>
      <label className={cn(chip, "cursor-pointer", dateTo && "text-main-text")}>
        <span>To</span>
        <input
          type="date"
          value={dateTo ?? ""}
          onChange={(e) => updateParam("to", e.target.value || null)}
          aria-label="Date to"
          className="bg-transparent text-[12px] text-main-text outline-none [color-scheme:light] dark:[color-scheme:dark]"
        />
      </label>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="flex items-center gap-1 h-7 px-2 text-[12px] text-muted-text hover:text-main-text cursor-pointer"
        >
          <X size={11} weight="bold" />
          Clear
        </button>
      )}
    </div>
  );
}
