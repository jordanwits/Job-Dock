-- Add discountReason to Quote table
ALTER TABLE "quotes" ADD COLUMN "discountReason" TEXT;

-- Add discountReason to Invoice table
ALTER TABLE "invoices" ADD COLUMN "discountReason" TEXT;
