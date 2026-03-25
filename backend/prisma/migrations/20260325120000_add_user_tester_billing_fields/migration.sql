-- Tester approval fields (private Stripe checkout flow)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "testerApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "testerApprovedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "testerInviteSentAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "testerCheckoutUrl" TEXT;
