-- Migration 0002: Restore performance indexes after hash unique constraint was dropped
--
-- Context: Migration 0001 dropped the `media_hash_unique` index to support multiple
-- DB records sharing the same physical file (deduplication via hash comparison).
-- However, without an index on `hash`, every dedup lookup becomes a full table scan.
-- This migration adds a non-unique index on `hash` for query performance,
-- plus composite indexes on frequently-queried filter columns.

CREATE INDEX IF NOT EXISTS `media_hash_idx` ON `media` (`hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `media_trash_created_idx` ON `media` (`is_trash`, `created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `media_folder_idx` ON `media` (`folder_id`);
