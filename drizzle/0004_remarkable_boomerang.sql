CREATE TABLE `userFeedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`feedbackType` enum('bug','suggestion','feature_request','general') NOT NULL,
	`category` varchar(100) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`page` varchar(100),
	`userEmail` varchar(320),
	`status` enum('new','acknowledged','in_progress','resolved','closed') NOT NULL DEFAULT 'new',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userFeedback_id` PRIMARY KEY(`id`)
);
