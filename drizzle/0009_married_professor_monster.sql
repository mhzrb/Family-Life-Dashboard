CREATE TABLE `household_monthly_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`month` text NOT NULL,
	`adjustment_cents` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `household_monthly_budgets_household_month_uidx` ON `household_monthly_budgets` (`household_id`,`month`);--> statement-breakpoint
CREATE INDEX `household_monthly_budgets_household_idx` ON `household_monthly_budgets` (`household_id`);--> statement-breakpoint
INSERT INTO `household_monthly_budgets` (`id`, `household_id`, `month`, `adjustment_cents`, `updated_at`)
SELECT lower(hex(randomblob(16))), `id`, `budget_adjustment_month`, `budget_adjustment_cents`, datetime('now')
FROM `households`
WHERE `budget_adjustment_month` IS NOT NULL;
