-- AlterTable
ALTER TABLE `TimeSlot` ADD COLUMN `breakAfter` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `endTime` VARCHAR(191) NULL,
    ADD COLUMN `startTime` VARCHAR(191) NULL,
    ADD COLUMN `versionId` INTEGER NULL;

-- CreateTable
CREATE TABLE `SpecialBlock` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `versionId` INTEGER NOT NULL,
    `day` VARCHAR(191) NOT NULL,
    `fromSlot` INTEGER NOT NULL,
    `toSlot` INTEGER NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `subLabel` VARCHAR(191) NULL,
    `allBatches` BOOLEAN NOT NULL DEFAULT false,

    INDEX `SpecialBlock_versionId_idx`(`versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SpecialBlockBatch` (
    `specialBlockId` INTEGER NOT NULL,
    `batchId` INTEGER NOT NULL,

    INDEX `SpecialBlockBatch_batchId_idx`(`batchId`),
    PRIMARY KEY (`specialBlockId`, `batchId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `TimeSlot` ADD CONSTRAINT `TimeSlot_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `RoutineVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpecialBlock` ADD CONSTRAINT `SpecialBlock_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `RoutineVersion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpecialBlockBatch` ADD CONSTRAINT `SpecialBlockBatch_specialBlockId_fkey` FOREIGN KEY (`specialBlockId`) REFERENCES `SpecialBlock`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SpecialBlockBatch` ADD CONSTRAINT `SpecialBlockBatch_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `Batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
