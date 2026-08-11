CREATE TABLE `expense_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `expense_categories_household_name_uidx` ON `expense_categories` (`household_id`,`name_key`);--> statement-breakpoint
CREATE INDEX `expense_categories_household_idx` ON `expense_categories` (`household_id`);