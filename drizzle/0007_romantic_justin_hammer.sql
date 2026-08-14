ALTER TABLE `households` ADD `budget_adjustment_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `households` ADD `budget_adjustment_month` text;--> statement-breakpoint
ALTER TABLE `members` ADD `can_view_household` integer DEFAULT false NOT NULL;