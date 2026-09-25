CREATE TABLE IF NOT EXISTS `inspection_records` (
	`id` text PRIMARY KEY NOT NULL,
	`feature_id` text NOT NULL,
	`month` text NOT NULL,
	`status` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`feature_id`) REFERENCES `features`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `inspection_records_feature_month_unique` ON `inspection_records` (`feature_id`, `month`);
