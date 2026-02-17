-- Add canSeeJobPrices field to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canSeeJobPrices" BOOLEAN NOT NULL DEFAULT true;

-- Set defaults for existing users (backward compatible)
-- All existing users can see job prices by default
UPDATE "users" SET "canSeeJobPrices" = true WHERE "canSeeJobPrices" IS NULL;
