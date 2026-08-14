CREATE TABLE `household_daily_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`effective_date` text NOT NULL,
	`daily_budget_cents` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_daily_budgets_household_date_uidx` ON `household_daily_budgets` (`household_id`,`effective_date`);--> statement-breakpoint
CREATE INDEX `household_daily_budgets_household_idx` ON `household_daily_budgets` (`household_id`);--> statement-breakpoint
ALTER TABLE `households` ADD `setup_completed_at` text;--> statement-breakpoint
INSERT INTO `household_daily_budgets` (`id`, `household_id`, `effective_date`, `daily_budget_cents`, `created_at`)
SELECT lower(hex(randomblob(16))), `id`, '2026-08-11', 2000, datetime('now')
FROM `households`;--> statement-breakpoint
UPDATE `households`
SET `setup_completed_at` = datetime('now')
WHERE `setup_completed_at` IS NULL;
