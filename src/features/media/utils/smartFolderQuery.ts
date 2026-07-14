import { mediaTags, folders } from "@/services/db/schema";
import { eq, and, inArray, gte, or } from "drizzle-orm";
import { parseSmartFolderFilter } from "@/features/media/schemas";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "@/services/db/schema";

export async function getSmartFolderMatchingMediaIds(db: NodePgDatabase<typeof schema>): Promise<string[]> {
	const smartFolders = await db.select().from(folders).where(eq(folders.folderType, "smart"));
	if (smartFolders.length === 0) return [];

	const conditions = smartFolders.map((f) => {
		const filter = parseSmartFolderFilter(f.filterQuery);
		if (filter && filter.categories.length > 0) {
			return and(
				inArray(mediaTags.category, filter.categories),
				gte(mediaTags.score, filter.minScore)
			);
		}
		return null;
	}).filter((c): c is NonNullable<typeof c> => c !== null);

  if (conditions.length === 0) return [];

  const matchingRows = await db
    .selectDistinct({ mediaId: mediaTags.mediaId })
    .from(mediaTags)
    .where(or(...conditions));

  return matchingRows.map((r) => r.mediaId);
}
