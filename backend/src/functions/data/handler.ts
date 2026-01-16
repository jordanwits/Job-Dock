import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { successResponse, errorResponse, corsResponse, extractContext } from '../../lib/middleware'
import { dataServices } from '../../lib/dataService'
import { extractTenantId } from '../../lib/middleware'
import { ensureTenantExists, getDefaultTenantId } from '../../lib/tenant'
import { ApiError } from '../../lib/errors'
import { verifyApprovalToken } from '../../lib/approvalTokens'

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
      
      // Add invoice approval status columns
      await prisma.$executeRawUnsafe(`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT DEFAULT 'none';`)
      await prisma.$executeRawUnsafe(`ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "approvalAt" TIMESTAMP(3);`)
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "invoices_approvalStatus_idx" ON "invoices"("approvalStatus");`)
      
      // Add title column to quotes table
      await prisma.$executeRawUnsafe(`ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "title" TEXT;`)
      
      // Add toBeScheduled support (2026-01-14)
      console.log('Adding toBeScheduled column...')
      await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "toBeScheduled" BOOLEAN DEFAULT false NOT NULL;`)
      
      console.log('Making startTime nullable...')
      await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ALTER COLUMN "startTime" DROP NOT NULL;`)
      
      console.log('Making endTime nullable...')
      await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ALTER COLUMN "endTime" DROP NOT NULL;`)
      
      console.log('Adding toBeScheduled index...')
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "jobs_toBeScheduled_idx" ON "jobs"("toBeScheduled");`)
      
      console.log('✅ Migration completed successfully')
      return successResponse({ message: 'Migration completed successfully' })
    } catch (error: any) {
      console.error('Migration error:', error)
      return errorResponse(error.message || 'Migration failed', 500)
    }
  }

  // Special handling for billing webhook (no auth, raw body required)
  if (event.path?.includes('/billing/webhook') && event.httpMethod === 'POST') {
    try {
      const signature = event.headers['stripe-signature'] || event.headers['Stripe-Signature'] || ''
      if (!signature) {
        return errorResponse('Missing stripe-signature header', 400)
      }
      
      // Use raw body if available, otherwise use event.body
      const rawBody = event.body || ''
      
      const result = await dataServices.billing.handleWebhook(rawBody, signature)
      return successResponse(result)
    } catch (error) {
      console.error('Webhook error:', error)
      if (error instanceof ApiError) {
        return errorResponse(error, error.statusCode)
      }
      return errorResponse(error instanceof Error ? error : 'Webhook processing failed', 500)
    }
  }

  try {
    const { resource, id, action } = parsePath(event)
    console.log('[HANDLER v2.1] Parsed path:', { resource, id, action, method: event.httpMethod, path: event.path })
    
    // Handle billing endpoints with authentication
    if (resource === 'billing') {
      const { default: prisma } = await import('../../lib/db')
      const context = await extractContext(event)
      const tenantId = context.tenantId
      const userId = context.userId
      const userEmail = context.userEmail
      
      // Check if user is owner (but allow status check for all authenticated users)
      const user = await prisma.user.findUnique({
        where: { cognitoId: userId },
        select: { role: true },
      })
      
      // Allow status check for any authenticated user, but other billing actions require owner
      const billingAction = id // In billing routes, the second segment is the action
      
      if (billingAction === 'status' && event.httpMethod === 'GET') {
        const status = await dataServices.billing.getStatus(tenantId)
        return successResponse(status)
      }
      
      // For other billing actions, require owner role
      if (!user || user.role !== 'owner') {
        return errorResponse('Only tenant owners can manage billing', 403)
      }
      
      if (billingAction === 'embedded-checkout-session' && event.httpMethod === 'POST') {
        const result = await dataServices.billing.createEmbeddedCheckoutSession(tenantId, userId, userEmail)
        return successResponse(result)
      }
      
      if (billingAction === 'portal-session' && event.httpMethod === 'POST') {
        const result = await dataServices.billing.createPortalSession(tenantId)
        return successResponse(result)
      }
      
      return errorResponse('Billing route not found', 404)
    }
    
    // Check if this is a public booking endpoint that doesn't require authentication
    const isPublicBookingEndpoint = 
      resource === 'services' && (
        (event.httpMethod === 'GET' && id === 'public') ||
        (id && id !== 'public' && event.httpMethod === 'GET' && (action === 'availability' || !action)) ||
        (id && id !== 'public' && event.httpMethod === 'POST' && action === 'book')
      )
    
    // Check if this is a public approval endpoint (quote/invoice approval from email links)
    const isPublicApprovalEndpoint = 
      event.httpMethod === 'POST' && id && (
        (resource === 'quotes' && (action === 'approve-public' || action === 'decline-public')) ||
        (resource === 'invoices' && (action === 'approve-public' || action === 'decline-public'))
      )
    
    // For public endpoints, determine tenant ID from the resource itself
    let tenantId: string
    if (isPublicBookingEndpoint) {
      tenantId = 'public-booking-placeholder'
    } else if (isPublicApprovalEndpoint && id) {
      // For approval endpoints, look up the tenantId from the quote/invoice record
      tenantId = await getTenantIdFromResource(resource as 'quotes' | 'invoices', id)
    } else {
      tenantId = await resolveTenantId(event)
    }
    
    if (!isPublicBookingEndpoint && !isPublicApprovalEndpoint) {
      await ensureTenantExists(tenantId)
    }

    if (!resource) {
      return successResponse({ status: 'ok' })
    }

    // Subscription enforcement (when enabled)
    const enforceSubscription = process.env.STRIPE_ENFORCE_SUBSCRIPTION === 'true'
    if (enforceSubscription && resource !== 'billing') {
      // Always allow public endpoints
      if (!isPublicBookingEndpoint && !isPublicApprovalEndpoint) {
        // Check subscription status
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { stripeSubscriptionStatus: true },
        })
        
        const hasActiveSubscription = 
          tenant?.stripeSubscriptionStatus === 'active' || 
          tenant?.stripeSubscriptionStatus === 'trialing'
        
        if (!hasActiveSubscription) {
          return errorResponse('Subscription required. Please visit the billing page to activate your account.', 402)
        }
      }
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
          // For jobs, check if deleteAll query parameter is present
          const deleteAll = event.queryStringParameters?.deleteAll === 'true'
          // Check if permanent delete is requested
          const permanent = event.queryStringParameters?.permanent === 'true'
          
          if (resource === 'jobs' && permanent && 'permanentDelete' in service) {
            return successResponse(await (service as typeof dataServices.jobs).permanentDelete(tenantId, id, deleteAll))
          }
          
          // Default: soft delete (or regular delete for other resources)
          return successResponse(await service.delete(tenantId, id, deleteAll))
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

  // Get all active services for a tenant (for public booking page)
  // Path is /services/public?tenantId=xxx
  if (resource === 'services' && id === 'public') {
    const tenantIdParam = event.queryStringParameters?.tenantId
    if (!tenantIdParam) {
      throw new Error('Tenant ID required for public services endpoint')
    }
    return (service as typeof dataServices.services).getAllActiveForTenant(tenantIdParam)
  }
  
  if (resource === 'services' && id && action === 'availability') {
    const startDateStr = event.queryStringParameters?.startDate
    const endDateStr = event.queryStringParameters?.endDate
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined
    return (service as typeof dataServices.services).getAvailability(tenantId, id, startDate, endDate)
  }

  // Contacts import status endpoint
  if (resource === 'contacts' && id === 'import' && action === 'status') {
    const sessionId = event.queryStringParameters?.sessionId
    if (!sessionId) {
      throw new ApiError('Session ID required', 400)
    }
    return (service as typeof dataServices.contacts).importStatus(tenantId, sessionId)
  }

  if (id && 'getById' in service) {
    return service.getById(tenantId, id)
  }

  if (resource === 'jobs') {
    const startDateStr = event.queryStringParameters?.startDate
    const endDateStr = event.queryStringParameters?.endDate
    const includeArchived = event.queryStringParameters?.includeArchived === 'true'
    const showDeleted = event.queryStringParameters?.showDeleted === 'true'
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined
    return (service as typeof dataServices.jobs).getAll(tenantId, startDate, endDate, includeArchived, showDeleted)
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

  if (resource === 'jobs' && id && action === 'restore') {
    return (service as typeof dataServices.jobs).restore(tenantId, id)
  }

  // Contacts import endpoints
  if (resource === 'contacts' && id === 'import' && action === 'preview') {
    console.log('[HANDLER v2.1] Matched import preview route')
    const payload = parseBody(event)
    console.log('[HANDLER v2.1] Calling importPreview with payload keys:', Object.keys(payload))
    return (service as typeof dataServices.contacts).importPreview(tenantId, payload)
  }

  if (resource === 'contacts' && id === 'import' && action === 'init') {
    const payload = parseBody(event)
    return (service as typeof dataServices.contacts).importInit(tenantId, payload)
  }

  if (resource === 'contacts' && id === 'import' && action === 'process') {
    const payload = parseBody(event)
    return (service as typeof dataServices.contacts).importProcess(tenantId, payload.sessionId)
  }

  if (resource === 'contacts' && id === 'import' && action === 'resolve-conflict') {
    const payload = parseBody(event)
    return (service as typeof dataServices.contacts).importResolveConflict(tenantId, payload)
  }

  // Send actions don't require a body
  if (resource === 'quotes' && id && action === 'send') {
    return (service as typeof dataServices.quotes).send(tenantId, id)
  }

  if (resource === 'invoices' && id && action === 'send') {
    return (service as typeof dataServices.invoices).send(tenantId, id)
  }

  // Public approval actions - verify token first
  if (resource === 'quotes' && id && action === 'approve-public') {
    const token = event.queryStringParameters?.token
    if (!token) {
      throw new ApiError('Approval token required', 400)
    }
    if (!verifyApprovalToken('quote', id, tenantId, token)) {
      throw new ApiError('Invalid or expired approval token', 403)
    }
    return (service as typeof dataServices.quotes).approve(tenantId, id)
  }

  if (resource === 'quotes' && id && action === 'decline-public') {
    const token = event.queryStringParameters?.token
    if (!token) {
      throw new ApiError('Approval token required', 400)
    }
    if (!verifyApprovalToken('quote', id, tenantId, token)) {
      throw new ApiError('Invalid or expired approval token', 403)
    }
    return (service as typeof dataServices.quotes).decline(tenantId, id)
  }

  if (resource === 'invoices' && id && action === 'approve-public') {
    const token = event.queryStringParameters?.token
    if (!token) {
      throw new ApiError('Approval token required', 400)
    }
    if (!verifyApprovalToken('invoice', id, tenantId, token)) {
      throw new ApiError('Invalid or expired approval token', 403)
    }
    return (service as typeof dataServices.invoices).setApprovalStatus(tenantId, id, 'accepted')
  }

  if (resource === 'invoices' && id && action === 'decline-public') {
    const token = event.queryStringParameters?.token
    if (!token) {
      throw new ApiError('Approval token required', 400)
    }
    if (!verifyApprovalToken('invoice', id, tenantId, token)) {
      throw new ApiError('Invalid or expired approval token', 403)
    }
    return (service as typeof dataServices.invoices).setApprovalStatus(tenantId, id, 'declined')
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

/**
 * Look up tenant ID from a quote or invoice record
 * Used for public approval endpoints where we need the tenant ID to verify the approval token
 */
async function getTenantIdFromResource(
  resource: 'quotes' | 'invoices',
  id: string
): Promise<string> {
  const { default: prisma } = await import('../../lib/db')
  
  const record = resource === 'quotes'
    ? await prisma.quote.findUnique({ where: { id }, select: { tenantId: true } })
    : await prisma.invoice.findUnique({ where: { id }, select: { tenantId: true } })
  
  if (!record) {
    throw new ApiError(`${resource === 'quotes' ? 'Quote' : 'Invoice'} not found`, 404)
  }
  
  return record.tenantId
}

async function resolveTenantId(event: APIGatewayProxyEvent) {
  const authHeader = event.headers.Authorization || event.headers.authorization
  
  try {
    return await extractTenantId(event)
  } catch (error) {
    // For authenticated requests, NEVER fall back to default tenant
    // This prevents production accounts from accidentally sharing data
    if (authHeader) {
      console.error('Failed to resolve tenant for authenticated request:', error)
      throw new Error('Authentication failed: Unable to determine tenant')
    }
    
    // For unauthenticated requests in development, allow fallback to demo tenant
    // In production, this should be disabled via environment variable
    const isDevelopment = process.env.NODE_ENV !== 'production'
    const fallback = getDefaultTenantId()
    
    if (!fallback || !isDevelopment) {
      throw new Error('Tenant ID not provided')
    }
    
    console.warn('Using fallback tenant for unauthenticated request:', fallback)
    return fallback
  }
}

