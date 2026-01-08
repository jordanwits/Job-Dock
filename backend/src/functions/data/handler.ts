import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { successResponse, errorResponse, corsResponse, extractContext } from '../../lib/middleware'
import { dataServices } from '../../lib/dataService'
import { extractTenantId } from '../../lib/middleware'
import { ensureTenantExists, getDefaultTenantId } from '../../lib/tenant'
import { ApiError } from '../../lib/errors'

type ResourceKey = keyof typeof dataServices

interface ParsedPath {
  resource?: ResourceKey
  id?: string
  action?: string
}

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  if (event.httpMethod === 'OPTIONS') {
    return corsResponse()
  }

  // Special migration endpoint
  if (event.path?.includes('/__migrate') && event.httpMethod === 'POST') {
    try {
      console.log('Running database migration...')
      const { default: prisma } = await import('../../lib/db')
      
      // Run raw SQL migration
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "recurrenceId" TEXT;
      `)
      
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "job_recurrences" (
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
        );
      `)
      
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "job_recurrences_tenantId_idx" ON "job_recurrences"("tenantId");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "job_recurrences_contactId_idx" ON "job_recurrences"("contactId");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "job_recurrences_serviceId_idx" ON "job_recurrences"("serviceId");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "job_recurrences_status_idx" ON "job_recurrences"("status");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "jobs_recurrenceId_idx" ON "jobs"("recurrenceId");`)
      
      // Add foreign keys with existence checks
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'jobs_recurrenceId_fkey') THEN
            ALTER TABLE "jobs" ADD CONSTRAINT "jobs_recurrenceId_fkey" 
              FOREIGN KEY ("recurrenceId") REFERENCES "job_recurrences"("id") 
              ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$;
      `)
      
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_recurrences_contactId_fkey') THEN
            ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_contactId_fkey" 
              FOREIGN KEY ("contactId") REFERENCES "contacts"("id") 
              ON DELETE RESTRICT ON UPDATE CASCADE;
          END IF;
        END $$;
      `)
      
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_recurrences_serviceId_fkey') THEN
            ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_serviceId_fkey" 
              FOREIGN KEY ("serviceId") REFERENCES "services"("id") 
              ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$;
      `)
      
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'job_recurrences_tenantId_fkey') THEN
            ALTER TABLE "job_recurrences" ADD CONSTRAINT "job_recurrences_tenantId_fkey" 
              FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") 
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `)
      
      // Create tenant_settings table
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "tenant_settings" (
          "id" TEXT NOT NULL,
          "tenantId" TEXT NOT NULL,
          "companyDisplayName" TEXT,
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
      `)
      
      await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId");`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "tenant_settings_tenantId_idx" ON "tenant_settings"("tenantId");`)
      
      await prisma.$executeRawUnsafe(`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_settings_tenantId_fkey') THEN
            ALTER TABLE "tenant_settings" ADD CONSTRAINT "tenant_settings_tenantId_fkey" 
              FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") 
              ON DELETE CASCADE ON UPDATE CASCADE;
          END IF;
        END $$;
      `)
      
      console.log('✅ Migration completed successfully')
      return successResponse({ message: 'Migration completed successfully' })
    } catch (error: any) {
      console.error('Migration error:', error)
      return errorResponse(error.message || 'Migration failed', 500)
    }
  }

  try {
    const { resource, id, action } = parsePath(event)
    const tenantId = await resolveTenantId(event)
    await ensureTenantExists(tenantId)

    if (!resource) {
      return successResponse({ status: 'ok' })
    }

    const service = dataServices[resource]
    if (!service) {
      return errorResponse('Route not found', 404)
    }

    switch (event.httpMethod) {
      case 'GET':
        return successResponse(await handleGet(resource, service, tenantId, id, action, event))
      case 'POST':
        return successResponse(await handlePost(resource, service, tenantId, id, action, event))
      case 'PUT':
      case 'PATCH':
        // Settings resource doesn't require an ID
        if (resource === 'settings') {
          return successResponse(await handlePut(service, tenantId, id, event))
        }
        if (!id) {
          return errorResponse('Resource ID required', 400)
        }
        return successResponse(await handlePut(service, tenantId, id, event))
      case 'DELETE':
        if (!id) {
          return errorResponse('Resource ID required', 400)
        }
        if ('delete' in service) {
          return successResponse(await service.delete(tenantId, id))
        }
        return errorResponse('Delete method not supported', 405)
      default:
        return errorResponse('Method not allowed', 405)
    }
  } catch (error) {
    console.error('Data API error:', error)
    if (error instanceof ApiError) {
      return errorResponse(error, error.statusCode)
    }
    return errorResponse(error instanceof Error ? error : 'Internal server error', 500)
  }
}

async function handleGet(
  resource: ResourceKey,
  service: (typeof dataServices)[ResourceKey],
  tenantId: string,
  id: string | undefined,
  action: string | undefined,
  event: APIGatewayProxyEvent
) {
  if (resource === 'settings') {
    return (service as typeof dataServices.settings).get(tenantId)
  }

  if (resource === 'services' && id && action === 'booking-link') {
    return (service as typeof dataServices.services).getBookingLink(tenantId, id)
  }

  if (resource === 'services' && id && action === 'availability') {
    const startDateStr = event.queryStringParameters?.startDate
    const endDateStr = event.queryStringParameters?.endDate
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined
    return (service as typeof dataServices.services).getAvailability(tenantId, id, startDate, endDate)
  }

  if (id && 'getById' in service) {
    return service.getById(tenantId, id)
  }

  if (resource === 'jobs') {
    const startDateStr = event.queryStringParameters?.startDate
    const endDateStr = event.queryStringParameters?.endDate
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined
    return (service as typeof dataServices.jobs).getAll(tenantId, startDate, endDate)
  }

  if ('getAll' in service) {
    return service.getAll(tenantId)
  }

  throw new Error('Method not supported')
}

async function handlePost(
  resource: ResourceKey,
  service: (typeof dataServices)[ResourceKey],
  tenantId: string,
  id: string | undefined,
  action: string | undefined,
  event: APIGatewayProxyEvent
) {
  // Handle settings actions (id is actually the action for settings routes)
  if (resource === 'settings' && id) {
    const payload = parseBody(event)
    
    if (id === 'get-upload-url') {
      return (service as typeof dataServices.settings).getUploadUrl(tenantId, payload)
    }
    
    if (id === 'confirm-upload') {
      return (service as typeof dataServices.settings).confirmUpload(tenantId, payload)
    }
    
    throw new ApiError('Invalid action for settings', 400)
  }

  if (resource === 'services' && id && action === 'book') {
    const payload = parseBody(event)
    // Try to extract contractor email from the logged-in user
    let contractorEmail: string | undefined
    try {
      const context = await extractContext(event)
      contractorEmail = context.userEmail
    } catch {
      // If no auth context (public booking), contractorEmail remains undefined
      // We could fetch tenant owner email here if needed
    }
    return (service as typeof dataServices.services).bookSlot(tenantId, id, payload, contractorEmail)
  }

  if (resource === 'jobs' && id && action === 'confirm') {
    return (service as typeof dataServices.jobs).confirm(tenantId, id)
  }

  if (resource === 'jobs' && id && action === 'decline') {
    const payload = parseBody(event)
    return (service as typeof dataServices.jobs).decline(tenantId, id, payload.reason)
  }

  // Send actions don't require a body
  if (resource === 'quotes' && id && action === 'send') {
    return (service as typeof dataServices.quotes).send(tenantId, id)
  }

  if (resource === 'invoices' && id && action === 'send') {
    return (service as typeof dataServices.invoices).send(tenantId, id)
  }

  // All other POST actions require a body
  const payload = parseBody(event)
  if ('create' in service) {
    return service.create(tenantId, payload)
  }
  throw new Error('Create method not supported')
}

async function handlePut(
  service: (typeof dataServices)[ResourceKey],
  tenantId: string,
  id: string | undefined,
  event: APIGatewayProxyEvent
) {
  const payload = parseBody(event)
  
  // Settings uses a different signature (no id parameter)
  if ('update' in service && typeof service.update === 'function') {
    // Check if it's the settings service (has only 2 params)
    if (service === dataServices.settings) {
      return (service as typeof dataServices.settings).update(tenantId, payload)
    }
    return service.update(tenantId, id!, payload)
  }
  
  throw new Error('Update method not available')
}

function parseBody(event: APIGatewayProxyEvent) {
  if (!event.body) {
    throw new Error('Request body required')
  }

  try {
    return JSON.parse(event.body)
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function parsePath(event: APIGatewayProxyEvent): ParsedPath {
  const normalizedPath = normalizePath(event)
  const segments = normalizedPath.split('/').filter(Boolean)

  const resource = segments[0] as ResourceKey | undefined
  const id = segments[1]
  const action = segments[2]

  return { resource, id, action }
}

function normalizePath(event: APIGatewayProxyEvent) {
  const stage = event.requestContext?.stage
  let path = event.path || '/'

  if (stage && path.startsWith(`/${stage}`)) {
    path = path.slice(stage.length + 1)
    if (!path.startsWith('/')) {
      path = `/${path}`
    }
  }

  return path
}

async function resolveTenantId(event: APIGatewayProxyEvent) {
  try {
    return await extractTenantId(event)
  } catch {
    const fallback = getDefaultTenantId()
    if (!fallback) {
      throw new Error('Tenant ID not provided')
    }
    return fallback
  }
}

