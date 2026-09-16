-- AlterTable
ALTER TABLE `product` ADD COLUMN `category` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `costPrice` DECIMAL(10, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `expiryDate` DATETIME(3) NULL,
    ADD COLUMN `lowStockThreshold` DECIMAL(10, 2) NULL;
