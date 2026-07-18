-- AlterTable
ALTER TABLE `Teacher` ADD COLUMN `userId` INTEGER NULL;

-- CreateTable
CREATE TABLE `Reschedule` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `sessionId` INTEGER NOT NULL,
    `changedById` INTEGER NULL,
    `oldDay` VARCHAR(191) NOT NULL,
    `oldTimeSlotId` INTEGER NOT NULL,
    `oldRoomId` INTEGER NOT NULL,
    `newDay` VARCHAR(191) NOT NULL,
    `newTimeSlotId` INTEGER NOT NULL,
    `newRoomId` INTEGER NOT NULL,
    `reason` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Teacher_userId_key` ON `Teacher`(`userId`);
