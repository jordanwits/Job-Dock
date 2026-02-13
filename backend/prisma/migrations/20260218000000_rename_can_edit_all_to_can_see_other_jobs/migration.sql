-- Rename canEditAllAppointments to canSeeOtherJobs
ALTER TABLE "users" RENAME COLUMN "canEditAllAppointments" TO "canSeeOtherJobs";

-- Update defaults: admins and owners can see other jobs by default
UPDATE "users" SET "canSeeOtherJobs" = true WHERE "role" IN ('admin', 'owner') AND "canSeeOtherJobs" = false;
