import { MediaGridSkeleton } from "@/features/media/components/library/MediaGridSkeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-1 flex-col px-4 pb-6 pt-6 md:px-10 md:pt-8">
      <div className="mb-4 h-5 w-16 animate-pulse rounded-full bg-surface-bg" />
      <div className="mb-12 h-16 w-56 animate-pulse rounded-2xl bg-surface-bg" />
      <MediaGridSkeleton />
    </div>
  );
}
