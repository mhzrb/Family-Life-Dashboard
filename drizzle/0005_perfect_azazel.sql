CREATE TABLE `api_rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_started_at` integer NOT NULL,
	`request_count` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`actor_member_id` text,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text,
	`summary` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_logs_household_date_idx` ON `audit_logs` (`household_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `expense_categories` ADD `created_by_member_id` text;--> statement-breakpoint
ALTER TABLE `expense_categories` ADD `archived_at` text;--> statement-breakpoint
ALTER TABLE `members` ADD `telegram_link_code_expires_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `updated_at` text;--> statement-breakpoint
ALTER TABLE `transactions` ADD `deleted_at` text;