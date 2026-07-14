import { pgTable, text, integer, boolean, doublePrecision, timestamp, index, serial, json, jsonb } from 'drizzle-orm/pg-core';
import type { AppAIConfig } from "@/features/ai/types";

export const appConfig = pgTable('app_config', {
  id: text('id').primaryKey().default('global'),
  ai: json('ai').$type<AppAIConfig>(),
  updatedAt: integer('updated_at'),
  updatedBy: text('updated_by'),
});

// Key-value store for Next-managed global app settings (e.g. storage default
// quota). Kept separate from app_config to avoid the Go/drizzle schema mismatch.
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('user'),
  image: text('image'),
  coverImage: text('cover_image'),
  hasCompletedSetup: boolean('has_completed_setup').default(false),
  vaultPin: text('vault_pin'),
  storageLimit: integer('storage_limit'),
  preferences: jsonb('preferences'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const folders = pgTable('folders', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  color: text('color'),
  parentId: text('parent_id'),
  // 'manual' = regular folder (default), 'smart' = auto-populated by tag rules
  folderType: text('folder_type').notNull().default('manual'),
  // JSON: { categories: string[], minScore: number } — only used when folderType = 'smart'
  filterQuery: text('filter_query'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
});

export const media = pgTable('media', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  filePath: text('file_path').notNull(),
  mimeType: text('mime_type').notNull(),
  size: integer('size').notNull(),
  width: integer('width'),
  height: integer('height'),
  hash: text('hash').notNull(),
  capturedAt: integer('captured_at'),
  metadata: jsonb('metadata'),
  folderId: text('folder_id'),
  isFavorite: boolean('is_favorite').default(false),
  isTrash: boolean('is_trash').default(false),
  isVault: boolean('is_vault').default(false),
  updatedAt: integer('updated_at'),
  createdAt: integer('created_at'),
  duration: integer('duration'),
  transcodeStatus: text('transcode_status'),
}, (table) => ({
  hashIdx: index('idx_media_hash').on(table.hash),
  isTrashIdx: index('idx_media_trash').on(table.isTrash),
  folderIdIdx: index('idx_media_folder').on(table.folderId),
  isFavoriteIdx: index('idx_media_favorite').on(table.isFavorite),
  isVaultIdx: index('idx_media_vault').on(table.isVault),
  userIdIdx: index('idx_media_user_id').on(table.userId),
}));

export const mediaTags = pgTable('media_tags', {
  id: serial('id').primaryKey(),
  mediaId: text('media_id').notNull().references(() => media.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tag: text('tag').notNull(),
  score: doublePrecision('score').notNull(),
  category: text('category').notNull(),
}, (table) => ({
  mediaIdIdx: index('idx_media_tags_media_id').on(table.mediaId),
  tagIdx: index('idx_media_tags_tag').on(table.tag),
  categoryIdx: index('idx_media_tags_category').on(table.category),
  // composite for smart folder queries: WHERE category IN (...) AND score > ?
  categoryScoreIdx: index('idx_media_tags_cat_score').on(table.category, table.score),
  userIdIdx: index('idx_media_tags_user_id').on(table.userId),
}));

export const errorLogs = pgTable('error_logs', {
  id: serial('id').primaryKey(),
  level: text('level', { enum: ['info', 'warn', 'error'] }).notNull(),
  message: text('message').notNull(),
  meta: text('meta'),
  source: text('source'),
  timestamp: text('timestamp').notNull(),
});
