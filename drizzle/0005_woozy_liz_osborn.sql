CREATE TABLE `uploadedFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSizeBytes` int NOT NULL,
	`folderId` varchar(64),
	`tags` text,
	`description` text,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `uploadedFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `usageMetrics`;