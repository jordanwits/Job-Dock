-- CreateTable
CREATE TABLE "tenant_settings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyDisplayName" TEXT,
    "companyLegalName" TEXT,
    "companyWebsite" TEXT,
    "companySupportEmail" TEXT,
    "companyPhone" TEXT,
    "logoUrl" TEXT,
    "invoiceEmailSubject" TEXT NOT NULL DEFAULT 'Your Invoice from {{company_name}}',
    "invoiceEmailBody" TEXT NOT NULL DEFAULT 'Hi {{customer_name}},

Please find attached invoice {{invoice_number}}.

Thank you for your business!',
    "quoteEmailSubject" TEXT NOT NULL DEFAULT 'Your Quote from {{company_name}}',
    "quoteEmailBody" TEXT NOT NULL DEFAULT 'Hi {{customer_name}},

Please find attached quote {{quote_number}}.

We look forward to working with you!',
    "invoicePdfTemplateKey" TEXT,
    "quotePdfTemplateKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_settings_tenantId_idx" ON "tenant_settings"("tenantId");

-- AddForeignKey
ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

