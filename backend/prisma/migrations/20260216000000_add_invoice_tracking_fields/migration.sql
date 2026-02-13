-- Add trackResponse and trackPayment fields to Invoice table
ALTER TABLE "invoices" ADD COLUMN "trackResponse" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "invoices" ADD COLUMN "trackPayment" BOOLEAN NOT NULL DEFAULT true;
