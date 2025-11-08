-- AlterTable
ALTER TABLE "availability"
ADD COLUMN IF NOT EXISTS "isAllDay" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "isAvailable" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "startTime" DROP NOT NULL,
ALTER COLUMN "endTime" DROP NOT NULL;

-- CreateIndex (if not exists)
CREATE UNIQUE INDEX IF NOT EXISTS "availability_userId_dayOfWeek_key" ON "availability"("userId", "dayOfWeek");
