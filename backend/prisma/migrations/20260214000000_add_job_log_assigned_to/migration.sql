-- AlterTable
ALTER TABLE "job_logs" ADD COLUMN "assignedTo" TEXT;

-- CreateIndex
CREATE INDEX "job_logs_assignedTo_idx" ON "job_logs"("assignedTo");

-- AddForeignKey
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
