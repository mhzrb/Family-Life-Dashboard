CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_currency` text DEFAULT 'EUR' NOT NULL,
	`city` text DEFAULT 'Hengelo' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#1f6f5f' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`telegram_link_code` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `members_email_idx` ON `members` (`email`);--> statement-breakpoint
CREATE INDEX `members_household_idx` ON `members` (`household_id`);--> statement-breakpoint
CREATE TABLE `telegram_links` (
	`chat_id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`household_id` text NOT NULL,
	`linked_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `telegram_member_idx` ON `telegram_links` (`member_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`member_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`base_amount_cents` integer NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`category` text NOT NULL,
	`note` text NOT NULL,
	`type` text DEFAULT 'expense' NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`happened_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `transactions_household_date_idx` ON `transactions` (`household_id`,`happened_at`);--> statement-breakpoint
CREATE INDEX `transactions_member_idx` ON `transactions` (`member_id`);