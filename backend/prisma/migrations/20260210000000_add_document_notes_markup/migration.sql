-- AlterTable
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "markup" JSONB;
