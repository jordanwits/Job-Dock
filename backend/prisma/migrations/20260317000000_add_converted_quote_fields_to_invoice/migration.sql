-- Add converted quote snapshot fields to invoices (for reports when quotes are deleted on convert)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "convertedFromQuoteNumber" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "convertedFromQuoteTotal" DECIMAL(10,2);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "convertedFromQuoteCreatedAt" TIMESTAMP(3);
