import { MediaGridSkeleton } from "@/features/media/components/library/MediaGridSkeleton";

export default function DashboardLoading() {
  return (
    <div className="flex-1 flex flex-col px-6 pb-6 pt-2">
      <div className="h-6 w-40 bg-surface-bg rounded-md animate-pulse mb-5" />
      <div className="flex gap-1.5 mb-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 w-20 bg-surface-bg/60 rounded-md animate-pulse" />
        ))}
      </div>
      <MediaGridSkeleton />
    </div>
  );
}
