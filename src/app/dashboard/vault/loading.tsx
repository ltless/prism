import { MediaGridSkeleton } from "@/features/media/components/library/MediaGridSkeleton";

export default function VaultLoading() {
  return (
    <div className="px-6">
      <MediaGridSkeleton />
    </div>
  );
}