import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { successResponse, errorResponse, corsResponse, extractContext, binaryResponse } from '../../lib/middleware'
import { dataServices } from '../../lib/dataService'
import { extractTenantId } from '../../lib/middleware'
import { ensureTenantExists, getDefaultTenantId } from '../../lib/tenant'
import { ApiError } from '../../lib/errors'
import { verifyApprovalToken } from '../../lib/approvalTokens'
import { randomUUID } from 'crypto'

type ResourceKey = keyof typeof dataServices

interface ParsedPath {
  resource?: ResourceKey | string
  id?: string
  action?: string
}

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
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

      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "job_recurrences_tenantId_idx" ON "job_recurrences"("tenantId");`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "job_recurrences_contactId_idx" ON "job_recurrences"("contactId");`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "job_recurrences_serviceId_idx" ON "job_recurrences"("serviceId");`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "job_recurrences_status_idx" ON "job_recurrences"("status");`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "jobs_recurrenceId_idx" ON "jobs"("recurrenceId");`
      )

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

      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "tenant_settings_tenantId_key" ON "tenant_settings"("tenantId");`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "tenant_settings_tenantId_idx" ON "tenant_settings"("tenantId");`
      )

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
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT DEFAULT 'none';`
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "approvalAt" TIMESTAMP(3);`
      )
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "invoices_approvalStatus_idx" ON "invoices"("approvalStatus");`
      )

      // Add title column to quotes table
      await prisma.$executeRawUnsafe(`ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "title" TEXT;`)

      // Add toBeScheduled support (2026-01-14)
      console.log('Adding toBeScheduled column...')
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "toBeScheduled" BOOLEAN DEFAULT false NOT NULL;`
      )

      console.log('Making startTime nullable...')
      await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ALTER COLUMN "startTime" DROP NOT NULL;`)

      console.log('Making endTime nullable...')
      await prisma.$executeRawUnsafe(`ALTER TABLE "jobs" ALTER COLUMN "endTime" DROP NOT NULL;`)

      console.log('Adding toBeScheduled index...')
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "jobs_toBeScheduled_idx" ON "jobs"("toBeScheduled");`
      )

      // Add notes and markup to documents for photo annotations
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "notes" TEXT;`
      )
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "markup" JSONB;`
      )

      console.log('✅ Migration completed successfully')
      return successResponse({ message: 'Migration completed successfully' })
    } catch (error: any) {
      console.error('Migration error:', error)
      return errorResponse(error.message || 'Migration failed', 500)
    }
  }

  // Special handling for early access request (no auth, public endpoint)
  if (event.path?.includes('/early-access/request') && event.httpMethod === 'POST') {
    try {
      const payload = parseBody(event)
      const { name, email } = payload

      if (!name || !email) {
        return errorResponse('Name and email are required', 400)
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        return errorResponse('Invalid email format', 400)
      }

      const { default: prisma } = await import('../../lib/db')

      // Upsert request (update if already exists, create if not)
      await prisma.earlyAccessRequest.upsert({
        where: { email },
        update: {
          name,
          updatedAt: new Date(),
        },
        create: {
          id: randomUUID(),
          name,
          email,
        },
      })

      // Send notification email to admin
      const { sendEmail, buildEarlyAccessRequestEmail } = await import('../../lib/email')
      const emailPayload = buildEarlyAccessRequestEmail({ name, email })

      // Default admin email, can be overridden by env var
      const adminEmail =
        process.env.EARLY_ACCESS_ADMIN_EMAILS?.split(',')[0] || 'jordan@westwavecreative.com'

      await sendEmail({
        ...emailPayload,
        to: adminEmail,
      })

      return successResponse({
        message: 'Request submitted successfully',
      })
    } catch (error: any) {
      console.error('Early access request error:', error)
      return errorResponse(error.message || 'Failed to submit request', 500)
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
    console.log('[HANDLER v2.1] Parsed path:', {
      resource,
      id,
      action,
      method: event.httpMethod,
      path: event.path,
    })

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
        const body = parseBody(event)
        const options = body?.priceId
          ? { priceId: body.priceId }
          : body?.plan
            ? { plan: body.plan }
            : undefined
        const result = await dataServices.billing.createEmbeddedCheckoutSession(
          tenantId,
          userId,
          userEmail,
          options
        )
        return successResponse(result)
      }

      if (billingAction === 'portal-session' && event.httpMethod === 'POST') {
        const result = await dataServices.billing.createPortalSession(tenantId)
        return successResponse(result)
      }

      if (billingAction === 'upgrade-to-team' && event.httpMethod === 'POST') {
        const body = parseBody(event)
        if (body?.plan !== 'team') {
          return errorResponse('Invalid plan', 400)
        }
        const result = await dataServices.billing.createUpgradeCheckoutUrl(
          tenantId,
          userId,
          userEmail,
          'team'
        )
        return successResponse(result)
      }

      return errorResponse('Billing route not found', 404)
    }

    // Handle users/team endpoints (owner or admin, team tier for invite)
    if (resource === 'users') {
      const { default: prisma } = await import('../../lib/db')
      const context = await extractContext(event)
      const tenantId = context.tenantId
      const userId = context.userId

      const currentUser = await prisma.user.findUnique({
        where: { cognitoId: userId },
        select: { id: true, role: true, name: true },
      })

      // PATCH /users/me - any authenticated user can update their own profile
      if (id === 'me' && (event.httpMethod === 'PATCH' || event.httpMethod === 'PUT')) {
        if (!currentUser) {
          return errorResponse('User not found', 404)
        }
        const body = parseBody(event)
        const newName = body?.name
        if (typeof newName !== 'string' || !newName.trim()) {
          return errorResponse('Name is required', 400)
        }
        const updated = await prisma.user.update({
          where: { id: currentUser.id },
          data: { name: newName.trim() },
          select: { id: true, email: true, name: true, role: true },
        })
        return successResponse(updated)
      }

      const canManageTeam = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin')
      const canListTeam = currentUser && currentUser.role !== 'employee'

      if (!currentUser || !canListTeam) {
        return errorResponse('Access denied', 403)
      }

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { subscriptionTier: true },
      })

      const usersAction = id
      const targetUserId = id && usersAction !== 'invite' ? id : undefined

      if (usersAction === 'invite' && event.httpMethod === 'POST') {
        if (!canManageTeam) {
          return errorResponse('Only owners and admins can invite team members', 403)
        }
        const teamTestingSkipStripe = process.env.TEAM_TESTING_SKIP_STRIPE === 'true'
        if (tenant?.subscriptionTier !== 'team' && !teamTestingSkipStripe) {
          return errorResponse('Team subscription required to invite members', 403)
        }
        const body = parseBody(event)
        const { email, name, role: inviteRole } = body || {}
        if (!email || !name) {
          return errorResponse('Email and name are required', 400)
        }
        const role = inviteRole === 'employee' ? 'employee' : 'admin'
        const { createCognitoUser } = await import('../../lib/auth')
        const { sendEmail, buildTeamInviteEmail } = await import('../../lib/email')
        const { randomUUID } = await import('crypto')

        const existing = await prisma.user.findFirst({
          where: { email: email.toLowerCase(), tenantId },
        })
        if (existing) {
          return errorResponse('A user with this email already exists in your team', 400)
        }

        const { cognitoId, tempPassword } = await createCognitoUser(
          email.toLowerCase(),
          name
        )

        const newUser = await prisma.user.create({
          data: {
            id: randomUUID(),
            cognitoId,
            email: email.toLowerCase(),
            name,
            tenantId,
            role,
            onboardingCompletedAt: new Date(),
          },
        })

        const appUrl = process.env.PUBLIC_APP_URL || 'https://app.thejobdock.com'
        const invitePayload = buildTeamInviteEmail({
          inviteeEmail: email.toLowerCase(),
          inviteeName: name,
          inviterName: currentUser.name || 'Your team admin',
          role,
          tempPassword,
          appUrl,
        })
        await sendEmail(invitePayload)

        return successResponse({
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
        })
      }

      if (event.httpMethod === 'GET' && !targetUserId) {
        const users = await prisma.user.findMany({
          where: { tenantId },
          select: { 
            id: true, 
            email: true, 
            name: true, 
            role: true, 
            canCreateJobs: true,
            canScheduleAppointments: true,
            canSeeOtherJobs: true,
            createdAt: true 
          },
        })
        return successResponse(
          users.map((u) => ({
            ...u,
            createdAt: u.createdAt.toISOString(),
          }))
        )
      }

      if (targetUserId && (event.httpMethod === 'PATCH' || event.httpMethod === 'PUT')) {
        if (!canManageTeam) {
          return errorResponse('Only owners and admins can change roles and permissions', 403)
        }
        const body = parseBody(event)
        const newRole = body?.role
        const updateData: any = {}
        
        // Update role if provided
        if (newRole) {
          if (!['admin', 'employee'].includes(newRole)) {
            return errorResponse('Invalid role. Use admin or employee', 400)
          }
          updateData.role = newRole
        }
        
        // Update permissions if provided
        if (body?.canCreateJobs !== undefined) {
          updateData.canCreateJobs = Boolean(body.canCreateJobs)
        }
        if (body?.canScheduleAppointments !== undefined) {
          updateData.canScheduleAppointments = Boolean(body.canScheduleAppointments)
        }
        if (body?.canSeeOtherJobs !== undefined) {
          updateData.canSeeOtherJobs = Boolean(body.canSeeOtherJobs)
        }
        
        const target = await prisma.user.findFirst({
          where: { id: targetUserId, tenantId },
        })
        if (!target) {
          return errorResponse('User not found', 404)
        }
        if (target.role === 'owner') {
          return errorResponse('Cannot change owner role or permissions', 403)
        }
        
        // If no updates provided, return error
        if (Object.keys(updateData).length === 0) {
          return errorResponse('No valid fields to update', 400)
        }
        
        await prisma.user.update({
          where: { id: targetUserId },
          data: updateData,
        })
        return successResponse({ success: true })
      }

      if (targetUserId && event.httpMethod === 'DELETE') {
        if (currentUser.role !== 'owner') {
          return errorResponse('Only owners can remove team members', 403)
        }
        const target = await prisma.user.findFirst({
          where: { id: targetUserId, tenantId },
        })
        if (!target) {
          return errorResponse('User not found', 404)
        }
        if (target.role === 'owner') {
          return errorResponse('Cannot remove the owner', 403)
        }
        const ownerCount = await prisma.user.count({
          where: { tenantId, role: 'owner' },
        })
        if (ownerCount <= 1 && target.role === 'owner') {
          return errorResponse('Cannot remove the last owner', 403)
        }
        await prisma.user.delete({ where: { id: targetUserId } })
        return successResponse({ success: true })
      }

      return errorResponse('Users route not found', 404)
    }

    // Handle early access endpoints
    if (resource === 'early-access') {
      console.log('[EARLY-ACCESS] Handling early access request:', {
        resource,
        id,
        action,
        method: event.httpMethod,
      })
      const { default: prisma } = await import('../../lib/db')

      // GET /early-access/requests - List pending requests (admin only)
      if (id === 'requests' && event.httpMethod === 'GET') {
        const context = await extractContext(event)
        const adminEmails = (process.env.EARLY_ACCESS_ADMIN_EMAILS || 'jordan@westwavecreative.com')
          .split(',')
          .map(e => e.trim().toLowerCase())

        if (!adminEmails.includes(context.userEmail.toLowerCase())) {
          return errorResponse('Unauthorized: Admin access required', 403)
        }

        const requests = await prisma.earlyAccessRequest.findMany({
          orderBy: [{ approvedAt: 'asc' }, { createdAt: 'desc' }],
        })

        return successResponse(requests)
      }

      // POST /early-access/approve - Approve a request (admin only)
      if (id === 'approve' && event.httpMethod === 'POST') {
        const context = await extractContext(event)
        const adminEmails = (process.env.EARLY_ACCESS_ADMIN_EMAILS || 'jordan@westwavecreative.com')
          .split(',')
          .map(e => e.trim().toLowerCase())

        if (!adminEmails.includes(context.userEmail.toLowerCase())) {
          return errorResponse('Unauthorized: Admin access required', 403)
        }

        const payload = parseBody(event)
        const { email, requestId } = payload

        if (!email && !requestId) {
          return errorResponse('Email or requestId is required', 400)
        }

        // Get the request
        const request = requestId
          ? await prisma.earlyAccessRequest.findUnique({ where: { id: requestId } })
          : await prisma.earlyAccessRequest.findUnique({ where: { email } })

        if (!request) {
          return errorResponse('Request not found', 404)
        }

        // Add to allowlist
        await prisma.earlyAccessAllowlist.upsert({
          where: { email: request.email },
          update: {
            approvedBy: context.userEmail,
          },
          create: {
            id: randomUUID(),
            email: request.email,
            approvedBy: context.userEmail,
          },
        })

        // Mark request as approved
        const updatedRequest = await prisma.earlyAccessRequest.update({
          where: { id: request.id },
          data: {
            approvedAt: new Date(),
            approvedBy: context.userEmail,
          },
        })

        // Send approval email to user
        try {
          const { buildEarlyAccessApprovalEmail, sendEmail } = await import('../../lib/email')

          // Get the base URL from environment or construct it
          const baseUrl = process.env.PUBLIC_APP_URL || 'https://thejobdock.com'
          const signupUrl = `${baseUrl}/auth/register`

          const emailPayload = buildEarlyAccessApprovalEmail({
            name: request.name,
            email: request.email,
            signupUrl,
          })

          await sendEmail(emailPayload)
          console.log(`✅ Sent approval email to ${request.email}`)
        } catch (emailError) {
          console.error('Failed to send approval email:', emailError)
          // Don't fail the approval if email fails
        }

        return successResponse(updatedRequest)
      }

      // DELETE /early-access/delete - Delete a request (admin only)
      if (id === 'delete' && event.httpMethod === 'DELETE') {
        const context = await extractContext(event)
        const adminEmails = (process.env.EARLY_ACCESS_ADMIN_EMAILS || 'jordan@westwavecreative.com')
          .split(',')
          .map(e => e.trim().toLowerCase())

        if (!adminEmails.includes(context.userEmail.toLowerCase())) {
          return errorResponse('Unauthorized: Admin access required', 403)
        }

        const payload = parseBody(event)
        const { requestId } = payload

        if (!requestId) {
          return errorResponse('requestId is required', 400)
        }

        // Delete the request
        await prisma.earlyAccessRequest.delete({
          where: { id: requestId },
        })

        return successResponse({ message: 'Request deleted successfully' })
      }

      return errorResponse('Early access route not found', 404)
    }

    // Handle onboarding endpoints with authentication
    if (resource === 'onboarding') {
      console.log('[ONBOARDING] Handling onboarding request:', {
        resource,
        id,
        action,
        method: event.httpMethod,
      })
      const { default: prisma } = await import('../../lib/db')
      const context = await extractContext(event)
      const userId = context.userId // This is the Cognito sub
      console.log('[ONBOARDING] Extracted context, userId:', userId)

      // GET /onboarding - get onboarding status for current user
      if (!id && event.httpMethod === 'GET') {
        const user = await prisma.user.findUnique({
          where: { cognitoId: userId },
          select: { onboardingCompletedAt: true },
        })

        if (!user) {
          return errorResponse('User not found', 404)
        }

        return successResponse({
          onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
          isCompleted: !!user.onboardingCompletedAt,
        })
      }

      // POST /onboarding/complete - mark onboarding as complete
      if (id === 'complete' && event.httpMethod === 'POST') {
        const user = await prisma.user.update({
          where: { cognitoId: userId },
          data: { onboardingCompletedAt: new Date() },
          select: { onboardingCompletedAt: true },
        })

        return successResponse({
          onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
          isCompleted: true,
        })
      }

      // POST /onboarding/reset - reset onboarding status (for testing)
      if (id === 'reset' && event.httpMethod === 'POST') {
        const user = await prisma.user.update({
          where: { cognitoId: userId },
          data: { onboardingCompletedAt: null },
          select: { onboardingCompletedAt: true },
        })

        return successResponse({
          onboardingCompletedAt: null,
          isCompleted: false,
        })
      }

      return errorResponse('Onboarding route not found', 404)
    }

    // Photo file proxy with token - no auth required (token is in URL for img src)
    if (
      event.httpMethod === 'GET' &&
      resource === 'job-logs' &&
      id &&
      action === 'photo-file'
    ) {
      const photoId = event.queryStringParameters?.photoId
      const token = event.queryStringParameters?.token
      if (photoId && token) {
        const { verifyPhotoToken } = await import('../../lib/photoToken')
        if (verifyPhotoToken(token, photoId, id)) {
          const { default: prisma } = await import('../../lib/db')
          const { getFileBuffer } = await import('../../lib/fileUpload')
          const doc = await prisma.document.findFirst({
            where: {
              id: photoId,
              entityType: 'job_log',
              entityId: id,
            },
          })
          if (doc) {
            const { buffer, contentType } = await getFileBuffer(doc.fileKey)
            const ct =
              contentType ||
              (doc.fileName?.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg')
            return binaryResponse(buffer, ct)
          }
        }
      }
    }

    // Check if this is a public booking endpoint that doesn't require authentication
    const isPublicBookingEndpoint =
      resource === 'services' &&
      ((event.httpMethod === 'GET' && id === 'public') ||
        (id &&
          id !== 'public' &&
          event.httpMethod === 'GET' &&
          (action === 'availability' || !action)) ||
        (id && id !== 'public' && event.httpMethod === 'POST' && action === 'book'))

    // Check if this is a public approval endpoint (quote/invoice approval from email links)
    const isPublicApprovalEndpoint =
      event.httpMethod === 'POST' &&
      id &&
      ((resource === 'quotes' && (action === 'approve-public' || action === 'decline-public')) ||
        (resource === 'invoices' && (action === 'approve-public' || action === 'decline-public')))

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
          return errorResponse(
            'Subscription required. Please visit the billing page to activate your account.',
            402
          )
        }
      }
    }

    // Role-based access: employees can only access job-logs and time-entries
    const adminOnlyResources = [
      'contacts',
      'quotes',
      'invoices',
      'jobs',
      'job-recurrences',
      'services',
      'settings',
      'users',
    ] as const
    const employeeAllowedResources = ['job-logs', 'time-entries'] as const
    // Employees can read these (for calendar, job form, header company name/logo) but not create/update/delete
    const employeeReadOnlyResources = [
      'contacts',
      'services',
      'job-recurrences',
      'quotes',
      'invoices',
      'settings',
    ] as const
    // Employees have full access to jobs (create, read) but edit/delete restricted to own jobs
    const employeeJobAccessResources = ['jobs'] as const

    const isAdminOnlyResource = (r: string) =>
      adminOnlyResources.includes(r as any)
    const isEmployeeAllowedResource = (r: string) =>
      employeeAllowedResources.includes(r as any)
    const isEmployeeReadOnlyResource = (r: string) =>
      employeeReadOnlyResources.includes(r as any)
    const isEmployeeJobAccessResource = (r: string) =>
      employeeJobAccessResources.includes(r as any)

    let currentUser: { id: string; role: string } | null = null
    const authHeader = event.headers?.Authorization || event.headers?.authorization
    if (
      authHeader &&
      !isPublicBookingEndpoint &&
      !isPublicApprovalEndpoint &&
      resource !== 'billing'
    ) {
      const { default: prisma } = await import('../../lib/db')
      const context = await extractContext(event)
      const user = await prisma.user.findUnique({
        where: { cognitoId: context.userId },
        select: { 
          id: true, 
          role: true,
          canCreateJobs: true,
          canScheduleAppointments: true,
          canSeeOtherJobs: true,
        },
      })
      currentUser = user
      const role = user?.role || 'admin'
      const isEmployee = role === 'employee'

      if (isEmployee && isAdminOnlyResource(resource)) {
        const isReadOnlyAllowed =
          isEmployeeReadOnlyResource(resource) && event.httpMethod === 'GET'
        const isJobAccessAllowed =
          isEmployeeJobAccessResource(resource) &&
          (event.httpMethod === 'GET' ||
            event.httpMethod === 'POST' ||
            event.httpMethod === 'PUT' ||
            event.httpMethod === 'PATCH' ||
            event.httpMethod === 'DELETE')
        if (!isReadOnlyAllowed && !isJobAccessAllowed) {
          return errorResponse('Access denied. This feature requires admin privileges.', 403)
        }
      }
    }

    // Check edit/delete permissions: users without canSeeOtherJobs can only edit their own jobs
    if (
      currentUser &&
      resource === 'jobs' &&
      id &&
      (event.httpMethod === 'PUT' || event.httpMethod === 'PATCH' || event.httpMethod === 'DELETE')
    ) {
      // Admins and owners always have canSeeOtherJobs set to true (or default behavior)
      const canSeeOther = currentUser.role === 'admin' || currentUser.role === 'owner' || currentUser.canSeeOtherJobs
      
      if (!canSeeOther) {
        const { default: prisma } = await import('../../lib/db')
        const job = await prisma.job.findFirst({
          where: { id, tenantId },
          select: { createdById: true },
        })
        if (!job) {
          return errorResponse('Job not found', 404)
        }
        if (job.createdById !== currentUser.id) {
          return errorResponse('You can only move, edit, or delete appointments you created. Ask an admin or owner to make changes to this one.', 403)
        }
      }
    }

    // Assignment restriction: only admin/owner on team tier can assign jobs
    if (
      currentUser &&
      resource === 'jobs' &&
      id &&
      (event.httpMethod === 'PUT' || event.httpMethod === 'PATCH')
    ) {
      let payload: any = {}
      try {
        payload = parseBody(event) || {}
      } catch {
        /* body may be missing */
      }
      if (payload && payload.assignedTo !== undefined) {
        const hasAssignee = Array.isArray(payload.assignedTo) 
          ? payload.assignedTo.length > 0
          : typeof payload.assignedTo === 'string' && payload.assignedTo.trim() !== ''
        if (hasAssignee) {
          if (currentUser.role === 'employee') {
            return errorResponse('Only admins and owners can assign jobs to team members', 403)
          }
          const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { subscriptionTier: true },
          })
          const teamTestingSkipStripe = process.env.TEAM_TESTING_SKIP_STRIPE === 'true'
          if (tenant?.subscriptionTier !== 'team' && !teamTestingSkipStripe) {
            return errorResponse('Team subscription required to assign jobs to team members', 403)
          }
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
            return successResponse(
              await (service as typeof dataServices.jobs).permanentDelete(tenantId, id, deleteAll)
            )
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
    return (service as typeof dataServices.services).getAvailability(
      tenantId,
      id,
      startDate,
      endDate
    )
  }

  // Contacts import status endpoint
  if (resource === 'contacts' && id === 'import' && action === 'status') {
    const sessionId = event.queryStringParameters?.sessionId
    if (!sessionId) {
      throw new ApiError('Session ID required', 400)
    }
    return (service as typeof dataServices.contacts).importStatus(tenantId, sessionId)
  }

  // Get unconverted accepted quotes for invoices
  if (resource === 'invoices' && id === 'unconverted-quotes') {
    try {
      return await (service as typeof dataServices.invoices).getUnconvertedAcceptedQuotes(tenantId)
    } catch (error: any) {
      console.error('Error fetching unconverted quotes:', error)
      throw new ApiError(
        `Failed to fetch unconverted quotes: ${error.message || 'Unknown error'}`,
        500
      )
    }
  }

  // Time entries: filter by jobLogId when provided
  if (resource === 'time-entries' && !id) {
    const jobLogId = event.queryStringParameters?.jobLogId
    return (service as typeof dataServices['time-entries']).getAll(tenantId, jobLogId)
  }

  // Extract user context for privacy filtering (if authenticated)
  let currentUserId: string | undefined
  let currentUserRole: string | undefined
  let currentUserCanSeeOtherJobs: boolean | undefined
  try {
    const context = await extractContext(event)
    const { default: prisma } = await import('../../lib/db')
    const user = await prisma.user.findUnique({
      where: { cognitoId: context.userId },
      select: { id: true, role: true, canSeeOtherJobs: true },
    })
    if (user) {
      currentUserId = user.id
      currentUserRole = user.role
      // Admins and owners can always see other jobs
      currentUserCanSeeOtherJobs = user.role === 'admin' || user.role === 'owner' || (user.canSeeOtherJobs ?? false)
    }
  } catch {
    // User not authenticated or context unavailable - that's okay
  }

  if (id && 'getById' in service) {
    // Pass user context for jobs.getById and job-logs.getById
    if (resource === 'jobs') {
      return (service as typeof dataServices.jobs).getById(
        tenantId,
        id,
        currentUserId,
        currentUserRole,
        currentUserCanSeeOtherJobs
      )
    }
    if (resource === 'job-logs') {
      return (service as typeof dataServices['job-logs']).getById(
        tenantId,
        id,
        currentUserId,
        currentUserRole
      )
    }
    return service.getById(tenantId, id)
  }

  if (resource === 'jobs') {
    const startDateStr = event.queryStringParameters?.startDate
    const endDateStr = event.queryStringParameters?.endDate
    const includeArchived = event.queryStringParameters?.includeArchived === 'true'
    const showDeleted = event.queryStringParameters?.showDeleted === 'true'
    const startDate = startDateStr ? new Date(startDateStr) : undefined
    const endDate = endDateStr ? new Date(endDateStr) : undefined
    return (service as typeof dataServices.jobs).getAll(
      tenantId,
      startDate,
      endDate,
      includeArchived,
      showDeleted,
      currentUserId,
      currentUserRole,
      currentUserCanSeeOtherJobs
    )
  }

  if (resource === 'job-logs') {
    return (service as typeof dataServices['job-logs']).getAll(
      tenantId,
      currentUserId,
      currentUserRole
    )
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
    return (service as typeof dataServices.services).bookSlot(
      tenantId,
      id,
      payload,
      contractorEmail
    )
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

  // Job log photo upload: get presigned URL
  if (resource === 'job-logs' && id && action === 'get-upload-url') {
    const payload = parseBody(event)
    return (service as typeof dataServices['job-logs']).getUploadUrl(tenantId, id, payload)
  }

  // Job log photo upload: confirm and create Document record
  if (resource === 'job-logs' && id && action === 'confirm-upload') {
    const payload = parseBody(event)
    const context = await extractContext(event)
    const { default: prisma } = await import('../../lib/db')
    const user = await prisma.user.findUnique({
      where: { cognitoId: context.userId },
      select: { id: true },
    })
    return (service as typeof dataServices['job-logs']).confirmUpload(tenantId, id, {
      ...payload,
      uploadedBy: user?.id ?? context.userId,
    })
  }

  // Job log photo: delete
  if (resource === 'job-logs' && id && action === 'delete-photo') {
    const payload = parseBody(event)
    const photoId = payload?.photoId
    if (!photoId) {
      throw new ApiError('photoId required', 400)
    }
    return (service as typeof dataServices['job-logs']).deletePhoto(tenantId, id, photoId)
  }

  // Job log photo: update notes and markup (path action or body has photoId = update-photo)
  if (resource === 'job-logs' && id) {
    const payload = parseBody(event)
    const isUpdatePhoto =
      action === 'update-photo' ||
      payload?.action === 'update-photo' ||
      (payload?.photoId && (payload?.notes !== undefined || payload?.markup !== undefined))
    if (isUpdatePhoto) {
      return (service as typeof dataServices['job-logs']).updatePhoto(tenantId, id, payload)
    }
    // POST /job-logs/:id with unknown action - don't fall through to create
    return errorResponse('Unknown action for job log', 400)
  }

  // All other POST actions require a body
  const payload = parseBody(event)
  if ('create' in service) {
    // For jobs create: inject createdById from current user and check permissions
    if (resource === 'jobs' && !id) {
      const context = await extractContext(event)
      const { default: prisma } = await import('../../lib/db')
      const user = await prisma.user.findUnique({
        where: { cognitoId: context.userId },
        select: { 
          id: true, 
          role: true,
          canCreateJobs: true,
          canScheduleAppointments: true,
        },
      })
      
      // Check if user can create jobs OR schedule appointments
      // If they can schedule appointments, they can create jobs (both scheduled and unscheduled)
      const hasStartTime = payload?.startTime !== null && payload?.startTime !== undefined
      const hasEndTime = payload?.endTime !== null && payload?.endTime !== undefined
      const hasScheduledTimes = hasStartTime || hasEndTime
      
      // Allow creating jobs if:
      // 1. They can create jobs (general permission), OR
      // 2. They can schedule appointments (allows both scheduled and unscheduled jobs)
      const canCreate = user?.canCreateJobs || user?.canScheduleAppointments
      
      if (!canCreate) {
        throw new ApiError('You do not have permission to create jobs', 403)
      }
      
      if (user) {
        payload.createdById = user.id
      }
      
      // Check if user can schedule appointments (set start/end times)
      if (hasScheduledTimes && !user?.canScheduleAppointments) {
        throw new ApiError('You do not have permission to schedule appointments. You can create jobs without scheduled times.', 403)
      }
      
      const hasAssignee = payload?.assignedTo 
        ? (Array.isArray(payload.assignedTo) 
            ? payload.assignedTo.length > 0
            : typeof payload.assignedTo === 'string' && payload.assignedTo.trim() !== '')
        : false
      if (hasAssignee) {
        if (user?.role === 'employee') {
          throw new ApiError('Only admins and owners can assign jobs to team members', 403)
        }
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { subscriptionTier: true },
        })
        const teamTestingSkipStripe = process.env.TEAM_TESTING_SKIP_STRIPE === 'true'
        if (tenant?.subscriptionTier !== 'team' && !teamTestingSkipStripe) {
          throw new ApiError('Team subscription required to assign jobs to team members', 403)
        }
      }
    }
    // For job-logs create: inject acting user for assignment notification
    if (resource === 'job-logs' && !id) {
      try {
        const context = await extractContext(event)
        const { default: prisma } = await import('../../lib/db')
        const user = await prisma.user.findFirst({
          where: { cognitoId: context.userId },
          select: { id: true },
        })
        if (user) payload._actingUserId = user.id
      } catch {
        /* ignore */
      }
    }
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

  // Inject acting user ID for job/job-log updates (used for assignment notification skip-on-self-assign)
  // Also check scheduling permissions for job updates
  if ((service === dataServices.jobs || service === dataServices['job-logs']) && id) {
    try {
      const context = await extractContext(event)
      const { default: prisma } = await import('../../lib/db')
      const user = await prisma.user.findFirst({
        where: { cognitoId: context.userId },
        select: { 
          id: true,
          canScheduleAppointments: true,
        },
      })
      if (user) {
        payload._actingUserId = user.id
        
        // Check scheduling permissions when updating jobs with times
        if (service === dataServices.jobs) {
          const hasStartTime = payload?.startTime !== null && payload?.startTime !== undefined
          const hasEndTime = payload?.endTime !== null && payload?.endTime !== undefined
          if ((hasStartTime || hasEndTime) && !user.canScheduleAppointments) {
            throw new ApiError('You do not have permission to schedule appointments. You can update jobs without scheduled times.', 403)
          }
        }
      }
    } catch (error: any) {
      if (error instanceof ApiError) {
        throw error
      }
      /* ignore other errors */
    }
  }

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

  const record =
    resource === 'quotes'
      ? await prisma.quote.findUnique({ where: { id }, select: { tenantId: true } })
      : await prisma.invoice.findUnique({ where: { id }, select: { tenantId: true } })

  if (!record) {
    throw new ApiError(`${resource === 'quotes' ? 'Quote' : 'Invoice'} not found`, 404)
  }

  return record.tenantId
}

async function resolveTenantId(event: APIGatewayProxyEvent) {
  const headers = event.headers ?? {}
  const authHeader = headers.Authorization || headers.authorization

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
