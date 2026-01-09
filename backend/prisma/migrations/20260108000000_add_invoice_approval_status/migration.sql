-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "approvalStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "invoices" ADD COLUMN "approvalAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "invoices_approvalStatus_idx" ON "invoices"("approvalStatus");
