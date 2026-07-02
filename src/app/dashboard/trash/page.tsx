import { auth } from "@/auth";
import { getUserDb } from "@/services/db/multitenant";
import { media } from "@/services/db/schema";
import { desc } from "drizzle-orm";
import TrashLibrary from "@/features/media/components/TrashLibrary";
import type { MediaItem, MediaMetadata } from "@/features/media/types";

export default async function TrashPage() {
 const session = await auth();
 const userId = session?.user?.id;
 if (!userId) return <TrashLibrary initialItems={[]} />;

 const { db } = await getUserDb(userId);
 const rows = await db.query.media.findMany({
 orderBy: [desc(media.updatedAt)],
 where: (media, { eq }) => eq(media.isTrash, true),
 });

 const items: MediaItem[] = rows.map(item => ({
 ...item,
 isFavorite: item.isFavorite ?? undefined,
 isTrash: item.isTrash ?? undefined,
 metadata: item.metadata as MediaMetadata | undefined,
 }));

 return <TrashLibrary initialItems={items} />;
}
