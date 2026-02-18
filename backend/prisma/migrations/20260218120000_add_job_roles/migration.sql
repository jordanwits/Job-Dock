-- CreateTable
CREATE TABLE "job_roles" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_roles_tenantId_idx" ON "job_roles"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "job_roles_tenantId_title_key" ON "job_roles"("tenantId", "title");

-- AddForeignKey
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
