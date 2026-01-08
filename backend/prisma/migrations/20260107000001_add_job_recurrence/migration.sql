-- CreateTable
CREATE TABLE "job_recurrences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "serviceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "assignedTo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "frequency" TEXT NOT NULL,
    "interval" INTEGER NOT NULL,
    "count" INTEGER,
    "untilDate" TIMESTAMP(3),
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_recurrences_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "recurrenceId" TEXT;

-- CreateIndex
CREATE INDEX "job_recurrences_tenantId_idx" ON "job_recurrences"("tenantId");

-- CreateIndex
CREATE INDEX "job_recurrences_contactId_idx" ON "job_recurrences"("contactId");

-- CreateIndex
CREATE INDEX "job_recurrences_serviceId_idx" ON "job_recurrences"("serviceId");

-- CreateIndex
CREATE INDEX "job_recurrences_status_idx" ON "job_recurrences"("status");

-- CreateIndex
CREATE INDEX "jobs_recurrenceId_idx" ON "jobs"("recurrenceId");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "job_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

