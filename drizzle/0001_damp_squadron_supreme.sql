CREATE TABLE `membership_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`member_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `membership_approvals_request_member_uidx` ON `membership_approvals` (`request_id`,`member_id`);--> statement-breakpoint
CREATE INDEX `membership_approvals_request_idx` ON `membership_approvals` (`request_id`);--> statement-breakpoint
CREATE TABLE `membership_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`action` text NOT NULL,
	`target_member_id` text NOT NULL,
	`target_name` text NOT NULL,
	`target_email` text NOT NULL,
	`requested_by_member_id` text NOT NULL,
	`required_approvals` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text
);
--> statement-breakpoint
CREATE INDEX `membership_requests_household_status_idx` ON `membership_requests` (`household_id`,`status`);--> statement-breakpoint
CREATE INDEX `membership_requests_target_idx` ON `membership_requests` (`target_member_id`);--> statement-breakpoint
ALTER TABLE `households` ADD `kind` text DEFAULT 'family' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `name_key` text;--> statement-breakpoint
ALTER TABLE `members` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `removed_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `members_household_name_uidx` ON `members` (`household_id`,`name_key`);