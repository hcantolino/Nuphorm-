CREATE TABLE `subscriptionEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`stripeEventId` varchar(255),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptionEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStatus` enum('trial','active','canceled','expired') DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionStartDate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionEndDate` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `trialUsedCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `trialUsedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `profileImage` text;