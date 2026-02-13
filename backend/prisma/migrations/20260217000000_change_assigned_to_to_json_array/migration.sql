-- Change assignedTo from TEXT to JSONB for both jobs and job_logs tables
-- This allows storing arrays of user IDs instead of a single user ID

-- Step 1: Remove foreign key constraints
ALTER TABLE "jobs" DROP CONSTRAINT IF EXISTS "jobs_assignedTo_fkey";
ALTER TABLE "job_logs" DROP CONSTRAINT IF EXISTS "job_logs_assignedTo_fkey";

-- Step 2: Remove indexes (we'll recreate them if needed, but JSONB indexing is different)
DROP INDEX IF EXISTS "jobs_assignedTo_idx";
DROP INDEX IF EXISTS "job_logs_assignedTo_idx";

-- Step 3: Migrate existing data: convert single string IDs to JSON arrays
-- For jobs table
UPDATE "jobs" 
SET "assignedTo" = jsonb_build_array("assignedTo"::text)
WHERE "assignedTo" IS NOT NULL AND "assignedTo"::text != '';

-- For job_logs table  
UPDATE "job_logs"
SET "assignedTo" = jsonb_build_array("assignedTo"::text)
WHERE "assignedTo" IS NOT NULL AND "assignedTo"::text != '';

-- Step 4: Change column types from TEXT to JSONB
ALTER TABLE "jobs" 
  ALTER COLUMN "assignedTo" TYPE jsonb USING "assignedTo"::jsonb;

ALTER TABLE "job_logs"
  ALTER COLUMN "assignedTo" TYPE jsonb USING "assignedTo"::jsonb;

-- Note: We don't recreate indexes on JSONB columns the same way.
-- If needed, we can create GIN indexes for JSONB array queries later.
