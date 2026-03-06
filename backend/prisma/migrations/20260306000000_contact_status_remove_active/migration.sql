-- Remove 'active' as a contact status: use 'customer' for booking-created contacts, 'lead' as default
-- 1. Migrate existing contacts with status 'active' to 'customer' (they booked, so they're customers)
UPDATE "contacts" SET "status" = 'customer' WHERE "status" = 'active';

-- 2. Change default for new contacts from 'active' to 'lead'
ALTER TABLE "contacts" ALTER COLUMN "status" SET DEFAULT 'lead';
