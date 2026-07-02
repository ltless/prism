import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import type { AppAIConfig } from "@/features/ai/types";

export const appConfig = sqliteTable('app_config', {
 id: text('id').primaryKey().default('global'),
 ai: text('ai', { mode: 'json' }).$type<AppAIConfig>(),
 updatedAt: integer('updated_at', { mode: 'timestamp' }),
 updatedBy: text('updated_by'),
});

// Key-value store for Next-managed global app settings (e.g. storage default
// quota). Kept separate from app_config to avoid the Go/drizzle schema mismatch.
export const appSettings = sqliteTable('app_settings', {
 key: text('key').primaryKey(),
 value: text('value'),
});

export const users = sqliteTable('users', {
 id: text('id').primaryKey(),
 username: text('username').notNull().unique(),
 passwordHash: text('password_hash').notNull(),
 role: text('role').notNull().default('user'),
 image: text('image'),
 coverImage: text('cover_image'),
 hasCompletedSetup: integer('has_completed_setup', { mode: 'boolean' }).default(false),
 vaultPin: text('vault_pin'),
 storageLimit: integer('storage_limit'),
 preferences: text('preferences', { mode: 'json' }),
 createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const folders = sqliteTable('folders', {
 id: text('id').primaryKey(),
 name: text('name').notNull(),
 color: text('color'),
 parentId: text('parent_id').references((): AnySQLiteColumn => folders.id),
 // 'manual' = regular folder (default), 'smart' = auto-populated by tag rules
 folderType: text('folder_type').notNull().default('manual'),
 // JSON: { categories: string[], minScore: number } — only used when folderType = 'smart'
 filterQuery: text('filter_query'),
 createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
});

export const media = sqliteTable('media', {
 id: text('id').primaryKey(),
 title: text('title').notNull(),
 filePath: text('file_path').notNull(),
 mimeType: text('mime_type').notNull(),
 size: integer('size').notNull(),
 width: integer('width'),
 height: integer('height'),
 hash: text('hash').notNull(),
 capturedAt: integer('captured_at', { mode: 'timestamp' }),
 metadata: text('metadata', { mode: 'json' }),
 folderId: text('folder_id').references(() => folders.id),
 isFavorite: integer('is_favorite', { mode: 'boolean' }).default(false),
 isTrash: integer('is_trash', { mode: 'boolean' }).default(false),
 isVault: integer('is_vault', { mode: 'boolean' }).default(false),
 updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
 createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`),
 duration: integer('duration'),
 transcodeStatus: text('transcode_status'),
}, (table) => ({
 hashIdx: index('idx_media_hash').on(table.hash),
 isTrashIdx: index('idx_media_trash').on(table.isTrash),
 folderIdIdx: index('idx_media_folder').on(table.folderId),
 isFavoriteIdx: index('idx_media_favorite').on(table.isFavorite),
 isVaultIdx: index('idx_media_vault').on(table.isVault),
}));

export const mediaTags = sqliteTable('media_tags', {
 id: integer('id').primaryKey({ autoIncrement: true }),
 mediaId: text('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
 tag: text('tag').notNull(),
 score: real('score').notNull(),
 category: text('category').notNull(),
}, (table) => ({
 mediaIdIdx: index('idx_media_tags_media_id').on(table.mediaId),
 tagIdx: index('idx_media_tags_tag').on(table.tag),
 categoryIdx: index('idx_media_tags_category').on(table.category),
 // composite for smart folder queries: WHERE category IN (...) AND score > ?
 categoryScoreIdx: index('idx_media_tags_cat_score').on(table.category, table.score),
}));

export const errorLogs = sqliteTable('error_logs', {
 id: integer('id').primaryKey({ autoIncrement: true }),
 level: text('level', { enum: ['info', 'warn', 'error'] }).notNull(),
 message: text('message').notNull(),
 meta: text('meta'),
 source: text('source'),
 timestamp: text('timestamp').notNull(),
});
