-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "quoteId" TEXT,
ADD COLUMN "invoiceId" TEXT;

-- CreateIndex
CREATE INDEX "jobs_quoteId_idx" ON "jobs"("quoteId");

-- CreateIndex
CREATE INDEX "jobs_invoiceId_idx" ON "jobs"("invoiceId");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
