-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "jobs_archivedAt_idx" ON "jobs"("archivedAt");
