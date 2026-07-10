-- AlterTable: per-tenant IANA timezone for public booking slots and email/SMS local times.
-- Null means the legacy hardcoded -8 (America/Los_Angeles) offset until the tenant sets it.
ALTER TABLE "tenant_settings" ADD COLUMN "timezone" TEXT;
