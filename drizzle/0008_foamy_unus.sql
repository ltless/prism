CREATE TABLE `app_config` (
	`id` text PRIMARY KEY DEFAULT 'global' NOT NULL,
	`ai` text,
	`updated_at` integer,
	`updated_by` text
);
--> statement-breakpoint
ALTER TABLE `users` ADD `preferences` text;--> statement-breakpoint
CREATE INDEX `idx_media_hash` ON `media` (`hash`);--> statement-breakpoint
CREATE INDEX `idx_media_trash` ON `media` (`is_trash`);--> statement-breakpoint
CREATE INDEX `idx_media_folder` ON `media` (`folder_id`);--> statement-breakpoint
CREATE INDEX `idx_media_favorite` ON `media` (`is_favorite`);