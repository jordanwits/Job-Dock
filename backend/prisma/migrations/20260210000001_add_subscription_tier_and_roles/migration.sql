-- Add subscriptionTier to tenants
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscriptionTier" TEXT;

-- Set subscriptionTier from stripePriceId for existing tenants
-- Single plan = STRIPE_PRICE_ID, Team plan = STRIPE_TEAM_PRICE_ID
-- Default to "single" for tenants without subscription or with single price
UPDATE "tenants" SET "subscriptionTier" = 'single' WHERE "subscriptionTier" IS NULL;

-- Normalize user roles: "user" -> "admin"
UPDATE "users" SET "role" = 'admin' WHERE "role" = 'user';
