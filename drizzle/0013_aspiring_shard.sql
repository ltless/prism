CREATE TABLE `media_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`media_id` text NOT NULL,
	`tag` text NOT NULL,
	`score` real NOT NULL,
	`category` text NOT NULL,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_media_tags_media_id` ON `media_tags` (`media_id`);--> statement-breakpoint
CREATE INDEX `idx_media_tags_tag` ON `media_tags` (`tag`);--> statement-breakpoint
CREATE INDEX `idx_media_tags_category` ON `media_tags` (`category`);--> statement-breakpoint
CREATE INDEX `idx_media_tags_cat_score` ON `media_tags` (`category`,`score`);--> statement-breakpoint
ALTER TABLE `folders` ADD `folder_type` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `folders` ADD `filter_query` text;