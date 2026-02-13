-- Add permission fields to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canCreateJobs" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canScheduleAppointments" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "canEditAllAppointments" BOOLEAN NOT NULL DEFAULT false;

-- Set defaults for existing users (backward compatible)
-- All existing users can create jobs and schedule appointments
UPDATE "users" SET "canCreateJobs" = true WHERE "canCreateJobs" IS NULL;
UPDATE "users" SET "canScheduleAppointments" = true WHERE "canScheduleAppointments" IS NULL;
-- Employees can only edit their own appointments by default
UPDATE "users" SET "canEditAllAppointments" = false WHERE "canEditAllAppointments" IS NULL;
-- Admins and owners can edit all appointments
UPDATE "users" SET "canEditAllAppointments" = true WHERE "role" IN ('admin', 'owner') AND "canEditAllAppointments" = false;
