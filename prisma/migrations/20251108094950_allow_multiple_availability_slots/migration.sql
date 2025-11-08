/*
  Warnings:

  - You are about to drop the column `isAvailable` on the `availability` table. All the data in the column will be lost.
  - Made the column `startTime` on table `availability` required. This step will fail if there are existing NULL values in that column.
  - Made the column `endTime` on table `availability` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "availability_userId_dayOfWeek_key";

-- AlterTable
ALTER TABLE "availability" DROP COLUMN "isAvailable",
ALTER COLUMN "startTime" SET NOT NULL,
ALTER COLUMN "endTime" SET NOT NULL;

-- CreateIndex
CREATE INDEX "availability_userId_dayOfWeek_idx" ON "availability"("userId", "dayOfWeek");
