/**
 * Database Migration Lambda
 *
 * This Lambda function runs database migrations using direct SQL.
 * It can be invoked manually via AWS CLI.
 */

import { Context } from 'aws-lambda'
import prisma from '../../lib/db'

interface MigrationEvent {
  action?: 'deploy' | 'status' | 'sql'
  sql?: string // Custom SQL to run (for action='sql')
}

interface MigrationResult {
  success: boolean
  action: string
  message?: string
  output?: string
  error?: string
  timestamp: string
}

// Define pending migrations here
// These should match the migration files in backend/prisma/migrations/
// Each migration contains an array of SQL statements that will be executed in order
const PENDING_MIGRATIONS = [
  {
    name: '202412030001_init',
    statements: [
      // Each statement must be separate for Prisma's $executeRawUnsafe
      `CREATE TABLE IF NOT EXISTS "tenants" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "subdomain" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "users" (
          "id" TEXT NOT NULL,
          "cognitoId" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "role" TEXT NOT NULL DEFAULT 'user',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "users_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "contacts" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "firstName" TEXT NOT NULL,
          "lastName" TEXT NOT NULL,
          "email" TEXT,
          "phone" TEXT,
          "company" TEXT,
          "jobTitle" TEXT,
          "address" TEXT,
          "city" TEXT,
          "state" TEXT,
          "zipCode" TEXT,
          "country" TEXT NOT NULL DEFAULT 'USA',
          "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
          "notes" TEXT,
          "status" TEXT NOT NULL DEFAULT 'active',
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "quotes" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "quoteNumber" TEXT NOT NULL,
          "contactId" TEXT NOT NULL,
          "subtotal" DECIMAL(10,2) NOT NULL,
          "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
          "taxAmount" DECIMAL(10,2) NOT NULL,
          "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
          "total" DECIMAL(10,2) NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'draft',
          "notes" TEXT,
          "validUntil" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "quote_line_items" (
          "id" TEXT NOT NULL,
          "quoteId" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "quantity" DECIMAL(10,2) NOT NULL,
          "unitPrice" DECIMAL(10,2) NOT NULL,
          "total" DECIMAL(10,2) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "quote_line_items_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "invoices" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "invoiceNumber" TEXT NOT NULL,
          "contactId" TEXT NOT NULL,
          "subtotal" DECIMAL(10,2) NOT NULL,
          "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
          "taxAmount" DECIMAL(10,2) NOT NULL,
          "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
          "total" DECIMAL(10,2) NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'draft',
          "paymentStatus" TEXT NOT NULL DEFAULT 'pending',
          "notes" TEXT,
          "dueDate" TIMESTAMP(3),
          "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
          "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "invoice_line_items" (
          "id" TEXT NOT NULL,
          "invoiceId" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "quantity" DECIMAL(10,2) NOT NULL,
          "unitPrice" DECIMAL(10,2) NOT NULL,
          "total" DECIMAL(10,2) NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "payments" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "invoiceId" TEXT NOT NULL,
          "amount" DECIMAL(10,2) NOT NULL,
          "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "method" TEXT NOT NULL,
          "reference" TEXT,
          "notes" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "services" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "description" TEXT,
          "duration" INTEGER NOT NULL,
          "price" DECIMAL(10,2) NOT NULL,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "availability" JSONB,
          "bookingSettings" JSONB,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "services_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "jobs" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "contactId" TEXT NOT NULL,
          "serviceId" TEXT,
          "startTime" TIMESTAMP(3) NOT NULL,
          "endTime" TIMESTAMP(3) NOT NULL,
          "status" TEXT NOT NULL DEFAULT 'scheduled',
          "location" TEXT,
          "notes" TEXT,
          "assignedTo" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "documents" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "fileName" TEXT NOT NULL,
          "fileKey" TEXT NOT NULL,
          "fileSize" INTEGER NOT NULL,
          "mimeType" TEXT NOT NULL,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT NOT NULL,
          "uploadedBy" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tenants_subdomain_key" ON "tenants"("subdomain")`,
      `CREATE INDEX IF NOT EXISTS "tenants_subdomain_idx" ON "tenants"("subdomain")`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "users_cognitoId_key" ON "users"("cognitoId")`,
      `CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "users_cognitoId_idx" ON "users"("cognitoId")`,
      `CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email")`,
      `CREATE INDEX IF NOT EXISTS "contacts_tenantId_idx" ON "contacts"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "contacts_email_idx" ON "contacts"("email")`,
      `CREATE INDEX IF NOT EXISTS "contacts_status_idx" ON "contacts"("status")`,
      `CREATE INDEX IF NOT EXISTS "quotes_tenantId_idx" ON "quotes"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "quotes_contactId_idx" ON "quotes"("contactId")`,
      `CREATE INDEX IF NOT EXISTS "quotes_status_idx" ON "quotes"("status")`,
      `CREATE INDEX IF NOT EXISTS "quotes_quoteNumber_idx" ON "quotes"("quoteNumber")`,
      `CREATE INDEX IF NOT EXISTS "quote_line_items_quoteId_idx" ON "quote_line_items"("quoteId")`,
      `CREATE INDEX IF NOT EXISTS "invoices_tenantId_idx" ON "invoices"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "invoices_contactId_idx" ON "invoices"("contactId")`,
      `CREATE INDEX IF NOT EXISTS "invoices_status_idx" ON "invoices"("status")`,
      `CREATE INDEX IF NOT EXISTS "invoices_paymentStatus_idx" ON "invoices"("paymentStatus")`,
      `CREATE INDEX IF NOT EXISTS "invoices_invoiceNumber_idx" ON "invoices"("invoiceNumber")`,
      `CREATE INDEX IF NOT EXISTS "invoice_line_items_invoiceId_idx" ON "invoice_line_items"("invoiceId")`,
      `CREATE INDEX IF NOT EXISTS "payments_tenantId_idx" ON "payments"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "payments_invoiceId_idx" ON "payments"("invoiceId")`,
      `CREATE INDEX IF NOT EXISTS "payments_paymentDate_idx" ON "payments"("paymentDate")`,
      `CREATE INDEX IF NOT EXISTS "services_tenantId_idx" ON "services"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "services_isActive_idx" ON "services"("isActive")`,
      `CREATE INDEX IF NOT EXISTS "jobs_tenantId_idx" ON "jobs"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "jobs_contactId_idx" ON "jobs"("contactId")`,
      `CREATE INDEX IF NOT EXISTS "jobs_serviceId_idx" ON "jobs"("serviceId")`,
      `CREATE INDEX IF NOT EXISTS "jobs_startTime_idx" ON "jobs"("startTime")`,
      `CREATE INDEX IF NOT EXISTS "jobs_status_idx" ON "jobs"("status")`,
      `CREATE INDEX IF NOT EXISTS "documents_tenantId_idx" ON "documents"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "documents_entityType_entityId_idx" ON "documents"("entityType", "entityId")`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_tenantId_fkey') THEN
          ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_tenantId_fkey') THEN
          ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_tenantId_fkey') THEN
          ALTER TABLE "quotes" ADD CONSTRAINT "quotes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotes_contactId_fkey') THEN
          ALTER TABLE "quotes" ADD CONSTRAINT "quotes_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quote_line_items_quoteId_fkey') THEN
          ALTER TABLE "quote_line_items" ADD CONSTRAINT "quote_line_items_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_tenantId_fkey') THEN
          ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoices_contactId_fkey') THEN
          ALTER TABLE "invoices" ADD CONSTRAINT "invoices_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_line_items_invoiceId_fkey') THEN
          ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_invoiceId_fkey') THEN
          ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_tenantId_fkey') THEN
          ALTER TABLE "services" ADD CONSTRAINT "services_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_tenantId_fkey') THEN
          ALTER TABLE "jobs" ADD CONSTRAINT "jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_contactId_fkey') THEN
          ALTER TABLE "jobs" ADD CONSTRAINT "jobs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_serviceId_fkey') THEN
          ALTER TABLE "jobs" ADD CONSTRAINT "jobs_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
      END $$`,
    ],
    description: 'Initial schema - creates all base tables, indexes, and constraints',
  },
  {
    name: '20250107000000_add_tenant_settings',
    statements: [
      `CREATE TABLE IF NOT EXISTS "tenant_settings" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "companyDisplayName" TEXT,
          "companyLegalName" TEXT,
          "companyWebsite" TEXT,
          "companySupportEmail" TEXT,
          "companyPhone" TEXT,
          "logoUrl" TEXT,
          "invoiceEmailSubject" TEXT NOT NULL DEFAULT 'Your Invoice from {{company_name}}',
          "invoiceEmailBody" TEXT NOT NULL DEFAULT 'Hi {{customer_name}}, Please find attached invoice {{invoice_number}}. Thank you for your business!',
          "quoteEmailSubject" TEXT NOT NULL DEFAULT 'Your Quote from {{company_name}}',
          "quoteEmailBody" TEXT NOT NULL DEFAULT 'Hi {{customer_name}}, Please find attached quote {{quote_number}}. We look forward to working with you!',
          "invoicePdfTemplateKey" TEXT,
          "quotePdfTemplateKey" TEXT,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          "updatedByUserId" TEXT,
          CONSTRAINT "tenant_settings_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "tenant_settings_tenantId_idx" ON "tenant_settings"("tenantId")`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_tenantId_fkey') THEN
          ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,
    ],
    description: 'Add tenant settings table for company branding and email templates',
  },
  {
    name: '20260107000001_add_job_recurrence',
    statements: [
      `CREATE TABLE IF NOT EXISTS "job_recurrences" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "contactId" TEXT NOT NULL,
          "serviceId" TEXT,
          "title" TEXT NOT NULL,
          "description" TEXT,
          "location" TEXT,
          "notes" TEXT,
          "assignedTo" TEXT,
          "status" TEXT NOT NULL DEFAULT 'active',
          "frequency" TEXT NOT NULL,
          "interval" INTEGER NOT NULL,
          "count" INTEGER,
          "untilDate" TIMESTAMP(3),
          "startTime" TIMESTAMP(3) NOT NULL,
          "endTime" TIMESTAMP(3) NOT NULL,
          "timezone" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL,
          CONSTRAINT "job_recurrences_pkey" PRIMARY KEY ("id")
      )`,
      `ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "recurrenceId" TEXT`,
      `CREATE INDEX IF NOT EXISTS "job_recurrences_tenantId_idx" ON "job_recurrences"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "job_recurrences_contactId_idx" ON "job_recurrences"("contactId")`,
      `CREATE INDEX IF NOT EXISTS "job_recurrences_serviceId_idx" ON "job_recurrences"("serviceId")`,
      `CREATE INDEX IF NOT EXISTS "job_recurrences_status_idx" ON "job_recurrences"("status")`,
      `CREATE INDEX IF NOT EXISTS "jobs_recurrenceId_idx" ON "jobs"("recurrenceId")`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_recurrenceId_fkey') THEN
          ALTER TABLE "jobs" ADD CONSTRAINT "jobs_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "job_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_recurrences_contactId_fkey') THEN
          ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_recurrences_serviceId_fkey') THEN
          ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_recurrences_tenantId_fkey') THEN
          ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,
    ],
    description: 'Add job recurrence support for repeating scheduled jobs',
  },
  {
    name: '20260108000000_add_invoice_approval_status',
    statements: [
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'none'`,
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "approvalAt" TIMESTAMP(3)`,
      `CREATE INDEX IF NOT EXISTS "invoices_approvalStatus_idx" ON "invoices"("approvalStatus")`,
    ],
    description: 'Add approval status and timestamp to invoices for customer approval workflow',
  },
  {
    name: '20260108000001_add_job_quote_invoice_linking',
    statements: [
      `ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "quoteId" TEXT`,
      `ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT`,
      `CREATE INDEX IF NOT EXISTS "jobs_quoteId_idx" ON "jobs"("quoteId")`,
      `CREATE INDEX IF NOT EXISTS "jobs_invoiceId_idx" ON "jobs"("invoiceId")`,
      `DO $$ 
       BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'jobs_quoteId_fkey'
         ) THEN
           ALTER TABLE "jobs" ADD CONSTRAINT "jobs_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
         END IF;
         IF NOT EXISTS (
           SELECT 1 FROM pg_constraint WHERE conname = 'jobs_invoiceId_fkey'
         ) THEN
           ALTER TABLE "jobs" ADD CONSTRAINT "jobs_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
         END IF;
       END $$`,
    ],
    description: 'Link jobs to quotes and invoices for integrated workflow',
  },
  {
    name: '20260108000002_add_quote_title',
    statements: [`ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "title" TEXT`],
    description: 'Add optional title field to quotes',
  },
  {
    name: '20260108000003_add_job_breaks',
    statements: [`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "breaks" JSONB`],
    description: 'Add breaks column to jobs table for job timeline pauses',
  },
  {
    name: '20260108000004_add_invoice_title',
    statements: [`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "title" TEXT`],
    description: 'Add optional title field to invoices',
  },
  {
    name: '20260112000000_add_job_price',
    statements: [`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "price" DECIMAL(10,2)`],
    description: 'Add optional price field to jobs',
  },
  {
    name: '20260112000001_add_custom_recurrence_days',
    statements: [
      `ALTER TABLE "job_recurrences" ADD COLUMN IF NOT EXISTS "daysOfWeek" INTEGER[] DEFAULT ARRAY[]::INTEGER[]`,
    ],
    description:
      'Add custom days of week selection for job recurrence (for patterns like every Tue and Thu)',
  },
  {
    name: '20260112000002_provision_dave_witbeck',
    statements: [
      `INSERT INTO "tenants" (id, name, subdomain, "createdAt", "updatedAt")
       VALUES ('91aa5603-ed59-42fe-9b32-6d13a5ccf4e4', 'Witbeck Ventures', 'witbeck-ventures', NOW(), NOW())
       ON CONFLICT (subdomain) DO NOTHING`,
      `INSERT INTO "users" (id, "cognitoId", email, name, "tenantId", role, "createdAt", "updatedAt")
       VALUES ('3deb2df8-aa9f-4a68-add2-05b13a8e2d7c', '2478a438-4021-7015-fed6-c19cc19201f7', 'davewitbeck@gmail.com', 'Dave Witbeck', '91aa5603-ed59-42fe-9b32-6d13a5ccf4e4', 'owner', NOW(), NOW())
       ON CONFLICT ("cognitoId") DO NOTHING`,
    ],
    description: 'Provision database records for Dave Witbeck (manually created Cognito user)',
  },
  {
    name: '20260113000000_add_job_archival',
    statements: [
      `ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`,
      `ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3)`,
      `CREATE INDEX IF NOT EXISTS "jobs_deletedAt_idx" ON "jobs"("deletedAt")`,
      `CREATE INDEX IF NOT EXISTS "jobs_archivedAt_idx" ON "jobs"("archivedAt")`,
      `CREATE INDEX IF NOT EXISTS "jobs_endTime_idx" ON "jobs"("endTime")`,
    ],
    description: 'Add deletedAt and archivedAt fields to jobs for data retention management',
  },
  {
    name: '20260114000000_add_to_be_scheduled',
    statements: [
      `ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "toBeScheduled" BOOLEAN DEFAULT false NOT NULL`,
      `ALTER TABLE "jobs" ALTER COLUMN "startTime" DROP NOT NULL`,
      `ALTER TABLE "jobs" ALTER COLUMN "endTime" DROP NOT NULL`,
      `CREATE INDEX IF NOT EXISTS "jobs_toBeScheduled_idx" ON "jobs"("toBeScheduled")`,
    ],
    description: 'Add toBeScheduled field to jobs and make startTime/endTime nullable for unscheduled jobs',
  },
  {
    name: '20260116000000_add_stripe_billing',
    statements: [
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeSubscriptionStatus" TEXT`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3)`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "currentPeriodEndsAt" TIMESTAMP(3)`,
      `ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN DEFAULT false`,
      `CREATE INDEX IF NOT EXISTS "tenants_stripeCustomerId_idx" ON "tenants"("stripeCustomerId")`,
      `CREATE INDEX IF NOT EXISTS "tenants_stripeSubscriptionId_idx" ON "tenants"("stripeSubscriptionId")`,
      `CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
        "id" TEXT NOT NULL,
        "stripeEventId" TEXT NOT NULL,
        "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "stripe_webhook_events_stripeEventId_key" ON "stripe_webhook_events"("stripeEventId")`,
      `CREATE INDEX IF NOT EXISTS "stripe_webhook_events_stripeEventId_idx" ON "stripe_webhook_events"("stripeEventId")`,
    ],
    description: 'Add Stripe billing fields to tenants and create webhook idempotency table',
  },
  {
    name: '20260126000000_add_discount_reason',
    statements: [
      `ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "discountReason" TEXT`,
      `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "discountReason" TEXT`,
    ],
    description:
      'Add discountReason field to quotes and invoices for tracking discount justification',
  },
  {
    name: '20260129000000_add_user_onboarding',
    statements: [
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3)`,
    ],
    description:
      'Add onboardingCompletedAt field to users for tracking first-run onboarding completion',
  },
  {
    name: '20260129000001_reset_all_user_onboarding',
    statements: [
      `UPDATE "users" SET "onboardingCompletedAt" = NULL WHERE "onboardingCompletedAt" IS NOT NULL`,
    ],
    description:
      'Reset all users onboarding status so everyone sees the onboarding flow at least once',
  },
  {
    name: '20260209000000_add_job_logs_and_time_entries',
    statements: [
      `CREATE TABLE IF NOT EXISTS "job_logs" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT,
        "location" TEXT,
        "notes" TEXT,
        "jobId" TEXT,
        "contactId" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE TABLE IF NOT EXISTS "time_entries" (
        "id" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "jobLogId" TEXT NOT NULL,
        "startTime" TIMESTAMP(3) NOT NULL,
        "endTime" TIMESTAMP(3) NOT NULL,
        "breakMinutes" INTEGER NOT NULL DEFAULT 0,
        "notes" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "time_entries_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE INDEX IF NOT EXISTS "job_logs_tenantId_idx" ON "job_logs"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "job_logs_jobId_idx" ON "job_logs"("jobId")`,
      `CREATE INDEX IF NOT EXISTS "job_logs_contactId_idx" ON "job_logs"("contactId")`,
      `CREATE INDEX IF NOT EXISTS "job_logs_status_idx" ON "job_logs"("status")`,
      `CREATE INDEX IF NOT EXISTS "job_logs_createdAt_idx" ON "job_logs"("createdAt")`,
      `CREATE INDEX IF NOT EXISTS "time_entries_tenantId_idx" ON "time_entries"("tenantId")`,
      `CREATE INDEX IF NOT EXISTS "time_entries_jobLogId_idx" ON "time_entries"("jobLogId")`,
      `CREATE INDEX IF NOT EXISTS "time_entries_startTime_idx" ON "time_entries"("startTime")`,
      `DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_logs_tenantId_fkey') THEN
          ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_logs_jobId_fkey') THEN
          ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_logs_contactId_fkey') THEN
          ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_tenantId_fkey') THEN
          ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'time_entries_jobLogId_fkey') THEN
          ALTER TABLE "time_entries" ADD CONSTRAINT "time_entries_jobLogId_fkey" FOREIGN KEY ("jobLogId") REFERENCES "job_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
        END IF;
      END $$`,
    ],
    description: 'Add job logs and time entries for job logging manager',
  },
  {
    name: '20260210000000_add_document_notes_markup',
    statements: [
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "notes" TEXT`,
      `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "markup" JSONB`,
    ],
    description: 'Add notes and markup columns to documents for photo annotations',
  },
  {
    name: '20260129000002_add_early_access_tables',
    statements: [
      `CREATE TABLE IF NOT EXISTS "early_access_requests" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "approvedAt" TIMESTAMP(3),
        "approvedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "early_access_requests_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "early_access_requests_email_key" ON "early_access_requests"("email")`,
      `CREATE INDEX IF NOT EXISTS "early_access_requests_email_idx" ON "early_access_requests"("email")`,
      `CREATE INDEX IF NOT EXISTS "early_access_requests_approvedAt_idx" ON "early_access_requests"("approvedAt")`,
      `CREATE TABLE IF NOT EXISTS "early_access_allowlist" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "approvedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "early_access_allowlist_pkey" PRIMARY KEY ("id")
      )`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "early_access_allowlist_email_key" ON "early_access_allowlist"("email")`,
      `CREATE INDEX IF NOT EXISTS "early_access_allowlist_email_idx" ON "early_access_allowlist"("email")`,
    ],
    description: 'Add early access request and allowlist tables for gated signup',
  },
]

export const handler = async (
  event: MigrationEvent,
  context: Context
): Promise<MigrationResult> => {
  console.log('Migration Lambda invoked', { event, requestId: context.awsRequestId })

  const action = event.action || 'deploy'
  const timestamp = new Date().toISOString()

  try {
    switch (action) {
      case 'deploy': {
        console.log('Running pending migrations...')
        const results: string[] = []

        // First, ensure _prisma_migrations table exists
        console.log('Ensuring _prisma_migrations table exists...')
        await prisma.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
            "id" VARCHAR(36) PRIMARY KEY,
            "checksum" VARCHAR(64) NOT NULL,
            "finished_at" TIMESTAMPTZ,
            "migration_name" VARCHAR(255) NOT NULL,
            "logs" TEXT,
            "rolled_back_at" TIMESTAMPTZ,
            "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "applied_steps_count" INTEGER NOT NULL DEFAULT 0
          )
        `)

        for (const migration of PENDING_MIGRATIONS) {
          console.log(`Checking migration: ${migration.name}`)

          // Check if migration was already applied
          const existingMigration = await prisma
            .$queryRawUnsafe<any[]>(
              `
            SELECT migration_name FROM _prisma_migrations 
            WHERE migration_name = '${migration.name}'
          `
            )
            .catch(() => [])

          if (existingMigration.length > 0) {
            console.log(`Migration ${migration.name} already applied, skipping`)
            results.push(`✓ ${migration.name} (already applied)`)
            continue
          }

          console.log(`Running migration: ${migration.name}`)

          // Run each SQL statement separately
          for (const statement of migration.statements) {
            console.log(`  Executing: ${statement.substring(0, 80)}...`)
            await prisma.$executeRawUnsafe(statement)
          }

          // Record the migration in _prisma_migrations table
          await prisma.$executeRawUnsafe(`
            INSERT INTO _prisma_migrations (id, checksum, migration_name, logs, rolled_back_at, started_at, applied_steps_count, finished_at)
            VALUES (
              '${crypto.randomUUID()}',
              'manual-migration',
              '${migration.name}',
              NULL,
              NULL,
              NOW(),
              1,
              NOW()
            )
          `)

          results.push(`✓ ${migration.name} (applied)`)
          console.log(`Migration ${migration.name} completed`)
        }

        return {
          success: true,
          action,
          message: 'Migrations completed',
          output: results.join('\n'),
          timestamp,
        }
      }

      case 'status': {
        console.log('Checking migration status...')

        // Get applied migrations
        const appliedMigrations = await prisma
          .$queryRawUnsafe<any[]>(
            `
          SELECT migration_name, finished_at 
          FROM _prisma_migrations 
          ORDER BY finished_at DESC
        `
          )
          .catch(() => [])

        const appliedNames = new Set(appliedMigrations.map(m => m.migration_name))

        const statusLines: string[] = [
          'Applied migrations:',
          ...appliedMigrations.map(m => `  ✓ ${m.migration_name}`),
          '',
          'Pending migrations:',
          ...PENDING_MIGRATIONS.filter(m => !appliedNames.has(m.name)).map(
            m => `  ○ ${m.name} - ${m.description}`
          ),
        ]

        if (PENDING_MIGRATIONS.every(m => appliedNames.has(m.name))) {
          statusLines.push('  (none - all migrations applied)')
        }

        return {
          success: true,
          action,
          message: 'Status check complete',
          output: statusLines.join('\n'),
          timestamp,
        }
      }

      case 'sql': {
        if (!event.sql) {
          throw new Error('sql parameter is required for action=sql')
        }

        console.log('Running custom SQL:', event.sql)

        // Run the custom SQL
        const result = await prisma.$executeRawUnsafe(event.sql)

        return {
          success: true,
          action,
          message: 'SQL executed successfully',
          output: `Affected rows: ${result}`,
          timestamp,
        }
      }

      default:
        throw new Error(`Unknown action: ${action}. Valid actions: deploy, status, sql`)
    }
  } catch (error: any) {
    console.error('Migration failed:', error)

    return {
      success: false,
      action,
      error: error.message,
      timestamp,
    }
  } finally {
    await prisma.$disconnect()
  }
}
