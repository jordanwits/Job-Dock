-- Add hourlyRate to time_entries for effective-date pay changes
-- When set, use this rate for pay calculation; when null, use job assignment rate
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "hourlyRate" DECIMAL(10,2);
