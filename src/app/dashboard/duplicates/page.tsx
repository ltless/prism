import { auth } from "@/auth";
import { getUserDb } from "@/services/db/multitenant";
import { media, folders } from "@/services/db/schema";
import { eq, inArray, sql, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DuplicateList } from "../../../features/media/components/DuplicateList";
import { DuplicateGroup } from "../../../features/media/components/DuplicateList";
import type { MediaItem, MediaMetadata } from "@/features/media/types";
import { cosineSimilarity } from "@/shared/utils/cosineSimilarity";

const NEAR_DUPLICATE_THRESHOLD = 0.95;

export default async function DuplicatesPage() {
 const session = await auth();
 const userId = session?.user?.id;

 if (!userId) {
 redirect("/login");
 }

 const { db } = await getUserDb(userId);

 // 1. Exact duplicates: find hashes that appear more than once
 const duplicateHashesQuery = db
 .select({ hash: media.hash })
 .from(media)
 .where(eq(media.isTrash, false))
 .groupBy(media.hash)
 .having(sql`count(*) > 1`);

 const hashes = await duplicateHashesQuery;
 const hashList = hashes.map(h => h.hash);

 let exactGroups: DuplicateGroup[] = [];

 if (hashList.length > 0) {
 const rows = db
 .select()
 .from(media)
 .where(
 and(
 inArray(media.hash, hashList),
 eq(media.isTrash, false)
 )
 )
 .orderBy(sql`${media.hash} ASC, ${media.createdAt} DESC`)
 .all();

 const groupedMap = new Map<string, MediaItem[]>();
 rows.forEach(item => {
 const mapped: MediaItem = {
 ...item,
 isFavorite: item.isFavorite ?? undefined,
 isTrash: item.isTrash ?? undefined,
 isVault: item.isVault ?? undefined,
 metadata: item.metadata as MediaMetadata | undefined,
 };
 if (!groupedMap.has(item.hash)) groupedMap.set(item.hash, []);
 groupedMap.get(item.hash)!.push(mapped);
 });

 exactGroups = Array.from(groupedMap.entries()).map(([hash, items]) => ({
 id: `exact-${hash.substring(0, 8)}`,
 hash,
 items,
 isNearDuplicate: false,
 }));
 }

  // 2. Near-duplicates: find visually similar items via CLIP embeddings.
  // O(N²) comparison — cap the working set so large libraries don't block the
  // RSC render. Precompute on ingest (planned) to remove this limit.
  const MAX_NEAR_DUPLICATES = 1000;
  const allMedia = db
  .select()
  .from(media)
  .where(eq(media.isTrash, false))
  .all();

  const withEmbeddings = allMedia.filter(item => {
  const meta = item.metadata as MediaMetadata | undefined;
  return meta?.embedding && Array.isArray(meta.embedding) && meta.embedding.length > 0;
  });

  const nearGroups: DuplicateGroup[] = [];
  const visited = new Set<string>();

  if (withEmbeddings.length >= 2 && withEmbeddings.length <= MAX_NEAR_DUPLICATES) {
  for (let i = 0; i < withEmbeddings.length; i++) {
  const itemA = withEmbeddings[i];
  if (visited.has(itemA.id)) continue;

  const embeddingA = (itemA.metadata as MediaMetadata).embedding as number[];
  const cluster: MediaItem[] = [{
  ...itemA,
  isFavorite: itemA.isFavorite ?? undefined,
  isTrash: itemA.isTrash ?? undefined,
  isVault: itemA.isVault ?? undefined,
  metadata: itemA.metadata as MediaMetadata | undefined,
  }];

  for (let j = i + 1; j < withEmbeddings.length; j++) {
  const itemB = withEmbeddings[j];
  if (visited.has(itemB.id)) continue;

  const embeddingB = (itemB.metadata as MediaMetadata).embedding as number[];
  const similarity = cosineSimilarity(embeddingA, embeddingB);

  if (similarity >= NEAR_DUPLICATE_THRESHOLD) {
  cluster.push({
  ...itemB,
  isFavorite: itemB.isFavorite ?? undefined,
  isTrash: itemB.isTrash ?? undefined,
  isVault: itemB.isVault ?? undefined,
  metadata: itemB.metadata as MediaMetadata | undefined,
  });
  visited.add(itemB.id);
  }
  }

  if (cluster.length > 1) {
  visited.add(itemA.id);
  nearGroups.push({
  id: `near-${itemA.hash.substring(0, 8)}-${nearGroups.length}`,
  hash: itemA.hash,
  items: cluster,
  isNearDuplicate: true,
  });
  }
  }
  }

 // 3. Merge groups: exact duplicates take priority over near-duplicates
 const allGroups = [...exactGroups];
 const exactHashes = new Set(exactGroups.map(g => g.hash));

 for (const nearGroup of nearGroups) {
 const isAlreadyExact = nearGroup.items.some(item => exactHashes.has(item.hash));
 if (!isAlreadyExact) {
 allGroups.push(nearGroup);
 }
 }

 // 4. Build folder map for folder-aware display
 const folderRows = db.select().from(folders).all();
 const folderMap: Record<string, string> = {};
 for (const f of folderRows) {
 folderMap[f.id] = f.name;
 }

 return (
 <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
 <div className="flex-1 overflow-y-auto pt-12">
 <div className="px-4 md:px-8 mb-6">
 <h1 className="text-xl font-semibold text-main-text">Duplicates</h1>
 </div>
 <DuplicateList groups={allGroups} folderMap={folderMap} />
 </div>
 </main>
 );
}
