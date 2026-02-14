-- AlterTable
ALTER TABLE "time_entries" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "time_entries_userId_idx" ON "time_entries"("userId");

-- AddForeignKey
ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Set userId for existing entries based on job log's assignedTo
-- For entries where job log has assignedTo, use the first assigned user
UPDATE "time_entries" te
SET "userId" = (
  SELECT 
    CASE 
      WHEN jsonb_typeof(jl."assignedTo"::jsonb) = 'array' AND jsonb_array_length(jl."assignedTo"::jsonb) > 0 THEN
        CASE 
          WHEN jsonb_typeof(jl."assignedTo"::jsonb->0) = 'object' THEN
            (jl."assignedTo"::jsonb->0->>'userId')
          WHEN jsonb_typeof(jl."assignedTo"::jsonb->0) = 'string' THEN
            jl."assignedTo"::jsonb->0::text
          ELSE NULL
        END
      ELSE NULL
    END
  FROM "job_logs" jl
  WHERE jl."id" = te."jobLogId"
)
WHERE te."userId" IS NULL;
