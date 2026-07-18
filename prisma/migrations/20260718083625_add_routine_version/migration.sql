-- AlterTable
ALTER TABLE `Session` ADD COLUMN `versionId` INTEGER NULL;

-- CreateTable
CREATE TABLE `RoutineVersion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `isPublished` BOOLEAN NOT NULL DEFAULT false,
    `effectiveDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RoutineVersion_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `RoutineVersion`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
