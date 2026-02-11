-- CreateIndex
CREATE INDEX IF NOT EXISTS "jobs_assignedTo_idx" ON "jobs"("assignedTo");

-- Clear orphaned assignedTo values (references to non-existent users) before adding FK
UPDATE "jobs" SET "assignedTo" = NULL 
WHERE "assignedTo" IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM "users" WHERE "users"."id" = "jobs"."assignedTo");

-- AddForeignKey (only if constraint doesn't exist - safe for re-runs)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_assignedTo_fkey') THEN
    ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assignedTo_fkey" 
      FOREIGN KEY ("assignedTo") REFERENCES "users"("id") 
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
