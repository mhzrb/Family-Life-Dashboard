CREATE TABLE `telegram_conversation_state` (
	`chat_id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`category` text,
	`updated_at` text NOT NULL
);
