CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`residentialSplitCode` varchar(50),
	`commercialSplitCode` varchar(50),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`zohoCustomerId` varchar(100),
	`email` varchar(320) NOT NULL,
	`name` text,
	`phone` varchar(20),
	`customerType` enum('residential','commercial') NOT NULL,
	`address` text,
	`companyId` int,
	`buildingId` varchar(100),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthlyBills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`companyId` int NOT NULL,
	`buildingId` varchar(100),
	`billingMonth` varchar(7) NOT NULL,
	`totalAmount` int NOT NULL,
	`pickupCount` int NOT NULL,
	`invoiceId` varchar(100),
	`zohoInvoiceId` varchar(100),
	`status` enum('pending','sent','paid','failed') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthlyBills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pickups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`companyId` int NOT NULL,
	`pickupType` enum('payt','monthly') NOT NULL,
	`customerType` enum('residential','commercial') NOT NULL,
	`amount` int NOT NULL,
	`paymentStatus` enum('pending','paid','failed') NOT NULL DEFAULT 'pending',
	`paystackReference` varchar(100),
	`surveyId` varchar(100),
	`pickupDate` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pickups_id` PRIMARY KEY(`id`)
);
