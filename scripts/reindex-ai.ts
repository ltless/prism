import fs from "fs/promises";
import path from "path";

import { getUserDb } from "../src/services/db/multitenant";
import { media } from "../src/services/db/schema";
import { and, eq } from "drizzle-orm";

import {
  sidecarBatchTag,
  sidecarBatchScore,
  type SidecarBatchTagItem,
  type SidecarBatchScoreItem,
} from "../src/services/ai/sidecar-client";

import { getStorageRoot } from "../src/core/utils/paths";

const BATCH_SIZE = 16;
const TAG_VARIANT = "high";
const TAG_THRESHOLD = 0.1;
const SCORE_MODEL = "laion";
const SCORE_VARIANT = "high";

type MediaRow = {
  id: string;
  filePath: string;
  metadata: Record<string, unknown> | null;
};

function parseArgs() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`reindex-ai — re-tag (RAM), re-embed (CLIP-high 768-d), re-score (LAION aesthetic) all media

Usage:
  npx tsx scripts/reindex-ai.ts [--user <id>] [--dry-run] [--help]

Flags:
  --user <id>   Re-index a single tenant/user only.
  --dry-run     Log counts and intended writes without touching the DB.
  --help        Show this message.
`);
    process.exit(0);
  }

  const dryRun = args.includes("--dry-run");

  const userIdx = args.indexOf("--user");
  const singleUser =
    userIdx !== -1 && args[userIdx + 1] ? args[userIdx + 1] : undefined;

  return { dryRun, singleUser };
}

async function listUserIds(): Promise<string[]> {
  const usersDir = path.join(getStorageRoot(), "users");
  let entries: import("fs").Dirent[];
  try {
    entries = await fs.readdir(usersDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name);
}

async function reindexUser(
  userId: string,
  dryRun: boolean,
): Promise<{ processed: number; skipped: number; failed: number }> {
  const { db, paths } = await getUserDb(userId);

  const rows = await db
    .select({
      id: media.id,
      filePath: media.filePath,
      metadata: media.metadata,
    })
    .from(media)
    .where(and(eq(media.isTrash, false), eq(media.isVault, false)));

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE) as MediaRow[];

    // Resolve on-disk file; skip anything missing so we never send a dead path.
    const items: { row: MediaRow; absolutePath: string }[] = [];
    for (const row of batch) {
      const absolutePath = path.join(paths.mediaDir, row.filePath);
      try {
        await fs.access(absolutePath);
        items.push({ row, absolutePath });
      } catch {
        skipped++;
        console.warn(`  skip (missing file): ${userId}/${row.filePath}`);
      }
    }

    if (items.length === 0) continue;

    const tagItems: SidecarBatchTagItem[] = items.map(({ row, absolutePath }) => ({
      id: row.id,
      filePath: absolutePath,
    }));
    const scoreItems: SidecarBatchScoreItem[] = items.map(({ row, absolutePath }) => ({
      id: row.id,
      filePath: absolutePath,
    }));

    try {
      const [tagRes, scoreRes] = await Promise.all([
        sidecarBatchTag(tagItems, TAG_VARIANT, TAG_THRESHOLD, BATCH_SIZE),
        sidecarBatchScore(scoreItems, SCORE_MODEL, SCORE_VARIANT, BATCH_SIZE),
      ]);

      const tagById = new Map(tagRes.results.map((r) => [r.id, r]));
      const scoreById = new Map(scoreRes.results.map((r) => [r.id, r]));

      for (const { row } of items) {
        const tagR = tagById.get(row.id);
        const scoreR = scoreById.get(row.id);

        if (!tagR && !scoreR) {
          failed++;
          continue;
        }

        const meta: Record<string, unknown> = {
          ...(row.metadata && typeof row.metadata === "object" ? row.metadata : {}),
        };

        if (tagR && !tagR.error) {
          meta.tags = tagR.tags;
          meta.tagScores = tagR.tagScores;
          if (tagR.embedding) meta.embedding = tagR.embedding;
          meta.aiProcessed = true;
        }

        if (scoreR && !scoreR.error) {
          if (scoreR.score != null) meta.aestheticScore = scoreR.score;
          if (scoreR.raw != null) meta.aestheticRaw = scoreR.raw;
          meta.aestheticModel = scoreR.model;
          meta.aestheticScored = true;
          meta.aestheticScoredAt = new Date().toISOString();
        }

        meta.updatedAt = new Date().toISOString();

        if (dryRun) {
          console.log(
            `  [dry-run] ${userId}/${row.filePath} -> tags:${tagR ? tagR.tags.length : "-"}${
              meta.embedding ? ` embedding:${Array.isArray(meta.embedding) ? meta.embedding.length : "?"}d` : ""
            } aesthetic:${scoreR && scoreR.score != null ? scoreR.score.toFixed(3) : "-"}`,
          );
        } else {
          await db
            .update(media)
            .set({ metadata: meta })
            .where(eq(media.id, row.id));
        }

        processed++;
      }
    } catch (err) {
      failed += items.length;
      console.error(
        `  batch failed for ${userId} (${items.length} items):`,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  console.log(
    `User ${userId}: processed=${processed} skipped=${skipped} failed=${failed}`,
  );
  return { processed, skipped, failed };
}

async function main() {
  const { dryRun, singleUser } = parseArgs();

  const userIds = singleUser ? [singleUser] : await listUserIds();

  if (userIds.length === 0) {
    console.log("No user directories found. Nothing to re-index.");
    return;
  }

  console.log(
    `Re-indexing ${userIds.length} user(s)${dryRun ? " (dry-run)" : ""}...`,
  );

  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const { processed, skipped, failed } = await reindexUser(userId, dryRun);
    totalProcessed += processed;
    totalSkipped += skipped;
    totalFailed += failed;
  }

  console.log(
    `DONE: total processed=${totalProcessed} skipped=${totalSkipped} failed=${totalFailed}`,
  );
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error("Fatal:", err instanceof Error ? err.message : String(err));
    process.exit(1);
  },
);
