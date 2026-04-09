-- CreateTable
CREATE TABLE "saved_line_items" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "defaultQuantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "saved_line_items_tenantId_normalizedName_key" ON "saved_line_items"("tenantId", "normalizedName");

-- CreateIndex
CREATE INDEX "saved_line_items_tenantId_idx" ON "saved_line_items"("tenantId");

-- CreateIndex
CREATE INDEX "saved_line_items_tenantId_isActive_idx" ON "saved_line_items"("tenantId", "isActive");

-- AddForeignKey
ALTER TABLE "saved_line_items" ADD CONSTRAINT "saved_line_items_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
