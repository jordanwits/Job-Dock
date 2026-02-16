-- CreateTable: bookings
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "serviceId" TEXT,
    "quoteId" TEXT,
    "invoiceId" TEXT,
    "recurrenceId" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "toBeScheduled" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "location" TEXT,
    "price" DECIMAL(10,2),
    "notes" TEXT,
    "assignedTo" JSONB,
    "breaks" JSONB,
    "deletedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bookings_tenantId_idx" ON "bookings"("tenantId");
CREATE INDEX "bookings_jobId_idx" ON "bookings"("jobId");
CREATE INDEX "bookings_serviceId_idx" ON "bookings"("serviceId");
CREATE INDEX "bookings_quoteId_idx" ON "bookings"("quoteId");
CREATE INDEX "bookings_invoiceId_idx" ON "bookings"("invoiceId");
CREATE INDEX "bookings_recurrenceId_idx" ON "bookings"("recurrenceId");
CREATE INDEX "bookings_startTime_idx" ON "bookings"("startTime");
CREATE INDEX "bookings_endTime_idx" ON "bookings"("endTime");
CREATE INDEX "bookings_status_idx" ON "bookings"("status");
CREATE INDEX "bookings_deletedAt_idx" ON "bookings"("deletedAt");
CREATE INDEX "bookings_archivedAt_idx" ON "bookings"("archivedAt");
CREATE INDEX "bookings_toBeScheduled_idx" ON "bookings"("toBeScheduled");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "job_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Migrate data: Create one Booking per existing Job
INSERT INTO "bookings" (
    "id", "tenantId", "jobId", "serviceId", "quoteId", "invoiceId", "recurrenceId",
    "startTime", "endTime", "toBeScheduled", "status", "location", "price", "notes",
    "assignedTo", "breaks", "deletedAt", "archivedAt", "createdById", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text,
    "tenantId", "id" as "jobId", "serviceId", "quoteId", "invoiceId", "recurrenceId",
    "startTime", "endTime", "toBeScheduled", "status", "location", "price", "notes",
    "assignedTo", "breaks", "deletedAt", "archivedAt", "createdById", "createdAt", "updatedAt"
FROM "jobs";

-- Migrate orphan JobLogs: Create Job from each JobLog that has no jobId
-- Create a temp table to map old job_log id to new job id for orphans (only those we can migrate)
CREATE TEMP TABLE job_log_to_job_mapping AS
SELECT jl.id as job_log_id, gen_random_uuid()::text as new_job_id
FROM job_logs jl
WHERE jl."jobId" IS NULL
  AND (jl."contactId" IS NOT NULL OR EXISTS (SELECT 1 FROM "contacts" c WHERE c."tenantId" = jl."tenantId"));

-- Insert Jobs from orphan JobLogs with new ids (only when we have a valid contactId)
INSERT INTO "jobs" (
    "id", "tenantId", "title", "description", "contactId", "quoteId", "invoiceId",
    "status", "location", "notes", "assignedTo", "createdById", "createdAt", "updatedAt"
)
SELECT
    m.new_job_id,
    jl."tenantId", jl."title", jl."description",
    COALESCE(jl."contactId", (SELECT c."id" FROM "contacts" c WHERE c."tenantId" = jl."tenantId" ORDER BY c."createdAt" LIMIT 1)),
    NULL, NULL, COALESCE(jl."status", 'active'), jl."location", jl."notes", jl."assignedTo",
    NULL, jl."createdAt", jl."updatedAt"
FROM "job_logs" jl
JOIN job_log_to_job_mapping m ON m.job_log_id = jl.id
WHERE jl."jobId" IS NULL
  AND (jl."contactId" IS NOT NULL OR EXISTS (SELECT 1 FROM "contacts" c WHERE c."tenantId" = jl."tenantId"));

-- Update job_logs to set jobId for orphans (so we can migrate time_entries)
UPDATE job_logs jl
SET "jobId" = m.new_job_id
FROM job_log_to_job_mapping m
WHERE jl.id = m.job_log_id AND jl."jobId" IS NULL;

-- Delete time_entries for orphan JobLogs we could not migrate (no contact)
DELETE FROM "time_entries"
WHERE "jobLogId" IN (
  SELECT jl.id FROM "job_logs" jl
  WHERE jl."jobId" IS NULL
    AND jl."contactId" IS NULL
    AND NOT EXISTS (SELECT 1 FROM "contacts" c WHERE c."tenantId" = jl."tenantId")
);

-- Delete orphan JobLogs we could not migrate
DELETE FROM "job_logs"
WHERE "jobId" IS NULL
  AND "contactId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "contacts" c WHERE c."tenantId" = "job_logs"."tenantId");

-- Add jobId to time_entries
ALTER TABLE "time_entries" ADD COLUMN "jobId" TEXT;

-- Migrate time_entries: set jobId from job_logs
UPDATE "time_entries" te
SET "jobId" = jl."jobId"
FROM "job_logs" jl
WHERE te."jobLogId" = jl.id AND jl."jobId" IS NOT NULL;

-- Delete any orphan time_entries that could not be migrated
DELETE FROM "time_entries" WHERE "jobId" IS NULL;

-- Make jobId required
ALTER TABLE "time_entries" ALTER COLUMN "jobId" SET NOT NULL;

-- Migrate documents (photos) from job_log to job
UPDATE "documents"
SET "entityType" = 'job', "entityId" = jl."jobId"
FROM "job_logs" jl
WHERE "documents"."entityType" = 'job_log' AND "documents"."entityId" = jl.id AND jl."jobId" IS NOT NULL;

-- For orphan job_logs we created new jobs - the mapping is in job_log_to_job_mapping
-- Documents with entityId = job_log_id need to become entityId = new_job_id
UPDATE "documents" d
SET "entityType" = 'job', "entityId" = m.new_job_id
FROM job_log_to_job_mapping m
WHERE d."entityType" = 'job_log' AND d."entityId" = m.job_log_id;

-- Drop job_logs and time_entries jobLogId
ALTER TABLE "time_entries" DROP CONSTRAINT "time_entries_jobLogId_fkey";
ALTER TABLE "time_entries" DROP COLUMN "jobLogId";
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "time_entries_jobId_idx" ON "time_entries"("jobId");
DROP INDEX IF EXISTS "time_entries_jobLogId_idx";

DROP TABLE "job_logs";

-- Remove columns from jobs
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_serviceId_fkey";
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_recurrenceId_fkey";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "serviceId";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "recurrenceId";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "startTime";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "endTime";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "toBeScheduled";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "price";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "breaks";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "jobs" DROP COLUMN IF EXISTS "archivedAt";

-- Update jobs status default
ALTER TABLE "jobs" ALTER COLUMN "status" SET DEFAULT 'active';

-- Drop old indexes from jobs
DROP INDEX IF EXISTS "jobs_serviceId_idx";
DROP INDEX IF EXISTS "jobs_recurrenceId_idx";
DROP INDEX IF EXISTS "jobs_startTime_idx";
DROP INDEX IF EXISTS "jobs_endTime_idx";
DROP INDEX IF EXISTS "jobs_toBeScheduled_idx";
DROP INDEX IF EXISTS "jobs_deletedAt_idx";
DROP INDEX IF EXISTS "jobs_archivedAt_idx";
