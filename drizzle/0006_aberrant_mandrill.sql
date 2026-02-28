CREATE TABLE `documentCitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`documentId` int NOT NULL,
	`sourceDocumentId` int NOT NULL,
	`citationText` text NOT NULL,
	`citationContext` text,
	`citationPage` varchar(50),
	`confidence` int DEFAULT 100,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `documentCitations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `documentGenerationJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`jobType` varchar(100) NOT NULL,
	`documentsToGenerate` text,
	`status` enum('queued','processing','completed','failed') NOT NULL DEFAULT 'queued',
	`progress` int DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `documentGenerationJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `generatedRegulatoryDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`documentType` enum('device_description','intended_use','substantial_equivalence','safety_evaluation','performance_evaluation','clinical_evaluation','risk_analysis','biocompatibility','sterilization','labeling_instructions','510k_summary','de_novo_summary') NOT NULL,
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`generationStatus` enum('generating','completed','failed') NOT NULL DEFAULT 'generating',
	`generationError` text,
	`generatedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `generatedRegulatoryDocuments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regulatoryProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`deviceName` varchar(255) NOT NULL,
	`deviceType` varchar(100) NOT NULL,
	`intendedUse` text,
	`predicateDevices` text,
	`status` enum('draft','in_progress','generated','reviewed','submitted') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regulatoryProjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regulatorySourceDocuments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int NOT NULL,
	`sourceType` enum('clinical_data','technical_spec','safety_report','performance_data','literature','other') NOT NULL,
	`documentName` varchar(255) NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSizeBytes` int NOT NULL,
	`extractedText` text,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regulatorySourceDocuments_id` PRIMARY KEY(`id`)
);
