CREATE TABLE `telegram_bot_state` (
	`id` text PRIMARY KEY NOT NULL,
	`next_update_id` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `telegram_update_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_telegram_update_uidx` ON `transactions` (`telegram_update_id`);