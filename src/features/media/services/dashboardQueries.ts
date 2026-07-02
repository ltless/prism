import { media, mediaTags } from "@/services/db/schema";
import { desc, eq, and, inArray, isNull, sql, gte, notInArray } from "drizzle-orm";
import type { MediaItem, Folder, SmartFolderFilter } from "@/features/media/types";
import type { BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import type * as schema from "@/services/db/schema";
import { getSmartFolderMatchingMediaIds } from "@/features/media/utils/smartFolderQuery";
import { parseSmartFolderFilter } from "@/features/media/schemas";

export type DashboardResult = {
  items: MediaItem[];
  totalCount: number;
  folderCounts: Record<string, number>;
  allFolders: Folder[];
};

export function getSmartFolderFilter(
  allFolders: Folder[],
  activeFolderId: string | null,
  skipFolderFilter: boolean
): SmartFolderFilter | null {
  if (skipFolderFilter || !activeFolderId) return null;

  const activeFolder = allFolders.find(f => f.id === activeFolderId);
  if (activeFolder?.folderType === "smart" && activeFolder.filterQuery) {
    return parseSmartFolderFilter(activeFolder.filterQuery);
  }
  return null;
}

export function getDashboardItems(
  db: BetterSQLite3Database<typeof schema>,
  activeSmartFilter: SmartFolderFilter | null,
  skipFolderFilter: boolean,
  activeFolderId: string | null,
  isFav: boolean,
  page: number,
  pageSize: number,
  allFolders: Folder[]
): DashboardResult {
  const favoriteCondition = isFav ? eq(media.isFavorite, true) : undefined;

  let baseWhere;
  let totalCount = 0;
  let regularFolderCounts: Record<string, number> = {};

  if (activeSmartFilter) {
    // smart folder: gather matching media IDs via media_tags, bypass folderId filter
    const matchingIds = db
      .selectDistinct({ mediaId: mediaTags.mediaId })
      .from(mediaTags)
      .where(
        and(
          inArray(mediaTags.category, activeSmartFilter.categories),
          gte(mediaTags.score, activeSmartFilter.minScore)
        )
      )
      .all()
      .map(r => r.mediaId);

    const dedupSubquery = db
      .select({ id: sql`MIN(${media.id})`.mapWith(Number) })
      .from(media)
      .where(
        and(eq(media.isTrash, false), eq(media.isVault, false),
          matchingIds.length > 0 ? inArray(media.id, matchingIds) : sql`1=0`)
      )
      .groupBy(media.hash);

    baseWhere = and(
      eq(media.isTrash, false),
      eq(media.isVault, false),
      matchingIds.length > 0 ? inArray(media.id, matchingIds) : sql`1=0`,
      inArray(media.id, dedupSubquery)
    );

    totalCount = matchingIds.length;

    // Compute inbox count excluding smart-tagged items so sidebar shows correct count
    const excludedSmartIds = getSmartFolderMatchingMediaIds(db);
    if (excludedSmartIds.length > 0) {
      const smartIdList = sql.join(excludedSmartIds.map(id => sql`${id}`), sql`, `);
      const inboxCountRow = db.all(sql`SELECT COUNT(*) as total FROM (SELECT MIN(id) FROM media WHERE is_trash = false AND is_vault = 0 AND folder_id IS NULL AND id NOT IN (${smartIdList}) GROUP BY hash) dedup`) as { total: number }[];
      regularFolderCounts['__inbox__'] = inboxCountRow[0]?.total ?? 0;
    } else {
      const inboxCountRow = db.all(sql`SELECT COUNT(*) as total FROM (SELECT MIN(id) FROM media WHERE is_trash = false AND is_vault = 0 AND folder_id IS NULL GROUP BY hash) dedup`) as { total: number }[];
      regularFolderCounts['__inbox__'] = inboxCountRow[0]?.total ?? 0;
    }
  } else {
    const folderCondition = skipFolderFilter
      ? undefined
      : activeFolderId === null
        ? isNull(media.folderId)
        : activeFolderId
          ? eq(media.folderId, activeFolderId)
          : undefined;

    // Exclude smart-tagged items from inbox
    let excludedCondition = undefined;
    if (activeFolderId === null && !skipFolderFilter) {
      const excludedMediaIds = getSmartFolderMatchingMediaIds(db);
      if (excludedMediaIds.length > 0) {
        excludedCondition = notInArray(media.id, excludedMediaIds);
      }
    }

    const dedupSubquery = db
      .select({ id: sql`MIN(${media.id})`.mapWith(Number) })
      .from(media)
      .where(
        and(eq(media.isTrash, false), eq(media.isVault, false), folderCondition, favoriteCondition, excludedCondition)
      )
      .groupBy(media.hash);

    const countDedup = db
      .select({ id: sql`MIN(${media.id})`.mapWith(Number) })
      .from(media)
      .where(and(eq(media.isTrash, false), eq(media.isVault, false), favoriteCondition, excludedCondition))
      .groupBy(media.hash);

    baseWhere = and(
      eq(media.isTrash, false),
      eq(media.isVault, false),
      folderCondition,
      favoriteCondition,
      excludedCondition,
      inArray(media.id, dedupSubquery)
    );

    const folderSql = skipFolderFilter
      ? sql``
      : activeFolderId === null
        ? sql`AND folder_id IS NULL`
        : activeFolderId
          ? sql`AND folder_id = ${activeFolderId}`
          : sql``;
    const favSql = isFav ? sql`AND is_favorite = 1` : sql``;

    let countRows;
    if (activeFolderId === null && !skipFolderFilter) {
      // For inbox: exclude items that match any smart folder
      const smartIds = getSmartFolderMatchingMediaIds(db);
      if (smartIds.length > 0) {
        const smartIdList = sql.join(smartIds.map(id => sql`${id}`), sql`, `);
        countRows = db.all(sql`SELECT COUNT(*) as total FROM (SELECT MIN(id) FROM media WHERE is_trash = false AND is_vault = 0 AND id NOT IN (${smartIdList}) ${folderSql} ${favSql} GROUP BY hash) dedup`) as { total: number }[];
      } else {
        countRows = db.all(sql`SELECT COUNT(*) as total FROM (SELECT MIN(id) FROM media WHERE is_trash = false AND is_vault = 0 ${folderSql} ${favSql} GROUP BY hash) dedup`) as { total: number }[];
      }
    } else {
      countRows = db.all(sql`SELECT COUNT(*) as total FROM (SELECT MIN(id) FROM media WHERE is_trash = false AND is_vault = 0 ${folderSql} ${favSql} GROUP BY hash) dedup`) as { total: number }[];
    }
    totalCount = countRows[0]?.total ?? 0;

    // compute smart folder counts while we have db open
    const folderCountRows = db.select({
      folderId: media.folderId,
      count: sql<number>`COUNT(*)`.as('count')
    }).from(media)
    .where(and(eq(media.isTrash, false), eq(media.isVault, false), inArray(media.id, countDedup)))
    .groupBy(media.folderId)
    .all();

    regularFolderCounts = {};
    for (const row of folderCountRows) {
      const key = row.folderId ?? '__inbox__';
      regularFolderCounts[key] = row.count;
    }
  }

  const items = db
    .select()
    .from(media)
    .where(baseWhere)
    .orderBy(desc(media.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
    .all();

  // build folderCounts for sidebar — smart folders get their count from media_tags
  const folderCounts: Record<string, number> = { __inbox__: regularFolderCounts?.['__inbox__'] ?? 0 };
  const smartFolders = allFolders.filter(f => f.folderType === "smart" && f.filterQuery);
  if (smartFolders.length > 0) {
    const unionParts = smartFolders.map(folder => {
      const sf = parseSmartFolderFilter(folder.filterQuery);
      if (!sf || sf.categories.length === 0) return null;
      // Parameterize categories via inArray — never interpolate them raw.
      return sql`SELECT ${folder.id} AS folder_id, COUNT(DISTINCT ${mediaTags.mediaId}) AS cnt FROM ${mediaTags} WHERE ${inArray(mediaTags.category, sf.categories)} AND ${mediaTags.score} >= ${sf.minScore}`;
    }).filter((p): p is NonNullable<typeof p> => p !== null);
    if (unionParts.length > 0) {
      const unionQuery = sql.join(unionParts, sql` UNION ALL `);
      const rows = db.all(unionQuery) as { folder_id: string; cnt: number }[];
      for (const row of rows) {
        folderCounts[row.folder_id] = row.cnt;
      }
    }
  }
  for (const folder of allFolders) {
    if (folder.folderType !== "smart") {
      folderCounts[folder.id] = regularFolderCounts?.[folder.id] ?? 0;
    }
  }

  return {
    items: items as MediaItem[],
    totalCount,
    folderCounts,
    allFolders,
  };
}
