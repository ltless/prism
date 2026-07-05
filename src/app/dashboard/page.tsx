import { auth } from "@/auth";
import MediaLibraryClient from "@/features/media/components/MediaLibraryClient";
import type { MediaItem } from "@/features/media/types";
import { goFetch } from "@/lib/api";
import { mapFolder, type FolderListResponse } from "@/types/goApi";

const PAGE_SIZE = 50;

type PageProps = {
  searchParams: Promise<{ f?: string; page?: string; v?: string }>;
};

type DashboardResponse = {
  items: MediaItem[];
  total: number;
  folderCounts: Record<string, number>;
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const sp = await searchParams;
  const activeFolderId = sp.f ?? null;
  const view = sp.v ?? null;
  const isFav = view === "favorite";
  const page = Math.max(1, Number(sp.page) || 1);

  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    dedup: "true",
  });
  if (activeFolderId) params.set("folder_id", activeFolderId);
  if (isFav) params.set("is_favorite", "true");

  const [dashRes, folderRes] = await Promise.all([
    goFetch<DashboardResponse>(`/api/v1/media/dashboard?${params}`),
    goFetch<FolderListResponse>("/api/v1/folders"),
  ]);

  const allFolders = (folderRes.items ?? []).map(mapFolder);

  return (
    <MediaLibraryClient
      initialItems={dashRes.items ?? []}
      folders={allFolders}
      totalCount={dashRes.total ?? 0}
      pageSize={PAGE_SIZE}
    />
  );
}
