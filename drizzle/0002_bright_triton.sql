CREATE TABLE `storageUsage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`totalStorageBytes` int NOT NULL DEFAULT 0,
	`fileCount` int NOT NULL DEFAULT 0,
	`csvStorageBytes` int NOT NULL DEFAULT 0,
	`xlsxStorageBytes` int NOT NULL DEFAULT 0,
	`otherStorageBytes` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `storageUsage_id` PRIMARY KEY(`id`),
	CONSTRAINT `storageUsage_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `usageMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`generationType` varchar(64) NOT NULL,
	`dataType` varchar(64),
	`generationTime` int DEFAULT 0,
	`success` int NOT NULL DEFAULT 1,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `usageMetrics_id` PRIMARY KEY(`id`)
);
