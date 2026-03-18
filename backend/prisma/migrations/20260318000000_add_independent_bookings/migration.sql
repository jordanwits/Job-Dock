-- Add support for independent appointments (bookings without a parent job)
-- Used for consults and similar calendar events that don't create a job

-- Add new columns for standalone booking shape
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "contactId" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "isIndependent" BOOLEAN NOT NULL DEFAULT false;

-- Make jobId nullable so bookings can exist without a job
ALTER TABLE "bookings" ALTER COLUMN "jobId" DROP NOT NULL;

-- Add foreign key for optional contact on independent bookings (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_contactId_fkey') THEN
    ALTER TABLE "bookings" ADD CONSTRAINT "bookings_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS "bookings_contactId_idx" ON "bookings"("contactId");
CREATE INDEX IF NOT EXISTS "bookings_isIndependent_idx" ON "bookings"("isIndependent");
