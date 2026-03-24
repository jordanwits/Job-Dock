-- Optional reason when client declines quote/invoice via public link
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "clientDeclineReason" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "clientDeclineReason" TEXT;
