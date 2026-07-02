import { MediaGridSkeleton } from "@/features/media/components/library/MediaGridSkeleton";

// Matches the TrashLibrary grid region's horizontal padding so the loading
// skeleton's columns land where the real cards land.
export default function TrashLoading() {
  return (
    <div className="px-4 md:px-8">
      <MediaGridSkeleton />
    </div>
  );
}