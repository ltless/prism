import { auth } from "@/auth";
import { folders } from "@/services/db/schema";
import MediaLibraryClient from "@/features/media/components/MediaLibraryClient";
import type { Folder } from "@/features/media/types";
import { getUserDb } from "@/services/db/multitenant";
import { getDashboardItems, getSmartFolderFilter } from "@/features/media/services/dashboardQueries";

const PAGE_SIZE = 50;

type PageProps = {
  searchParams: Promise<{ f?: string; page?: string; v?: string }>;
};

export default async function DashboardPage({
  searchParams,
}: PageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  const sp = await searchParams;
  const activeFolderId = sp.f ?? null;
  const view = sp.v ?? null;
  const isRecent = view === 'recent';
  const isFav = view === 'favorite';
  const page = Math.max(1, Number(sp.page) || 1);

  if (!userId) {
    return null;
  }

  const { db } = await getUserDb(userId);

  // load folders first so we can detect smart folder before building query
  const allFolders = await db.select().from(folders);

  const skipFolderFilter = isRecent || isFav;

  // check if the active folder is a smart folder
  const activeSmartFilter = getSmartFolderFilter(
    allFolders as Folder[],
    activeFolderId,
    skipFolderFilter
  );

  const { items, totalCount, allFolders: foldersList } = getDashboardItems(
    db,
    activeSmartFilter,
    skipFolderFilter,
    activeFolderId,
    isFav,
    page,
    PAGE_SIZE,
    allFolders as Folder[]
  );

  return (
    <MediaLibraryClient
      initialItems={items}
      folders={foldersList}
      totalCount={totalCount}
      pageSize={PAGE_SIZE}
    />
  );
}
