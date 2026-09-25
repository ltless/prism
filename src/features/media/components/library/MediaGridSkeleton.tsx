import { MEDIA_GRID_CLASS } from "./MediaGrid";

export function MediaGridSkeleton() {
  return (
    <div className={MEDIA_GRID_CLASS}>
      {Array.from({ length: 18 }).map((_, i) => (
        <div
          key={i}
          className="aspect-[4/5] animate-pulse rounded-[1.75rem] bg-main-text/[0.045] p-1.5 ring-1 ring-main-text/[0.06]"
        >
          <div className="h-full w-full rounded-[calc(1.75rem-0.375rem)] bg-surface-bg" />
        </div>
      ))}
    </div>
  );
}
