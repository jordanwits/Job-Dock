-- Google Calendar two-way sync: per-user OAuth connection + booking<->event mapping table.
-- Additive and nullable-safe. Tokens are stored encrypted (AES-256-GCM, same format as QuickBooks).

-- CreateTable
CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "googleEmail" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT,
    "calendarId" TEXT,
    "syncMode" TEXT NOT NULL DEFAULT 'all',
    "syncToken" TEXT,
    "syncInProgressAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'connected',
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "google_calendar_event_maps" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "bookingId" TEXT,
    "googleEventId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_calendar_event_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_connections_userId_key" ON "google_calendar_connections"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "google_calendar_connections_tenantId_idx" ON "google_calendar_connections"("tenantId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "google_calendar_event_maps_bookingId_idx" ON "google_calendar_event_maps"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_event_maps_connectionId_bookingId_key" ON "google_calendar_event_maps"("connectionId", "bookingId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "google_calendar_event_maps_connectionId_googleEventId_key" ON "google_calendar_event_maps"("connectionId", "googleEventId");

-- AddForeignKey
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_connections" ADD CONSTRAINT "google_calendar_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_event_maps" ADD CONSTRAINT "google_calendar_event_maps_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "google_calendar_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_calendar_event_maps" ADD CONSTRAINT "google_calendar_event_maps_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
