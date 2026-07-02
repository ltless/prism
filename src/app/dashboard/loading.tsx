import { MediaGridSkeleton } from "@/features/media/components/library/MediaGridSkeleton";

export default function DashboardLoading() {
 return (
 <div className="flex-1 flex flex-col p-6">
 <div className="h-8 w-48 bg-main-border/30 rounded-xl animate-pulse mb-6" />
 <div className="flex gap-2 mb-6">
 {Array.from({ length: 4 }).map((_, i) => (
 <div key={i} className="h-8 w-24 bg-main-border/20 rounded-full animate-pulse" />
 ))}
 </div>
 <MediaGridSkeleton />
 </div>
 );
}
