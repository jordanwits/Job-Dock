-- AlterTable: Add toBeScheduled support
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "toBeScheduled" BOOLEAN DEFAULT false NOT NULL;

-- AlterTable: Make startTime nullable
ALTER TABLE "jobs" ALTER COLUMN "startTime" DROP NOT NULL;

-- AlterTable: Make endTime nullable
ALTER TABLE "jobs" ALTER COLUMN "endTime" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_toBeScheduled_idx" ON "jobs"("toBeScheduled");
