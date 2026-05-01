CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`username` text NOT NULL,
	`description` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ap_ar_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`amount` real NOT NULL,
	`paid_amount` real DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`contact_id` text NOT NULL,
	`contact_name` text,
	`deletedAt` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`bank_id` text NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`expected_amount` real NOT NULL,
	`actual_amount` real NOT NULL,
	`difference` real NOT NULL,
	`difference_reason` text,
	`contact_id` text,
	`linked_stock_tx_id` text,
	`linked_loan_id` text,
	`advance_id` text,
	`deletedAt` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`bank_id`) REFERENCES `banks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `banks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `cash_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`type` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`expected_amount` real NOT NULL,
	`actual_amount` real NOT NULL,
	`difference` real NOT NULL,
	`difference_reason` text,
	`contact_id` text,
	`linked_stock_tx_id` text,
	`linked_loan_id` text,
	`advance_id` text,
	`deletedAt` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`direction` text,
	`is_deletable` integer DEFAULT true
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `initial_stock` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`weight` real NOT NULL,
	`purchase_price_per_kg` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `ledger_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`ap_ar_transaction_id` text NOT NULL,
	`amount` real NOT NULL,
	`date` text NOT NULL,
	`payment_method` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`ap_ar_transaction_id`) REFERENCES `ap_ar_transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `loan_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`payment_date` text NOT NULL,
	`amount` real NOT NULL,
	`linked_transaction_id` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`type` text NOT NULL,
	`principal_amount` real NOT NULL,
	`interest_rate` real NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text,
	`status` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `monthly_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_date` text NOT NULL,
	`cash_balance` real NOT NULL,
	`bank_balances` text NOT NULL,
	`stock_items` text NOT NULL,
	`total_receivables` real NOT NULL,
	`total_payables` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `stock_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`stock_item_name` text NOT NULL,
	`type` text NOT NULL,
	`weight` real NOT NULL,
	`price_per_kg` real NOT NULL,
	`payment_method` text NOT NULL,
	`bank_id` text,
	`description` text,
	`expected_amount` real NOT NULL,
	`actual_amount` real NOT NULL,
	`difference` real NOT NULL,
	`difference_reason` text,
	`contact_id` text,
	`contact_name` text,
	`deletedAt` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`bank_id`) REFERENCES `banks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
