import { auth } from "@/auth";
import MediaLibraryClient from "@/features/media/components/MediaLibraryClient";
import { goFetch } from "@/lib/api";
import { mapFolder, mapMedia, type FolderListResponse, type GoMedia } from "@/types/goApi";

type PageProps = {
  searchParams: Promise<{ f?: string; page?: string; v?: string }>;
};

type DashboardResponse = {
  items: GoMedia[];
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

  const params = new URLSearchParams({
    dedup: "true",
    page: "1",
    limit: "200",
  });
  if (activeFolderId) params.set("folder_id", activeFolderId);
  if (isFav) params.set("is_favorite", "true");

  const [dashRes, folderRes] = await Promise.all([
    goFetch<DashboardResponse>(`/api/v1/media/dashboard?${params}`),
    goFetch<FolderListResponse>("/api/v1/folders"),
  ]);

  const allFolders = (folderRes.items ?? []).map(mapFolder);
  const smartFilter = allFolders.find(f => f.id === activeFolderId)?.smartFilter;

  let itemsRes = dashRes;
  let smartFilterUsed: { categories: string[]; minScore: number } | null = null;
  if (smartFilter) {
    smartFilterUsed = smartFilter;
    const smartParams = new URLSearchParams({
      smart: "true",
      minScore: String(smartFilter.minScore),
      categories: smartFilter.categories.join(","),
      page: "1",
      limit: "200",
    });
    itemsRes = await goFetch<DashboardResponse>(`/api/v1/media/dashboard?${smartParams}`);
  }

  return (
    <MediaLibraryClient
      initialItems={(itemsRes.items ?? []).map(mapMedia)}
      total={itemsRes.total ?? 0}
      initialFolderId={activeFolderId}
      initialFavorite={isFav}
      initialSmartFilter={smartFilterUsed}
      folders={allFolders}
    />
  );
}
