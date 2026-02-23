-- Add job-level service and price fields back to jobs.
-- Jobs are the durable record; bookings are optional appointments.

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "serviceId" TEXT;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "price" DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS "jobs_serviceId_idx" ON "jobs"("serviceId");

ALTER TABLE "jobs"
ADD CONSTRAINT "jobs_serviceId_fkey"
FOREIGN KEY ("serviceId") REFERENCES "services"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

