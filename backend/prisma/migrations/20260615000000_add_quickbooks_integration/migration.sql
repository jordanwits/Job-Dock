-- QuickBooks Online integration: per-tenant OAuth connection + webhook idempotency log,
-- plus sync-mapping columns on contacts/invoices/payments. Additive and nullable-safe.

-- CreateTable
CREATE TABLE IF NOT EXISTS "quickbooks_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "refreshTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "paymentsConnected" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "scope" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastRefreshedAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "connectedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quickbooks_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quickbooks_webhook_events" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "realmId" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quickbooks_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_connections_tenantId_key" ON "quickbooks_connections"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quickbooks_connections_realmId_idx" ON "quickbooks_connections"("realmId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quickbooks_webhook_events_eventId_key" ON "quickbooks_webhook_events"("eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quickbooks_webhook_events_realmId_idx" ON "quickbooks_webhook_events"("realmId");

-- AddColumn (contacts)
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "quickbooksCustomerId" TEXT;

-- AddColumn (invoices)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "quickbooksInvoiceId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "quickbooksSyncStatus" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "quickbooksSyncedAt" TIMESTAMP(3);
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "quickbooksInvoiceUrl" TEXT;

-- AddColumn (payments)
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "quickbooksPaymentId" TEXT;

-- AddForeignKey
ALTER TABLE "quickbooks_connections" ADD CONSTRAINT "quickbooks_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
