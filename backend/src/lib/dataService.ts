import {
  Prisma,
  Quote,
  Invoice,
  QuoteLineItem,
  InvoiceLineItem,
  Contact,
  Job,
  JobRecurrence,
} from '@prisma/client'
import prisma from './db'
import { ensureTenantExists } from './tenant'
import { ApiError } from './errors'
import {
  sendEmail,
  buildClientConfirmationEmail,
  buildClientPendingEmail,
  buildContractorNotificationEmail,
  buildClientBookingConfirmedEmail,
  buildClientBookingDeclinedEmail,
  buildJobAssignmentNotificationEmail,
  sendQuoteEmail,
  sendInvoiceEmail,
} from './email'
import { uploadFile, deleteFile, getFileUrl } from './fileUpload'
import { createPhotoToken } from './photoToken'
import {
  createImportSession,
  getImportSession,
  processImportSession,
  resolveConflict,
  getImportSessionData,
  parseCSVPreview,
} from './csvImport'

// Recurrence types
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'custom'

export interface RecurrencePayload {
  frequency: RecurrenceFrequency
  interval: number
  count?: number
  untilDate?: string
  daysOfWeek?: number[]
}

const toNumber = (value: Prisma.Decimal | number | null | undefined) => (value ? Number(value) : 0)

// Helper to parse and validate a date, returns null if invalid
function parseValidDate(value: any): Date | null {
  if (!value) return null
  const date = new Date(value)
  return isNaN(date.getTime()) ? null : date
}

// JobAssignment type for structured assignments
interface JobAssignment {
  userId: string
  role: string
  price?: number | null
}

// Normalize assignedTo to new format: array of assignment objects
// Accepts both old format (array of IDs) and new format (array of objects)
function normalizeAssignedTo(assignedTo: any): JobAssignment[] | null {
  if (!assignedTo) return null
  
  // Handle new format: array of objects
  if (Array.isArray(assignedTo) && assignedTo.length > 0) {
    // Check if it's already in new format (array of objects with userId)
    if (typeof assignedTo[0] === 'object' && assignedTo[0] !== null && 'userId' in assignedTo[0]) {
      const normalized = assignedTo
        .filter((item: any) => item && typeof item === 'object' && item.userId && typeof item.userId === 'string')
        .map((item: any) => ({
          userId: item.userId.trim(),
          role: typeof item.role === 'string' ? item.role.trim() : 'Team Member',
          price: typeof item.price === 'number' ? item.price : (item.price === null || item.price === undefined ? null : undefined),
        }))
      return normalized.length > 0 ? normalized : null
    }
    
    // Handle old format: array of user ID strings
    const filtered = assignedTo.filter((id: any) => id && typeof id === 'string' && id.trim() !== '')
    if (filtered.length > 0) {
      return filtered.map((id: string) => ({
        userId: id.trim(),
        role: 'Team Member',
        price: null,
      }))
    }
  }
  
  // Handle old format: single string ID
  if (typeof assignedTo === 'string' && assignedTo.trim() !== '') {
    return [{
      userId: assignedTo.trim(),
      role: 'Team Member',
      price: null,
    }]
  }
  
  return null
}

// Extract user IDs from assignedTo (handles both old and new formats)
function extractUserIds(assignedTo: any): string[] {
  if (!assignedTo) return []
  
  // New format: array of objects with userId
  if (Array.isArray(assignedTo) && assignedTo.length > 0) {
    if (typeof assignedTo[0] === 'object' && assignedTo[0] !== null && 'userId' in assignedTo[0]) {
      return assignedTo
        .filter((item: any) => item && typeof item === 'object' && item.userId)
        .map((item: any) => item.userId)
        .filter((id: any) => id && typeof id === 'string')
    }
    // Old format: array of strings
    return assignedTo.filter((id: any) => id && typeof id === 'string')
  }
  
  // Old format: single string
  if (typeof assignedTo === 'string' && assignedTo.trim() !== '') {
    return [assignedTo.trim()]
  }
  
  return []
}

// Fetch assigned users and create assignedToName string
async function getAssignedToName(tenantId: string, assignedTo: any): Promise<string | undefined> {
  if (!assignedTo) return undefined
  
  const userIds = extractUserIds(assignedTo)
  
  if (userIds.length === 0) return undefined
  
  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, tenantId },
    select: { name: true },
  })
  
  const names = users.map(u => u.name).filter(Boolean)
  return names.length > 0 ? names.join(', ') : undefined
}

// Validate assignedTo structure and that all user IDs belong to tenant (throws if invalid)
async function validateAssignedTo(tenantId: string, assignedTo: any): Promise<void> {
  if (!assignedTo) return
  
  const normalized = normalizeAssignedTo(assignedTo)
  if (!normalized || normalized.length === 0) return
  
  // Extract user IDs - ensure they're strings
  const userIds = normalized
    .map(a => {
      if (typeof a === 'object' && a !== null && 'userId' in a) {
        return typeof a.userId === 'string' ? a.userId : null
      }
      // Fallback: if it's already a string (old format)
      return typeof a === 'string' ? a : null
    })
    .filter((id): id is string => id !== null && typeof id === 'string' && id.trim() !== '')
  
  if (userIds.length === 0) return
  
  const users = await prisma.user.findMany({
    where: { 
      id: { in: userIds },
      tenantId 
    },
    select: { id: true },
  })
  
  const foundIds = new Set(users.map(u => u.id))
  const invalidIds = userIds.filter(id => !foundIds.has(id))
  
  if (invalidIds.length > 0) {
    throw new ApiError(`Assigned user(s) must be members of your team. Invalid IDs: ${invalidIds.join(', ')}`, 400)
  }
  
  // Validate roles are strings
  for (const assignment of normalized) {
    if (typeof assignment === 'object' && assignment !== null) {
      if (typeof assignment.role !== 'string' || assignment.role.trim() === '') {
        throw new ApiError('All assignments must have a valid role (non-empty string)', 400)
      }
      
      // Validate prices are numbers if provided
      if (assignment.price !== null && assignment.price !== undefined && typeof assignment.price !== 'number') {
        throw new ApiError('Price must be a number if provided', 400)
      }
    }
  }
}

// Apply privacy filtering to assignedTo based on current user role
function getAssignedToWithPrivacy(
  assignedTo: any,
  currentUserId: string | undefined,
  currentUserRole: string | undefined
): JobAssignment[] | null {
  const normalized = normalizeAssignedTo(assignedTo)
  if (!normalized || normalized.length === 0) return null
  
  // Admins and owners can see all pricing
  if (currentUserRole === 'admin' || currentUserRole === 'owner') {
    return normalized
  }
  
  // Employees can only see their own price
  if (currentUserRole === 'employee' && currentUserId) {
    return normalized.map(assignment => {
      if (assignment.userId === currentUserId) {
        // Show their own assignment with price
        return assignment
      } else {
        // Hide price for other assignments
        return {
          userId: assignment.userId,
          role: assignment.role,
          price: undefined, // Explicitly hide price
        }
      }
    })
  }
  
  // Not assigned or unknown role: hide all prices
  return normalized.map(assignment => ({
    userId: assignment.userId,
    role: assignment.role,
    price: undefined, // Hide price
  }))
}

// Send assignment notification email (call after successful create/update)
async function sendAssignmentNotification(params: {
  tenantId: string
  assignedTo: any
  assignerUserId: string | undefined
  jobTitle: string
  startTime: Date | null
  endTime: Date | null
  location: string | null | undefined
  contactName?: string
  viewPath?: string // e.g. '/app/scheduling' for jobs, '/app/job-logs' for job logs
}): Promise<void> {
  const { tenantId, assignedTo, assignerUserId, jobTitle, startTime, endTime, location, contactName, viewPath } = params

  const userIds = extractUserIds(assignedTo)
  
  if (userIds.length === 0) return

  // Get all assignees
  const assignees = await prisma.user.findMany({
    where: { 
      id: { in: userIds },
      tenantId 
    },
    select: { id: true, name: true, email: true },
  })

  if (assignees.length === 0) return

  const assigner = assignerUserId
    ? await prisma.user.findFirst({
        where: { id: assignerUserId, tenantId },
        select: { name: true },
      })
    : null

  const settings = await prisma.tenantSettings.findUnique({
    where: { tenantId },
  })
  const fromName = settings?.companyDisplayName || 'JobDock'
  const replyTo = settings?.companySupportEmail || undefined

  // Fetch logo URL if available (7 days expiration for email)
  let logoUrl: string | null = null
  if (settings?.logoUrl) {
    try {
      const { getFileUrl } = await import('./fileUpload')
      logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
    } catch (error) {
      console.error('Error fetching logo URL for email:', error)
    }
  }

  // Send notification to each assignee (excluding the assigner)
  for (const assignee of assignees) {
    if (assignee.id === assignerUserId) continue

    const payload = buildJobAssignmentNotificationEmail({
      assigneeName: assignee.name || 'there',
      assigneeEmail: assignee.email,
      assignerName: assigner?.name || 'Your team',
      jobTitle,
      startTime,
      endTime,
      location: location || undefined,
      contactName,
      viewPath,
      fromName,
      replyTo,
      companyName: fromName,
      logoUrl,
      settings: {
        companySupportEmail: settings?.companySupportEmail || null,
        companyPhone: settings?.companyPhone || null,
      },
    })
    await sendEmail(payload)
  }
}

// Helper to generate recurrence instances
function generateRecurrenceInstances(params: {
  startTime: Date
  endTime: Date
  recurrence: RecurrencePayload
}): Array<{ startTime: Date; endTime: Date }> {
  const { startTime, endTime, recurrence } = params
  const instances: Array<{ startTime: Date; endTime: Date }> = []

  const duration = endTime.getTime() - startTime.getTime()

  // Hard limits for safety
  const MAX_OCCURRENCES = 50
  const MAX_MONTHS = 12

  const maxCount = recurrence.count ? Math.min(recurrence.count, MAX_OCCURRENCES) : MAX_OCCURRENCES

  const maxDate = recurrence.untilDate
    ? new Date(recurrence.untilDate)
    : new Date(startTime.getTime() + MAX_MONTHS * 30 * 24 * 60 * 60 * 1000)

  // #region agent log
  console.log(
    '[DEBUG] generateRecurrenceInstances entry:',
    JSON.stringify({
      startTimeISO: startTime.toISOString(),
      endTimeISO: endTime.toISOString(),
      recurrence,
      maxCount,
      durationMs: duration,
    })
  )
  // #endregion

  // Custom pattern (specific days of week) - works for both 'custom' and 'weekly' with daysOfWeek
  if (
    (recurrence.frequency === 'custom' || recurrence.frequency === 'weekly') &&
    recurrence.daysOfWeek &&
    recurrence.daysOfWeek.length > 0
  ) {
    // #region agent log
    console.log(
      '[DEBUG] Using custom pattern with specific days:',
      JSON.stringify({
        frequency: recurrence.frequency,
        daysOfWeek: recurrence.daysOfWeek,
        maxCount,
      })
    )
    // #endregion
    let currentDate = new Date(startTime)
    let instanceCount = 0

    // Generate instances for up to MAX_MONTHS
    const endSearchDate = new Date(
      Math.min(maxDate.getTime(), startTime.getTime() + MAX_MONTHS * 30 * 24 * 60 * 60 * 1000)
    )

    while (instanceCount < maxCount && currentDate <= endSearchDate) {
      const dayOfWeek = currentDate.getDay()

      if (recurrence.daysOfWeek.includes(dayOfWeek)) {
        instances.push({
          startTime: new Date(currentDate),
          endTime: new Date(currentDate.getTime() + duration),
        })
        instanceCount++
      }

      // Move to next day
      currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
    }
    // #region agent log
    console.log(
      '[DEBUG] Custom pattern instances generated:',
      JSON.stringify({
        instanceCount,
        firstDateISO: instances[0]?.startTime.toISOString(),
        lastDateISO: instances[instances.length - 1]?.startTime.toISOString(),
      })
    )
    // #endregion

    return instances
  }

  // Standard patterns - FIXED 2026-01-12T22:20:00
  // Normalize frequency to lowercase string for comparison safety
  const freq = String(recurrence.frequency).toLowerCase().trim()
  const interval = recurrence.interval || 1
  // DEBUG: Log frequency detection
  console.log('RECURRENCE_DEBUG_V3:', {
    freq,
    interval,
    originalFreq: recurrence.frequency,
    maxCount,
  })

  // #region agent log
  console.log(
    '[DEBUG] Using standard pattern:',
    JSON.stringify({ freq, originalFrequency: recurrence.frequency, interval, maxCount })
  )
  // #endregion

  let currentStart = new Date(startTime)
  let currentEnd = new Date(endTime)

  for (let i = 0; i < maxCount; i++) {
    if (currentStart > maxDate) break

    instances.push({
      startTime: new Date(currentStart),
      endTime: new Date(currentEnd),
    })

    // Calculate next occurrence based on frequency
    // Use normalized freq for comparison
    if (freq === 'daily') {
      currentStart = new Date(currentStart.getTime() + interval * 24 * 60 * 60 * 1000)
    } else if (freq === 'weekly') {
      currentStart = new Date(currentStart.getTime() + interval * 7 * 24 * 60 * 60 * 1000)
    } else if (freq === 'monthly') {
      const newStart = new Date(currentStart)
      newStart.setMonth(newStart.getMonth() + interval)
      currentStart = newStart
    } else {
      // Fallback: if frequency doesn't match any pattern, default to daily
      // This ensures dates always increment
      console.log('[DEBUG] Unknown frequency, defaulting to daily:', freq)
      currentStart = new Date(currentStart.getTime() + interval * 24 * 60 * 60 * 1000)
    }

    currentEnd = new Date(currentStart.getTime() + duration)
  }

  // #region agent log
  console.log(
    '[DEBUG] Standard pattern instances generated:',
    JSON.stringify({
      totalInstances: instances.length,
      firstDateISO: instances[0]?.startTime.toISOString(),
      secondDateISO: instances[1]?.startTime.toISOString(),
      lastDateISO: instances[instances.length - 1]?.startTime.toISOString(),
    })
  )
  // #endregion

  return instances
}

// Helper to create recurring jobs
async function createRecurringJobs(params: {
  tenantId: string
  title: string
  description?: string
  contactId: string
  serviceId?: string
  quoteId?: string
  invoiceId?: string
  startTime: Date
  endTime: Date
  status?: string
  location?: string
  price?: number
  notes?: string
  assignedTo?: string | string[] | null
  breaks?: Array<{ startTime: string; endTime: string; reason?: string }>
  recurrence: RecurrencePayload
  forceBooking?: boolean
  excludeJobId?: string // Job ID to exclude from conflict checking (for converting existing job to recurring)
  createdById?: string
}) {
  const {
    tenantId,
    title,
    description,
    contactId,
    serviceId,
    quoteId,
    invoiceId,
    startTime,
    endTime,
    status = 'scheduled',
    location,
    price,
    notes,
    assignedTo: assignedToParam,
    breaks,
    recurrence,
    forceBooking = false,
    excludeJobId,
    createdById,
  } = params

  // JobRecurrence.assignedTo is String? - convert array to first element for now (schema not yet migrated)
  const assignedToForRecurrence =
    assignedToParam == null
      ? null
      : Array.isArray(assignedToParam)
        ? assignedToParam[0] && typeof assignedToParam[0] === 'string'
          ? assignedToParam[0]
          : null
        : typeof assignedToParam === 'string' && assignedToParam.trim() !== ''
          ? assignedToParam
          : null

  // Jobs use Json (array) - normalize to array
  const assignedToForJobs = normalizeAssignedTo(assignedToParam)

  return await prisma.$transaction(async tx => {
    // 1. Create the JobRecurrence record
    const jobRecurrence = await tx.jobRecurrence.create({
      data: {
        tenantId,
        contactId,
        serviceId,
        title,
        description,
        location,
        notes,
        assignedTo: assignedToForRecurrence,
        status: 'active',
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        count: recurrence.count,
        untilDate: recurrence.untilDate ? new Date(recurrence.untilDate) : null,
        daysOfWeek: recurrence.daysOfWeek || [],
        startTime,
        endTime,
      },
    })

    // 2. Generate all occurrence instances
    let instances = generateRecurrenceInstances({
      startTime,
      endTime,
      recurrence,
    })

    // #region agent log
    console.log(
      '[DEBUG] Generated instances:',
      JSON.stringify({
        count: instances.length,
        first3: instances
          .slice(0, 3)
          .map(i => ({ start: i.startTime.toISOString(), end: i.endTime.toISOString() })),
        allStartTimes: instances.map(i => i.startTime.toISOString()),
      })
    )
    // #endregion

    // 2.5. Filter out instances that fall within break periods
    if (breaks && breaks.length > 0) {
      instances = instances.filter(instance => {
        // Check if this instance overlaps with any break period
        const instanceStart = instance.startTime
        const instanceEnd = instance.endTime

        for (const breakPeriod of breaks) {
          const breakStart = new Date(breakPeriod.startTime)
          const breakEnd = new Date(breakPeriod.endTime)

          // Check if instance overlaps with break period
          if (instanceStart < breakEnd && instanceEnd > breakStart) {
            console.log(
              `Skipping instance ${instanceStart.toISOString()} due to break period ${breakStart.toISOString()} - ${breakEnd.toISOString()}`
            )
            return false // Skip this instance
          }
        }

        return true // Keep this instance
      })
    }

    // Double booking check removed - allowing overlapping recurring jobs

    // 4. Create all job instances
    const jobs = await Promise.all(
      instances.map(instance =>
        tx.job.create({
          data: {
            tenantId,
            title,
            description,
            contactId,
            serviceId,
            quoteId,
            invoiceId,
            recurrenceId: jobRecurrence.id,
            startTime: instance.startTime,
            endTime: instance.endTime,
            status,
            location,
            price: price !== undefined ? price : null,
            notes,
            assignedTo: assignedToForJobs,
            breaks: undefined, // Recurring jobs don't have breaks initially
            createdById: createdById ?? undefined,
          },
          include: {
            contact: true,
            service: true,
          },
        })
      )
    )

    // Return the first job with recurrence metadata
    const firstJob = jobs[0]
    const assignedToName = await getAssignedToName(tenantId, firstJob.assignedTo)
    return {
      ...firstJob,
      assignedToName,
      recurrenceId: jobRecurrence.id,
      occurrenceCount: jobs.length,
    }
  })
}

const withContactInfo = (
  contact?: Pick<Contact, 'firstName' | 'lastName' | 'email' | 'company'> | null
) => ({
  contactName: contact
    ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || undefined
    : undefined,
  contactEmail: contact?.email ?? undefined,
  contactCompany: contact?.company ?? undefined,
})

async function generateSequentialNumber(tenantId: string, model: 'quote' | 'invoice') {
  const count =
    model === 'quote'
      ? await prisma.quote.count({ where: { tenantId } })
      : await prisma.invoice.count({ where: { tenantId } })
  const prefix = model === 'quote' ? 'QT' : 'INV'
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
}

const serializeQuote = (
  quote: Quote & {
    contact?: Contact
    lineItems: QuoteLineItem[]
  }
) => ({
  id: quote.id,
  quoteNumber: quote.quoteNumber,
  title: quote.title ?? undefined,
  contactId: quote.contactId,
  lineItems: quote.lineItems.map((item: QuoteLineItem) => ({
    id: item.id,
    description: item.description,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    total: toNumber(item.total),
  })),
  subtotal: toNumber(quote.subtotal),
  taxRate: toNumber(quote.taxRate),
  taxAmount: toNumber(quote.taxAmount),
  discount: toNumber(quote.discount),
  discountReason: quote.discountReason ?? undefined,
  total: toNumber(quote.total),
  status: quote.status as any,
  notes: quote.notes ?? undefined,
  validUntil: quote.validUntil?.toISOString(),
  createdAt: quote.createdAt.toISOString(),
  updatedAt: quote.updatedAt.toISOString(),
  ...withContactInfo(quote.contact),
})

const serializeInvoice = (
  invoice: Invoice & {
    contact?: Contact
    lineItems: InvoiceLineItem[]
  }
) => ({
  id: invoice.id,
  invoiceNumber: invoice.invoiceNumber,
  title: invoice.title ?? undefined,
  contactId: invoice.contactId,
  lineItems: invoice.lineItems.map((item: InvoiceLineItem) => ({
    id: item.id,
    description: item.description,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    total: toNumber(item.total),
  })),
  subtotal: toNumber(invoice.subtotal),
  taxRate: toNumber(invoice.taxRate),
  taxAmount: toNumber(invoice.taxAmount),
  discount: toNumber(invoice.discount),
  discountReason: invoice.discountReason ?? undefined,
  total: toNumber(invoice.total),
  status: invoice.status,
  paymentStatus: invoice.paymentStatus,
  approvalStatus: (invoice as any).approvalStatus ?? 'none',
  approvalAt: (invoice as any).approvalAt?.toISOString(),
  notes: invoice.notes ?? undefined,
  dueDate: invoice.dueDate?.toISOString(),
  paymentTerms: invoice.paymentTerms,
  paidAmount: toNumber(invoice.paidAmount),
  trackResponse: (invoice as any).trackResponse ?? true,
  trackPayment: (invoice as any).trackPayment ?? true,
  createdAt: invoice.createdAt.toISOString(),
  updatedAt: invoice.updatedAt.toISOString(),
  ...withContactInfo(invoice.contact),
})

export const dataServices = {
  settings: {
    get: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })
      let settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })

      // If settings don't exist, create default settings
      if (!settings) {
        settings = await prisma.tenantSettings.create({
          data: {
            tenantId,
            companyDisplayName: tenant?.name || 'Your Company',
          },
        })
      }

      // Generate signed URLs for logo and PDF templates if they exist
      const result: any = {
        ...settings,
        tenantName: tenant?.name,
      }

      if (settings.logoUrl) {
        try {
          result.logoSignedUrl = await getFileUrl(settings.logoUrl, 3600)
        } catch (error) {
          console.error('Error generating logo signed URL:', error)
        }
      }

      if (settings.invoicePdfTemplateKey) {
        try {
          result.invoicePdfSignedUrl = await getFileUrl(settings.invoicePdfTemplateKey, 3600)
        } catch (error) {
          console.error('Error generating invoice PDF signed URL:', error)
        }
      }

      if (settings.quotePdfTemplateKey) {
        try {
          result.quotePdfSignedUrl = await getFileUrl(settings.quotePdfTemplateKey, 3600)
        } catch (error) {
          console.error('Error generating quote PDF signed URL:', error)
        }
      }

      return result
    },
    // Public method for getting tenant settings (for public booking pages)
    getPublic: async (tenantId: string) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })
      let settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })

      // If settings don't exist, create default settings
      if (!settings) {
        settings = await prisma.tenantSettings.create({
          data: {
            tenantId,
            companyDisplayName: tenant?.name || 'Your Company',
          },
        })
      }

      // Generate signed URL for logo if it exists
      // Only return companyDisplayName if it's actually set (don't fallback to tenant.name)
      const result: any = {
        companyDisplayName: settings.companyDisplayName || null,
        tenantName: tenant?.name,
        logoSignedUrl: null,
      }

      if (settings.logoUrl) {
        try {
          result.logoSignedUrl = await getFileUrl(settings.logoUrl, 3600)
        } catch (error) {
          console.error('Error generating logo signed URL:', error)
        }
      }

      return result
    },
    update: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)

      // Ensure settings exist
      let settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })

      if (!settings) {
        settings = await prisma.tenantSettings.create({
          data: {
            tenantId,
            ...payload,
          },
        })
      } else {
        settings = await prisma.tenantSettings.update({
          where: { tenantId },
          data: payload,
        })
      }

      return settings
    },
    getUploadUrl: async (
      tenantId: string,
      payload: { type: 'logo' | 'invoice-pdf' | 'quote-pdf'; filename: string; contentType: string }
    ) => {
      await ensureTenantExists(tenantId)

      const { type, filename, contentType } = payload

      // Validate file type based on upload type
      if (type === 'logo') {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
        if (!allowedTypes.includes(contentType)) {
          throw new ApiError(
            'Invalid file type. Only PNG, JPEG, and SVG are allowed for logos.',
            400
          )
        }
      } else {
        if (contentType !== 'application/pdf') {
          throw new ApiError('Invalid file type. Only PDF files are allowed for templates.', 400)
        }
      }

      // Generate unique key
      const { randomUUID } = await import('crypto')
      const ext = filename.split('.').pop()
      const folder =
        type === 'logo'
          ? `logos/${tenantId}`
          : `pdf-templates/${tenantId}/${type.replace('-pdf', 's')}`
      const key = `${folder}/${randomUUID()}.${ext}`

      // Generate pre-signed URL for upload
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
      const FILES_BUCKET = process.env.FILES_BUCKET || ''

      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: FILES_BUCKET,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn: 300 } // 5 minutes
      )

      return {
        uploadUrl,
        key,
        type,
      }
    },
    confirmUpload: async (
      tenantId: string,
      payload: { key: string; type: 'logo' | 'invoice-pdf' | 'quote-pdf' }
    ) => {
      await ensureTenantExists(tenantId)

      const { key, type } = payload

      // Get existing settings to delete old file if it exists
      const settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })

      let oldKey: string | null = null
      let updateData: any = {}

      if (type === 'logo') {
        oldKey = settings?.logoUrl || null
        updateData.logoUrl = key
      } else if (type === 'invoice-pdf') {
        oldKey = settings?.invoicePdfTemplateKey || null
        updateData.invoicePdfTemplateKey = key
      } else if (type === 'quote-pdf') {
        oldKey = settings?.quotePdfTemplateKey || null
        updateData.quotePdfTemplateKey = key
      }

      // Delete old file if it exists
      if (oldKey) {
        try {
          await deleteFile(oldKey)
        } catch (error) {
          console.error(`Error deleting old ${type}:`, error)
        }
      }

      // Update settings with new file key
      const updatedSettings = await dataServices.settings.update(tenantId, updateData)

      // Generate signed URL for the new file
      const signedUrl = await getFileUrl(key, 3600)

      return {
        ...updatedSettings,
        ...(type === 'logo' && { logoSignedUrl: signedUrl }),
        ...(type === 'invoice-pdf' && { invoicePdfSignedUrl: signedUrl }),
        ...(type === 'quote-pdf' && { quotePdfSignedUrl: signedUrl }),
      }
    },
  },
  contacts: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      return prisma.contact.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      })
    },
    getById: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const contact = await prisma.contact.findFirst({
        where: { id, tenantId },
      })
      if (!contact) {
        throw new Error('Contact not found')
      }
      return contact
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      return prisma.contact.create({
        data: {
          tenantId,
          firstName: payload.firstName,
          lastName: payload.lastName,
          email: payload.email,
          phone: payload.phone,
          company: payload.company,
          jobTitle: payload.jobTitle,
          address: payload.address,
          city: payload.city,
          state: payload.state,
          zipCode: payload.zipCode,
          country: payload.country ?? 'USA',
          tags: payload.tags ?? [],
          notes: payload.notes,
          status: payload.status ?? 'customer',
        },
      })
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      // Verify contact belongs to tenant before updating
      const contact = await prisma.contact.findFirst({
        where: { id, tenantId },
      })
      if (!contact) {
        throw new ApiError('Contact not found', 404)
      }
      return prisma.contact.update({
        where: { id },
        data: {
          ...payload,
          tags: payload.tags ?? undefined,
        },
      })
    },
    delete: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      return prisma.$transaction(async tx => {
        const contact = await tx.contact.findFirst({
          where: { id, tenantId },
          select: { id: true },
        })

        if (!contact) {
          throw new ApiError('Contact not found', 404)
        }

        const quoteIds = await tx.quote.findMany({
          where: { contactId: id, tenantId },
          select: { id: true },
        })

        const invoiceIds = await tx.invoice.findMany({
          where: { contactId: id, tenantId },
          select: { id: true },
        })

        const quoteIdList = quoteIds.map(record => record.id)
        const invoiceIdList = invoiceIds.map(record => record.id)

        const [
          deletedQuoteLineItems,
          deletedInvoiceLineItems,
          deletedPayments,
          deletedQuotes,
          deletedInvoices,
          deletedJobs,
          deletedJobRecurrences,
        ] = await Promise.all([
          quoteIdList.length
            ? tx.quoteLineItem.deleteMany({ where: { quoteId: { in: quoteIdList } } })
            : Promise.resolve({ count: 0 }),
          invoiceIdList.length
            ? tx.invoiceLineItem.deleteMany({ where: { invoiceId: { in: invoiceIdList } } })
            : Promise.resolve({ count: 0 }),
          invoiceIdList.length
            ? tx.payment.deleteMany({ where: { invoiceId: { in: invoiceIdList } } })
            : Promise.resolve({ count: 0 }),
          tx.quote.deleteMany({ where: { id: { in: quoteIdList } } }),
          tx.invoice.deleteMany({ where: { id: { in: invoiceIdList } } }),
          tx.job.deleteMany({ where: { contactId: id, tenantId } }),
          tx.jobRecurrence.deleteMany({ where: { contactId: id, tenantId } }),
        ])

        await tx.contact.delete({ where: { id } })

        return {
          success: true,
          deleted: {
            quoteLineItems: deletedQuoteLineItems.count,
            quotes: deletedQuotes.count,
            invoiceLineItems: deletedInvoiceLineItems.count,
            payments: deletedPayments.count,
            invoices: deletedInvoices.count,
            jobs: deletedJobs.count,
            jobRecurrences: deletedJobRecurrences.count,
          },
        }
      })
    },
    // CSV Import methods
    importPreview: async (tenantId: string, payload: { csvContent: string }) => {
      console.log('[CSV IMPORT v2.0] importPreview called', {
        tenantId,
        contentLength: payload?.csvContent?.length,
      })
      await ensureTenantExists(tenantId)
      console.log('[CSV IMPORT v2.0] Tenant exists, calling parseCSVPreview')
      const result = parseCSVPreview(payload.csvContent)
      console.log('[CSV IMPORT v2.0] parseCSVPreview result:', {
        headers: result.headers,
        totalRows: result.totalRows,
        suggestedMapping: result.suggestedMapping,
      })
      return result
    },
    importInit: async (
      tenantId: string,
      payload: { fileName: string; csvContent: string; fieldMapping: Record<string, string> }
    ) => {
      await ensureTenantExists(tenantId)
      const session = createImportSession(
        tenantId,
        payload.fileName,
        payload.csvContent,
        payload.fieldMapping
      )
      return { sessionId: session.id }
    },
    importProcess: async (tenantId: string, sessionId: string) => {
      await ensureTenantExists(tenantId)
      const session = getImportSession(sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      return await processImportSession(sessionId)
    },
    importStatus: async (tenantId: string, sessionId: string) => {
      await ensureTenantExists(tenantId)
      const session = getImportSession(sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      return getImportSessionData(sessionId)
    },
    importResolveConflict: async (
      tenantId: string,
      payload: { sessionId: string; conflictId: string; resolution: 'update' | 'skip' }
    ) => {
      await ensureTenantExists(tenantId)
      const session = getImportSession(payload.sessionId)
      if (!session) {
        throw new ApiError('Import session not found', 404)
      }
      if (session.tenantId !== tenantId) {
        throw new ApiError('Unauthorized', 403)
      }
      await resolveConflict(payload.sessionId, payload.conflictId, payload.resolution)
      return getImportSessionData(payload.sessionId)
    },
  },
  quotes: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      const quotes = await prisma.quote.findMany({
        where: { tenantId },
        include: { contact: true, lineItems: true },
        orderBy: { createdAt: 'desc' },
      })
      return quotes.map(serializeQuote)
    },
    getById: async (tenantId: string, id: string) => {
      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })
      if (!quote) throw new Error('Quote not found')
      return serializeQuote(quote)
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const quoteNumber = payload.quoteNumber || (await generateSequentialNumber(tenantId, 'quote'))
      const lineItems = payload.lineItems || []
      const subtotal = lineItems.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unitPrice,
        0
      )
      const taxRate = payload.taxRate || 0
      const taxAmount = subtotal * taxRate
      const discount = payload.discount || 0

      const created = await prisma.quote.create({
        data: {
          tenantId,
          quoteNumber,
          title: payload.title || null,
          contactId: payload.contactId,
          subtotal,
          taxRate,
          taxAmount,
          discount,
          discountReason: payload.discountReason || null,
          total: subtotal + taxAmount - discount,
          status: payload.status || 'draft',
          notes: payload.notes,
          validUntil: payload.validUntil ? new Date(payload.validUntil) : null,
          lineItems: {
            create: lineItems.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
        include: { contact: true, lineItems: true },
      })

      return serializeQuote(created)
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      // Verify quote belongs to tenant before updating
      const existingQuote = await prisma.quote.findFirst({
        where: { id, tenantId },
      })
      if (!existingQuote) {
        throw new ApiError('Quote not found', 404)
      }

      // Destructure to separate lineItems from other fields
      const { lineItems, ...updateData } = payload
      const subtotal = lineItems
        ? lineItems.reduce((sum: number, item: any) => sum + item.quantity * item.unitPrice, 0)
        : undefined
      const taxRate = payload.taxRate
      const discount = payload.discount

      await prisma.$transaction(async tx => {
        if (lineItems) {
          await tx.quoteLineItem.deleteMany({ where: { quoteId: id } })
          await tx.quoteLineItem.createMany({
            data: lineItems.map((item: any) => ({
              quoteId: id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          })
        }

        await tx.quote.update({
          where: { id },
          data: {
            contactId: updateData.contactId,
            title: updateData.title,
            status: updateData.status,
            notes: updateData.notes,
            validUntil: updateData.validUntil ? new Date(updateData.validUntil) : undefined,
            subtotal: subtotal ?? undefined,
            taxRate: taxRate ?? undefined,
            discount: discount ?? undefined,
            discountReason:
              payload.discountReason !== undefined ? payload.discountReason || null : undefined,
            total:
              subtotal !== undefined && taxRate !== undefined && discount !== undefined
                ? subtotal + subtotal * taxRate - discount
                : undefined,
          },
        })
      })

      const updated = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })
      if (!updated) throw new Error('Quote not found')
      return serializeQuote(updated)
    },
    delete: async (tenantId: string, id: string) => {
      // Verify quote belongs to tenant before deleting
      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
      })
      if (!quote) {
        throw new ApiError('Quote not found', 404)
      }
      await prisma.quote.delete({ where: { id } })
      return { success: true }
    },
    send: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      // Load quote with contact and line items
      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!quote) {
        throw new ApiError('Quote not found', 404)
      }

      if (!quote.contact.email) {
        throw new ApiError('Contact does not have an email address', 400)
      }

      // Serialize the quote for email
      const serializedQuote = serializeQuote(quote)

      // Get tenant name (optional, for branding)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })

      // Send the email with PDF
      try {
        await sendQuoteEmail({
          quoteData: serializedQuote,
          tenantName: tenant?.name ?? undefined,
          tenantId,
        })
        console.log(`✅ Quote ${quote.quoteNumber} sent to ${quote.contact.email}`)
      } catch (emailError) {
        console.error('❌ Failed to send quote email:', emailError)
        throw new ApiError(
          `Failed to send quote email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`,
          500
        )
      }

      // Update quote status to 'sent'
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: { status: 'sent' },
        include: { contact: true, lineItems: true },
      })

      return serializeQuote(updatedQuote)
    },
    approve: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!quote) {
        throw new ApiError('Quote not found', 404)
      }

      // Only allow approval if quote is in 'sent' status
      if (quote.status !== 'sent') {
        if (quote.status === 'accepted') {
          throw new ApiError(
            'You have already accepted this quote. The contractor has been notified.',
            400
          )
        } else if (quote.status === 'rejected') {
          throw new ApiError(
            "You have already declined this quote. Please contact the contractor if you've changed your mind.",
            400
          )
        }
        throw new ApiError(
          'This quote can no longer be responded to. Please contact the contractor for assistance.',
          400
        )
      }

      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: { status: 'accepted' },
        include: { contact: true, lineItems: true },
      })

      console.log(`✅ Quote ${quote.quoteNumber} approved by client`)

      return {
        ...serializeQuote(updatedQuote),
        tenantId,
      }
    },
    decline: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      const quote = await prisma.quote.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!quote) {
        throw new ApiError('Quote not found', 404)
      }

      // Only allow declining if quote is in 'sent' status
      if (quote.status !== 'sent') {
        if (quote.status === 'accepted') {
          throw new ApiError(
            'You have already accepted this quote. Please contact the contractor if you need to cancel.',
            400
          )
        } else if (quote.status === 'rejected') {
          throw new ApiError(
            'You have already declined this quote. The contractor has been notified.',
            400
          )
        }
        throw new ApiError(
          'This quote can no longer be responded to. Please contact the contractor for assistance.',
          400
        )
      }

      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: { status: 'rejected' },
        include: { contact: true, lineItems: true },
      })

      console.log(`✅ Quote ${quote.quoteNumber} declined by client`)

      return {
        ...serializeQuote(updatedQuote),
        tenantId,
      }
    },
  },
  invoices: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)

      // Update overdue invoices automatically
      // An invoice is overdue if:
      // 1. It has a due date
      // 2. The due date is more than 1 day in the past (not just today)
      // 3. Payment status is not 'paid'
      // 4. Current status is 'sent' (not already overdue, cancelled, or draft)
      const oneDayAgo = new Date()
      oneDayAgo.setDate(oneDayAgo.getDate() - 1)
      oneDayAgo.setHours(23, 59, 59, 999) // End of yesterday

      await prisma.invoice.updateMany({
        where: {
          tenantId,
          status: 'sent',
          paymentStatus: { not: 'paid' },
          dueDate: {
            lt: oneDayAgo,
          },
        },
        data: {
          status: 'overdue',
        },
      })

      const invoices = await prisma.invoice.findMany({
        where: { tenantId },
        include: { contact: true, lineItems: true },
        orderBy: { createdAt: 'desc' },
      })
      return invoices.map(serializeInvoice)
    },
    getById: async (tenantId: string, id: string) => {
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })
      if (!invoice) throw new Error('Invoice not found')

      // Check if this invoice should be marked as overdue
      if (invoice.status === 'sent' && invoice.paymentStatus !== 'paid' && invoice.dueDate) {
        const oneDayAgo = new Date()
        oneDayAgo.setDate(oneDayAgo.getDate() - 1)
        oneDayAgo.setHours(23, 59, 59, 999)

        if (invoice.dueDate < oneDayAgo) {
          // Update to overdue
          await prisma.invoice.update({
            where: { id },
            data: { status: 'overdue' },
          })
          invoice.status = 'overdue'
        }
      }

      return serializeInvoice(invoice)
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const invoiceNumber =
        payload.invoiceNumber || (await generateSequentialNumber(tenantId, 'invoice'))
      const lineItems = payload.lineItems || []
      const subtotal = lineItems.reduce(
        (sum: number, item: any) => sum + item.quantity * item.unitPrice,
        0
      )
      const taxRate = payload.taxRate || 0
      const taxAmount = subtotal * taxRate
      const discount = payload.discount || 0
      const total = subtotal + taxAmount - discount
      const paymentStatus = payload.paymentStatus || 'pending'
      const paidAmount =
        paymentStatus === 'paid' ? total : paymentStatus === 'partial' ? payload.paidAmount || 0 : 0

      const created = await prisma.invoice.create({
        data: {
          tenantId,
          invoiceNumber,
          title: payload.title || null,
          contactId: payload.contactId,
          subtotal,
          taxRate,
          taxAmount,
          discount,
          discountReason: payload.discountReason || null,
          total,
          status: payload.status || 'draft',
          paymentStatus,
          notes: payload.notes,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          paymentTerms: payload.paymentTerms || 'Net 30',
          paidAmount,
          trackResponse: payload.trackResponse !== undefined ? payload.trackResponse : true,
          trackPayment: payload.trackPayment !== undefined ? payload.trackPayment : true,
          lineItems: {
            create: lineItems.map((item: any) => ({
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          },
        },
        include: { contact: true, lineItems: true },
      })

      return serializeInvoice(created)
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      // Verify invoice belongs to tenant before updating
      const existingInvoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      })
      if (!existingInvoice) {
        throw new ApiError('Invoice not found', 404)
      }

      const { lineItems, ...restPayload } = payload

      // Calculate totals from line items if provided
      const itemsToCalculate = lineItems || []
      const subtotal = itemsToCalculate.reduce(
        (sum: number, item: any) => sum + (item.quantity || 0) * (item.unitPrice || 0),
        0
      )
      const taxRate = payload.taxRate !== undefined ? payload.taxRate : existingInvoice.taxRate
      const taxAmount = subtotal * Number(taxRate)
      const discount = payload.discount !== undefined ? payload.discount : existingInvoice.discount
      const total = subtotal + taxAmount - Number(discount)

      // Calculate paidAmount based on paymentStatus
      const paymentStatus = payload.paymentStatus || existingInvoice.paymentStatus
      const paidAmount =
        paymentStatus === 'paid'
          ? total
          : paymentStatus === 'partial'
            ? payload.paidAmount !== undefined
              ? payload.paidAmount
              : existingInvoice.paidAmount
            : 0

      await prisma.$transaction(async tx => {
        if (lineItems) {
          await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } })
          await tx.invoiceLineItem.createMany({
            data: lineItems.map((item: any) => ({
              invoiceId: id,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              total: item.quantity * item.unitPrice,
            })),
          })
        }

        await tx.invoice.update({
          where: { id },
          data: {
            title: payload.title !== undefined ? payload.title || null : undefined,
            contactId: payload.contactId,
            subtotal,
            taxRate,
            taxAmount,
            discount,
            discountReason:
              payload.discountReason !== undefined ? payload.discountReason || null : undefined,
            total,
            status: payload.status,
            paymentStatus,
            approvalStatus:
              payload.approvalStatus !== undefined ? payload.approvalStatus : undefined,
            notes: payload.notes !== undefined ? payload.notes || null : undefined,
            dueDate:
              payload.dueDate !== undefined
                ? payload.dueDate
                  ? new Date(payload.dueDate)
                  : null
                : undefined,
            paymentTerms:
              payload.paymentTerms !== undefined ? payload.paymentTerms || null : undefined,
            paidAmount,
            trackResponse:
              payload.trackResponse !== undefined ? payload.trackResponse : undefined,
            trackPayment:
              payload.trackPayment !== undefined ? payload.trackPayment : undefined,
          } as any,
        })
      })

      const updated = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })
      if (!updated) throw new Error('Invoice not found')
      return serializeInvoice(updated)
    },
    delete: async (tenantId: string, id: string) => {
      // Verify invoice belongs to tenant before deleting
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
      })
      if (!invoice) {
        throw new ApiError('Invoice not found', 404)
      }
      await prisma.invoice.delete({ where: { id } })
      return { success: true }
    },
    send: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)

      // Load invoice with contact and line items
      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!invoice) {
        throw new ApiError('Invoice not found', 404)
      }

      if (!invoice.contact.email) {
        throw new ApiError('Contact does not have an email address', 400)
      }

      // Serialize the invoice for email
      const serializedInvoice = serializeInvoice(invoice)

      // Get tenant name (optional, for branding)
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      })

      // Send the email with PDF
      try {
        await sendInvoiceEmail({
          invoiceData: serializedInvoice,
          tenantName: tenant?.name ?? undefined,
          tenantId,
        })
        console.log(`✅ Invoice ${invoice.invoiceNumber} sent to ${invoice.contact.email}`)
      } catch (emailError) {
        console.error('❌ Failed to send invoice email:', emailError)
        throw new ApiError(
          `Failed to send invoice email: ${emailError instanceof Error ? emailError.message : 'Unknown error'}`,
          500
        )
      }

      // Update invoice status to 'sent'
      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: { status: 'sent' },
        include: { contact: true, lineItems: true },
      })

      return serializeInvoice(updatedInvoice)
    },
    setApprovalStatus: async (
      tenantId: string,
      id: string,
      approvalStatus: 'accepted' | 'declined'
    ) => {
      await ensureTenantExists(tenantId)

      const invoice = await prisma.invoice.findFirst({
        where: { id, tenantId },
        include: { contact: true, lineItems: true },
      })

      if (!invoice) {
        throw new ApiError('Invoice not found', 404)
      }

      // Check if invoice has already been responded to
      const currentStatus = (invoice as any).approvalStatus
      if (currentStatus && currentStatus !== 'none') {
        if (currentStatus === approvalStatus) {
          const action = approvalStatus === 'accepted' ? 'approved' : 'reported an issue with'
          throw new ApiError(
            `You have already ${action} this invoice. The contractor has been notified.`,
            400
          )
        } else {
          const previousAction =
            currentStatus === 'accepted' ? 'approved' : 'reported an issue with'
          throw new ApiError(
            `You have already ${previousAction} this invoice. Please contact the contractor if you need to make changes.`,
            400
          )
        }
      }

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: {
          approvalStatus: approvalStatus,
          approvalAt: new Date(),
        } as any,
        include: { contact: true, lineItems: true },
      })

      console.log(`✅ Invoice ${invoice.invoiceNumber} ${approvalStatus} by client`)

      return {
        ...serializeInvoice(updatedInvoice),
        tenantId,
      }
    },
    getUnconvertedAcceptedQuotes: async (tenantId: string) => {
      await ensureTenantExists(tenantId)

      // Get all accepted quotes
      const acceptedQuotes = await prisma.quote.findMany({
        where: {
          tenantId,
          status: 'accepted',
        },
        include: {
          contact: true,
          lineItems: true,
        },
        orderBy: { createdAt: 'desc' },
      })

      // Get all invoices to check which quotes have been converted
      const invoices = await prisma.invoice.findMany({
        where: { tenantId },
        select: { notes: true },
      })

      // Create a set of quote numbers that have been converted
      const convertedQuoteNumbers = new Set<string>()
      for (const invoice of invoices) {
        if (invoice.notes && typeof invoice.notes === 'string') {
          // Check if notes contain "Converted from {quoteNumber}"
          // Handle both single line and multi-line notes
          const match = invoice.notes.match(/Converted from ([A-Z0-9-]+)/i)
          if (match && match[1]) {
            convertedQuoteNumbers.add(match[1])
          }
        }
      }

      // Filter out quotes that have been converted
      const unconvertedQuotes = acceptedQuotes.filter(
        quote => !convertedQuoteNumbers.has(quote.quoteNumber)
      )

      // Serialize quotes - contact can be null/undefined, serializeQuote handles it
      return unconvertedQuotes.map(serializeQuote)
    },
  },
  jobs: {
    getAll: async (
      tenantId: string,
      startDate?: Date,
      endDate?: Date,
      includeArchived?: boolean,
      showDeleted?: boolean,
      currentUserId?: string,
      currentUserRole?: string,
      canSeeOtherJobs?: boolean
    ) => {
      await ensureTenantExists(tenantId)
      
      // Build the where clause
      const whereClause: Prisma.JobWhereInput = {
        tenantId,
        // Filter archived jobs based on includeArchived flag
        // Note: showDeleted parameter is deprecated, we only use archive now
        ...(includeArchived ? {} : { archivedAt: null }),
      }
      
      // Note: If user cannot see other jobs, we'll filter in memory after fetching
      // This allows us to check both createdById and assignedTo (which requires JSONB filtering)
      // For performance, we could use a raw SQL query, but filtering in memory is simpler and works correctly
      
      // When date filters are provided, return scheduled jobs in range OR unscheduled jobs
      if (startDate || endDate) {
        const dateFilter = {
          OR: [
            {
              startTime: {
                gte: startDate,
                lte: endDate,
              },
            },
            {
              toBeScheduled: true,
            },
          ],
        }
        
        // If we already have an OR clause (from canSeeOtherJobs filtering), combine them
        if (whereClause.OR) {
          whereClause.AND = [
            { OR: whereClause.OR },
            dateFilter,
          ]
          delete whereClause.OR
        } else {
          whereClause.OR = dateFilter.OR
        }
      }
      
      const jobs = await prisma.job.findMany({
        where: whereClause,
        include: {
          contact: true,
          service: true,
          createdBy: { select: { name: true } },
        },
        orderBy: [
          { toBeScheduled: 'desc' }, // Unscheduled jobs first
          { startTime: 'asc' },
        ],
      })
      
      // Filter out jobs user cannot see (if canSeeOtherJobs is false, also filter by assignedTo)
      let filteredJobs = jobs
      if (currentUserId && canSeeOtherJobs !== true) {
        filteredJobs = jobs.filter(job => {
          // User can see if they created it (already filtered by query)
          if (job.createdById === currentUserId) return true
          
          // User can also see if they're assigned to it
          const userIds = extractUserIds(job.assignedTo)
          return userIds.includes(currentUserId)
        })
      }
      
      // Map assignedToName and apply privacy filtering for all jobs
      const jobsWithNames = await Promise.all(
        filteredJobs.map(async (job) => {
          const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
          const assignedToWithPrivacy = getAssignedToWithPrivacy(
            job.assignedTo,
            currentUserId,
            currentUserRole
          )
          return { 
            ...job, 
            assignedToName,
            assignedTo: assignedToWithPrivacy || job.assignedTo
          }
        })
      )
      
      return jobsWithNames
    },
    getById: async (
      tenantId: string, 
      id: string,
      currentUserId?: string,
      currentUserRole?: string,
      canSeeOtherJobs?: boolean
    ) => {
      const job = await prisma.job.findFirst({
        where: {
          id,
          tenantId,
        },
        include: {
          contact: true,
          service: true,
          createdBy: { select: { name: true } },
        },
      })
      if (!job) throw new Error('Job not found')
      
      // Check if user can see this job (if canSeeOtherJobs is false, they can only see jobs they created or are assigned to)
      if (currentUserId && canSeeOtherJobs !== true) {
        const canSee = job.createdById === currentUserId || extractUserIds(job.assignedTo).includes(currentUserId)
        if (!canSee) {
          throw new Error('Job not found')
        }
      }
      
      const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
      const assignedToWithPrivacy = getAssignedToWithPrivacy(
        job.assignedTo,
        currentUserId,
        currentUserRole
      )
      return { 
        ...job, 
        assignedToName,
        assignedTo: assignedToWithPrivacy || job.assignedTo
      }
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)

      const toBeScheduled = payload.toBeScheduled === true

      await validateAssignedTo(tenantId, payload.assignedTo)

      // Validate: recurrence requires scheduled times
      if (payload.recurrence && toBeScheduled) {
        throw new ApiError('Recurring jobs must have scheduled times', 400)
      }

      // Normalize assignedTo to array format
      const normalizedAssignedTo = normalizeAssignedTo(payload.assignedTo)

      // If toBeScheduled, create without times and skip conflict checks
      if (toBeScheduled) {
        const job = await prisma.job.create({
          data: {
            tenantId,
            title: payload.title,
            description: payload.description,
            contactId: payload.contactId,
            serviceId: payload.serviceId,
            quoteId: payload.quoteId,
            invoiceId: payload.invoiceId,
            startTime: null,
            endTime: null,
            toBeScheduled: true,
            status: payload.status || 'scheduled',
            location: payload.location,
            price: payload.price !== undefined ? payload.price : null,
            notes: payload.notes,
            assignedTo: normalizedAssignedTo,
            breaks: undefined,
            createdById: payload.createdById ?? undefined,
          },
          include: { contact: true, service: true, createdBy: { select: { name: true } } },
        })
        if (normalizedAssignedTo && normalizedAssignedTo.length > 0) {
          sendAssignmentNotification({
            tenantId,
            assignedTo: normalizedAssignedTo,
            assignerUserId: payload.createdById,
            jobTitle: job.title,
            startTime: null,
            endTime: null,
            location: job.location,
            contactName: job.contact ? `${job.contact.firstName ?? ''} ${job.contact.lastName ?? ''}`.trim() || undefined : undefined,
          }).catch((e) => console.error('Failed to send assignment notification:', e))
        }
        const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
        return { ...job, assignedToName }
      }

      // Otherwise, require times
      if (!payload.startTime || !payload.endTime) {
        throw new ApiError('startTime and endTime are required for scheduled jobs', 400)
      }

      const startTime = parseValidDate(payload.startTime)
      const endTime = parseValidDate(payload.endTime)

      if (!startTime || !endTime) {
        throw new ApiError(
          'Invalid startTime or endTime format. Please provide valid date strings.',
          400
        )
      }

      const forceBooking = payload.forceBooking === true

      // If recurrence is provided, use the recurring jobs logic
      if (payload.recurrence) {
        const recurringResult = await createRecurringJobs({
          tenantId,
          title: payload.title,
          description: payload.description,
          contactId: payload.contactId,
          serviceId: payload.serviceId,
          quoteId: payload.quoteId,
          invoiceId: payload.invoiceId,
          startTime,
          endTime,
          status: payload.status || 'scheduled',
          location: payload.location,
          price: payload.price,
          notes: payload.notes,
          assignedTo: normalizedAssignedTo,
          breaks: payload.breaks,
          recurrence: payload.recurrence,
          forceBooking,
          createdById: payload.createdById ?? undefined,
        })
        if (recurringResult.assignedTo) {
          sendAssignmentNotification({
            tenantId,
            assignedTo: recurringResult.assignedTo,
            assignerUserId: payload.createdById,
            jobTitle: recurringResult.title,
            startTime: recurringResult.startTime,
            endTime: recurringResult.endTime,
            location: recurringResult.location,
            contactName: recurringResult.contact ? `${recurringResult.contact.firstName ?? ''} ${recurringResult.contact.lastName ?? ''}`.trim() || undefined : undefined,
          }).catch((e) => console.error('Failed to send assignment notification:', e))
        }
        return recurringResult
      }

      // Double booking check removed - allowing overlapping jobs

      const job = await prisma.job.create({
        data: {
          tenantId,
          title: payload.title,
          description: payload.description,
          contactId: payload.contactId,
          serviceId: payload.serviceId,
          quoteId: payload.quoteId,
          invoiceId: payload.invoiceId,
          startTime,
          endTime,
          toBeScheduled: false,
          status: payload.status || 'scheduled',
          location: payload.location,
          price: payload.price !== undefined ? payload.price : null,
          notes: payload.notes,
          assignedTo: normalizedAssignedTo,
          breaks: payload.breaks || null,
          createdById: payload.createdById ?? undefined,
        },
        include: { contact: true, service: true, createdBy: { select: { name: true } } },
      })
      const assignedToName = await getAssignedToName(tenantId, job.assignedTo)
      if (job.assignedTo) {
        sendAssignmentNotification({
          tenantId,
          assignedTo: job.assignedTo,
          assignerUserId: payload.createdById,
          jobTitle: job.title,
          startTime: job.startTime,
          endTime: job.endTime,
          location: job.location,
          contactName: job.contact ? `${job.contact.firstName ?? ''} ${job.contact.lastName ?? ''}`.trim() || undefined : undefined,
        }).catch((e) => console.error('Failed to send assignment notification:', e))
      }
      return job
    },
    update: async (tenantId: string, id: string, payload: any) => {
      console.log('🔄 Job update called:', {
        id,
        updateAll: payload.updateAll,
        hasRecurrenceId: !!payload.recurrenceId,
        hasRecurrenceInPayload: !!payload.recurrence,
        recurrencePayload: payload.recurrence,
      })

      // Verify job belongs to tenant before updating
      const existingJob = await prisma.job.findFirst({
        where: { id, tenantId },
        include: { contact: true, service: true },
      })
      if (!existingJob) {
        throw new ApiError('Job not found', 404)
      }

      console.log('📋 Existing job:', {
        id: existingJob.id,
        recurrenceId: existingJob.recurrenceId,
        title: existingJob.title,
      })

      // Extract only the fields that can be directly updated
      const updateData: any = {}
      if (payload.title !== undefined) updateData.title = payload.title
      if (payload.description !== undefined) updateData.description = payload.description
      if (payload.contactId !== undefined) updateData.contactId = payload.contactId
      if (payload.serviceId !== undefined) updateData.serviceId = payload.serviceId
      if (payload.quoteId !== undefined) updateData.quoteId = payload.quoteId
      if (payload.invoiceId !== undefined) updateData.invoiceId = payload.invoiceId
      if (payload.status !== undefined) updateData.status = payload.status
      if (payload.location !== undefined) updateData.location = payload.location
      // Handle price explicitly - allow 0, null, or undefined
      if (payload.price !== undefined) {
        updateData.price = payload.price !== null && payload.price !== '' ? payload.price : null
      }
      if (payload.notes !== undefined) updateData.notes = payload.notes
      if (payload.assignedTo !== undefined) updateData.assignedTo = normalizeAssignedTo(payload.assignedTo)
      if (payload.breaks !== undefined) updateData.breaks = payload.breaks

      const actingUserId = payload._actingUserId

      await validateAssignedTo(tenantId, updateData.assignedTo ?? payload.assignedTo)

      // Validate and parse dates if provided
      if (payload.startTime !== undefined) {
        const parsedStartTime = parseValidDate(payload.startTime)
        if (!parsedStartTime) {
          throw new ApiError('Invalid startTime format. Please provide a valid date string.', 400)
        }
        updateData.startTime = parsedStartTime
      }
      if (payload.endTime !== undefined) {
        const parsedEndTime = parseValidDate(payload.endTime)
        if (!parsedEndTime) {
          throw new ApiError('Invalid endTime format. Please provide a valid date string.', 400)
        }
        updateData.endTime = parsedEndTime
      }

      // Handle toBeScheduled flag changes
      if (payload.toBeScheduled !== undefined) {
        updateData.toBeScheduled = payload.toBeScheduled

        if (payload.toBeScheduled === true) {
          // Setting to unscheduled - clear times
          updateData.startTime = null
          updateData.endTime = null
        } else if (payload.toBeScheduled === false) {
          // Setting to scheduled - require times
          if (!payload.startTime || !payload.endTime) {
            if (!existingJob.startTime || !existingJob.endTime) {
              throw new ApiError('startTime and endTime are required when scheduling a job', 400)
            }
          }
          // Validate that the dates that will be used are valid
          const finalStartTime = updateData.startTime || existingJob.startTime
          const finalEndTime = updateData.endTime || existingJob.endTime
          if (
            !finalStartTime ||
            !finalEndTime ||
            isNaN(new Date(finalStartTime).getTime()) ||
            isNaN(new Date(finalEndTime).getTime())
          ) {
            throw new ApiError(
              'Valid startTime and endTime are required when scheduling a job',
              400
            )
          }
        }
      }

      // Check if adding recurrence to a non-recurring job
      if (payload.recurrence && !existingJob.recurrenceId) {
        console.log('➕ Adding recurrence to existing job:', { id, recurrence: payload.recurrence })

        // Get the final start and end times for the job
        const finalStartTime = updateData.startTime || existingJob.startTime
        const finalEndTime = updateData.endTime || existingJob.endTime

        if (!finalStartTime || !finalEndTime) {
          throw new ApiError('Job must have start and end times to add recurrence', 400)
        }

        // Create the recurring series starting from this job
        const recurringJobsResult = await createRecurringJobs({
          tenantId,
          title: updateData.title || existingJob.title,
          description:
            updateData.description !== undefined
              ? updateData.description
              : existingJob.description || undefined,
          contactId: updateData.contactId || existingJob.contactId,
          serviceId:
            updateData.serviceId !== undefined
              ? updateData.serviceId
              : existingJob.serviceId || undefined,
          quoteId:
            updateData.quoteId !== undefined
              ? updateData.quoteId
              : existingJob.quoteId || undefined,
          invoiceId:
            updateData.invoiceId !== undefined
              ? updateData.invoiceId
              : existingJob.invoiceId || undefined,
          startTime: new Date(finalStartTime),
          endTime: new Date(finalEndTime),
          status: updateData.status || existingJob.status,
          location:
            updateData.location !== undefined
              ? updateData.location
              : existingJob.location || undefined,
          price:
            updateData.price !== undefined
              ? updateData.price
              : existingJob.price
                ? parseFloat(existingJob.price.toString())
                : undefined,
          notes: updateData.notes !== undefined ? updateData.notes : existingJob.notes || undefined,
          assignedTo:
            updateData.assignedTo !== undefined
              ? updateData.assignedTo
              : existingJob.assignedTo || undefined,
          breaks:
            updateData.breaks !== undefined
              ? updateData.breaks
              : (existingJob.breaks as any) || undefined,
          recurrence: payload.recurrence,
          excludeJobId: existingJob.id, // Exclude the original job from conflict checking
          createdById: (existingJob as any).createdById ?? payload.createdById,
        })

        // Delete the original job since we've created a recurring series
        await prisma.job.delete({
          where: { id },
        })

        console.log('✅ Converted job to recurring series')

        if (recurringJobsResult.assignedTo) {
          sendAssignmentNotification({
            tenantId,
            assignedTo: recurringJobsResult.assignedTo,
            assignerUserId: actingUserId,
            jobTitle: recurringJobsResult.title,
            startTime: recurringJobsResult.startTime,
            endTime: recurringJobsResult.endTime,
            location: recurringJobsResult.location,
            contactName: recurringJobsResult.contact ? `${recurringJobsResult.contact.firstName ?? ''} ${recurringJobsResult.contact.lastName ?? ''}`.trim() || undefined : undefined,
          }).catch((e) => console.error('Failed to send assignment notification:', e))
        }

        // Return the first job in the series
        return recurringJobsResult
      }

      // If updateAll is true and this job is part of a recurrence, update all future jobs
      if (payload.updateAll && existingJob.recurrenceId) {
        console.log('🔁 Updating all future jobs in recurrence:', existingJob.recurrenceId)
        // Calculate time delta if times are being changed
        let timeDelta = 0
        if (payload.startTime !== undefined && existingJob.startTime) {
          const oldStartTime = new Date(existingJob.startTime)
          const newStartTime = new Date(payload.startTime)
          timeDelta = newStartTime.getTime() - oldStartTime.getTime()
        }

        // Get all future jobs in the series (including this one)
        const futureJobs = await prisma.job.findMany({
          where: {
            recurrenceId: existingJob.recurrenceId,
            tenantId,
            ...(existingJob.startTime
              ? {
                  startTime: {
                    gte: existingJob.startTime,
                  },
                }
              : {}),
          },
        })

        console.log(`📅 Found ${futureJobs.length} future jobs to update`)

        // Update each job
        const updatePromises = futureJobs.map(async job => {
          const jobUpdateData: any = { ...updateData }

          // If times are being changed, apply the time delta to all jobs
          if (timeDelta !== 0 && job.startTime && job.endTime) {
            const originalStart = new Date(job.startTime)
            const originalEnd = new Date(job.endTime)
            jobUpdateData.startTime = new Date(originalStart.getTime() + timeDelta)
            jobUpdateData.endTime = new Date(originalEnd.getTime() + timeDelta)
          }

          return prisma.job.update({
            where: { id: job.id },
            data: jobUpdateData,
          })
        })

        await Promise.all(updatePromises)

        console.log('✅ All future jobs updated successfully')

        const updatedJob = await prisma.job.findFirst({
          where: { id },
          include: { contact: true, service: true },
        })
        const assignedToName = await getAssignedToName(tenantId, updatedJob.assignedTo)
        const newAssignedTo = updateData.assignedTo !== undefined ? updateData.assignedTo : existingJob.assignedTo
        if (newAssignedTo && JSON.stringify(newAssignedTo) !== JSON.stringify(existingJob.assignedTo) && updatedJob) {
          sendAssignmentNotification({
            tenantId,
            assignedTo: newAssignedTo,
            assignerUserId: actingUserId,
            jobTitle: updatedJob.title,
            startTime: updatedJob.startTime,
            endTime: updatedJob.endTime,
            location: updatedJob.location,
            contactName: updatedJob.contact ? `${updatedJob.contact.firstName ?? ''} ${updatedJob.contact.lastName ?? ''}`.trim() || undefined : undefined,
          }).catch((e) => console.error('Failed to send assignment notification:', e))
        }
        return { ...updatedJob, assignedToName }
      }

      console.log('📝 Updating single job only')

      const updatedJob = await prisma.job.update({
        where: { id },
        data: updateData,
        include: { contact: true, service: true },
      })
      const assignedToName = await getAssignedToName(tenantId, updatedJob.assignedTo)
      const newAssignedTo = updateData.assignedTo !== undefined ? updateData.assignedTo : existingJob.assignedTo
      if (newAssignedTo && JSON.stringify(newAssignedTo) !== JSON.stringify(existingJob.assignedTo)) {
        sendAssignmentNotification({
          tenantId,
          assignedTo: newAssignedTo,
          assignerUserId: actingUserId,
          jobTitle: updatedJob.title,
          startTime: updatedJob.startTime,
          endTime: updatedJob.endTime,
          location: updatedJob.location,
          contactName: updatedJob.contact ? `${updatedJob.contact.firstName ?? ''} ${updatedJob.contact.lastName ?? ''}`.trim() || undefined : undefined,
        }).catch((e) => console.error('Failed to send assignment notification:', e))
      }
      return { ...updatedJob, assignedToName }
    },
    delete: async (tenantId: string, id: string, deleteAll?: boolean) => {
      // Soft delete - archives the job
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
      })
      if (!job) {
        throw new ApiError('Job not found', 404)
      }

      const now = new Date()

      if (deleteAll && job.recurrenceId) {
        // Archive all jobs with the same recurrenceId
        await prisma.job.updateMany({
          where: {
            recurrenceId: job.recurrenceId,
            tenantId,
          },
          data: {
            archivedAt: now,
          },
        })
      } else {
        // Archive only this job
        await prisma.job.update({
          where: { id },
          data: {
            archivedAt: now,
          },
        })
      }

      return { success: true }
    },
    permanentDelete: async (tenantId: string, id: string, deleteAll?: boolean) => {
      // Permanent delete - removes from database and S3 archive (if exists)
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
      })
      if (!job) {
        throw new ApiError('Job not found', 404)
      }

      // If job was archived, delete from S3
      if (job.archivedAt) {
        try {
          const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
          const s3 = new S3Client({})
          const archiveKey = `archives/jobs/${tenantId}/${id}.json`

          await s3.send(
            new DeleteObjectCommand({
              Bucket: process.env.FILES_BUCKET!,
              Key: archiveKey,
            })
          )

          console.log(`Deleted archived job from S3: ${archiveKey}`)
        } catch (s3Error) {
          console.error('Failed to delete job from S3:', s3Error)
          // Continue with DB deletion even if S3 deletion fails
        }
      }

      if (deleteAll && job.recurrenceId) {
        // Get all job IDs for S3 cleanup
        const recurringJobs = await prisma.job.findMany({
          where: {
            recurrenceId: job.recurrenceId,
            tenantId,
          },
          select: { id: true, archivedAt: true },
        })

        // Delete archived jobs from S3
        for (const recurringJob of recurringJobs) {
          if (recurringJob.archivedAt) {
            try {
              const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
              const s3 = new S3Client({})
              const archiveKey = `archives/jobs/${tenantId}/${recurringJob.id}.json`

              await s3.send(
                new DeleteObjectCommand({
                  Bucket: process.env.FILES_BUCKET!,
                  Key: archiveKey,
                })
              )
            } catch (s3Error) {
              console.error(`Failed to delete job ${recurringJob.id} from S3:`, s3Error)
            }
          }
        }

        // Hard delete all jobs with the same recurrenceId
        await prisma.job.deleteMany({
          where: {
            recurrenceId: job.recurrenceId,
            tenantId,
          },
        })
      } else {
        // Hard delete only this job
        await prisma.job.delete({ where: { id } })
      }

      return { success: true, permanent: true }
    },
    restore: async (tenantId: string, id: string) => {
      // Restore an archived job
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
      })
      if (!job) {
        throw new ApiError('Job not found', 404)
      }
      if (!job.archivedAt) {
        throw new ApiError('Job is not archived', 400)
      }

      return prisma.job.update({
        where: { id },
        data: {
          archivedAt: null,
        },
        include: { contact: true, service: true },
      })
    },
    confirm: async (tenantId: string, id: string) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: { contact: true, service: true },
      })

      if (!job) throw new Error('Job not found')
      if (job.status !== 'pending-confirmation') {
        throw new Error('Only pending jobs can be confirmed')
      }

      const updatedJob = await prisma.job.update({
        where: { id },
        data: { status: 'scheduled' },
        include: { contact: true, service: true },
      })

      // Send confirmation email to client
      try {
        if (job.contact.email) {
          console.log(`📧 Sending confirmation email to ${job.contact.email}`)

          // Get tenant settings for company name and reply-to email
          const settings = await prisma.tenantSettings.findUnique({
            where: { tenantId },
          })

          // Get timezone offset from service availability settings
          const serviceAvailability = (job.service?.availability as any) || {}
          const timezoneOffset = serviceAvailability?.timezoneOffset ?? -8

          // Fetch logo URL if available (7 days expiration for email)
          let logoUrl: string | null = null
          if (settings?.logoUrl) {
            try {
              const { getFileUrl } = await import('./fileUpload')
              logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
            } catch (error) {
              console.error('Error fetching logo URL for email:', error)
            }
          }

          const companyName = settings?.companyDisplayName || 'JobDock'

          const emailPayload = buildClientBookingConfirmedEmail({
            clientName: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
            serviceName: job.service?.name || 'Service',
            startTime: job.startTime ? new Date(job.startTime) : new Date(),
            endTime: job.endTime ? new Date(job.endTime) : new Date(),
            location: job.location || undefined,
            timezoneOffset,
            companyName,
            logoUrl,
            settings: {
              companySupportEmail: settings?.companySupportEmail || null,
              companyPhone: settings?.companyPhone || null,
            },
          })

          await sendEmail({
            ...emailPayload,
            to: job.contact.email,
            fromName: companyName,
            replyTo: settings?.companySupportEmail || undefined,
          })
          console.log('✅ Confirmation email sent successfully')
        }
      } catch (emailError) {
        console.error('❌ Failed to send confirmation email:', emailError)
      }

      return updatedJob
    },
    decline: async (tenantId: string, id: string, reason?: string) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: { contact: true, service: true },
      })

      if (!job) throw new Error('Job not found')
      if (job.status !== 'pending-confirmation') {
        throw new Error('Only pending jobs can be declined')
      }

      const updatedJob = await prisma.job.update({
        where: { id },
        data: {
          status: 'cancelled',
          notes: reason ? `${job.notes ? job.notes + '\n' : ''}Declined: ${reason}` : job.notes,
        },
        include: { contact: true, service: true },
      })

      // Send declined email to client
      try {
        if (job.contact.email) {
          console.log(`📧 Sending decline email to ${job.contact.email}`)

          // Get tenant settings for company name and reply-to email
          const settings = await prisma.tenantSettings.findUnique({
            where: { tenantId },
          })

          // Fetch logo URL if available (7 days expiration for email)
          let logoUrl: string | null = null
          if (settings?.logoUrl) {
            try {
              const { getFileUrl } = await import('./fileUpload')
              logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
            } catch (error) {
              console.error('Error fetching logo URL for email:', error)
            }
          }

          const companyName = settings?.companyDisplayName || 'JobDock'

          const emailPayload = buildClientBookingDeclinedEmail({
            clientName: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
            serviceName: job.service?.name || 'Service',
            startTime: job.startTime ? new Date(job.startTime) : new Date(),
            reason,
            companyName,
            logoUrl,
            settings: {
              companySupportEmail: settings?.companySupportEmail || null,
              companyPhone: settings?.companyPhone || null,
            },
          })

          await sendEmail({
            ...emailPayload,
            to: job.contact.email,
            fromName: companyName,
            replyTo: settings?.companySupportEmail || undefined,
          })
          console.log('✅ Decline email sent successfully')
        }
      } catch (emailError) {
        console.error('❌ Failed to send decline email:', emailError)
      }

      return updatedJob
    },
  },
  services: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      return prisma.service.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
      })
    },
    // Get all active services for a tenant (for public booking)
    getAllActiveForTenant: async (tenantId: string) => {
      return prisma.service.findMany({
        where: {
          tenantId,
          isActive: true,
        },
        orderBy: { name: 'asc' },
      })
    },
    getById: async (tenantId: string, id: string) => {
      // For public booking, look up service by ID only (ignore tenantId parameter)
      // The service ID is globally unique
      const service = await prisma.service.findUnique({
        where: { id },
      })
      if (!service) throw new Error('Service not found')
      return service
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      return prisma.service.create({
        data: {
          tenantId,
          name: payload.name,
          description: payload.description,
          duration: payload.duration,
          price: payload.price,
          isActive: payload.isActive ?? true,
          availability: payload.availability,
          bookingSettings: payload.bookingSettings,
        },
      })
    },
    update: async (tenantId: string, id: string, payload: any) => {
      // Verify service belongs to tenant before updating
      const existingService = await prisma.service.findFirst({
        where: { id, tenantId },
      })
      if (!existingService) {
        throw new ApiError('Service not found', 404)
      }
      return prisma.service.update({
        where: { id },
        data: payload,
      })
    },
    delete: async (tenantId: string, id: string) => {
      // Verify service belongs to tenant before deleting
      const service = await prisma.service.findFirst({
        where: { id, tenantId },
      })
      if (!service) {
        throw new ApiError('Service not found', 404)
      }
      await prisma.service.delete({ where: { id } })
      return { success: true }
    },
    getBookingLink: async (tenantId: string, id: string) => {
      const service = await prisma.service.findFirst({
        where: { id, tenantId },
      })
      if (!service) {
        throw new ApiError('Service not found', 404)
      }
      const baseUrl = process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
      return {
        serviceId: id,
        serviceName: service.name,
        publicLink: `${baseUrl}/book/${id}`,
        embedCode: `<iframe src="${baseUrl}/book/${id}" width="100%" height="600" frameborder="0"></iframe>`,
      }
    },
    getAvailability: async (tenantId: string, id: string, startDate?: Date, endDate?: Date) => {
      // For public booking, look up service by ID only (ignore tenantId parameter)
      // The service ID is globally unique and determines the tenant
      const service = await prisma.service.findUnique({
        where: { id },
      })
      if (!service) throw new Error('Service not found')
      if (!service.isActive) throw new Error('Service is not active')

      // Use the service's actual tenantId for all subsequent operations
      const actualTenantId = service.tenantId

      const availability = service.availability as any
      if (!availability || !availability.workingHours) {
        throw new Error('Service has no availability configured')
      }

      // Get timezone offset from availability settings (in hours, e.g., -8 for PST, -5 for EST)
      // Default to -8 (Pacific Time) if not specified
      // TODO: Make this configurable per service in the UI
      const timezoneOffset = availability.timezoneOffset ?? -8

      const now = new Date()
      const advanceBookingDays = availability.advanceBookingDays || 30
      const sameDayBooking = availability.sameDayBooking ?? false
      const bufferTime = availability.bufferTime || 0
      const duration = service.duration
      const maxBookingsPerSlot = (service.bookingSettings as any)?.maxBookingsPerSlot || 1

      console.log('🔍 Availability calculation:', {
        serviceId: id,
        serviceName: service.name,
        now: now.toISOString(),
        nowDayOfWeek: now.getDay(),
        timezoneOffset,
        advanceBookingDays,
        sameDayBooking,
        bufferTime,
        duration,
        workingHoursCount: availability.workingHours?.length,
      })

      // Calculate date range
      const rangeStart = startDate || now
      const rangeEnd = endDate || new Date(now.getTime() + advanceBookingDays * 24 * 60 * 60 * 1000)

      // Fetch all relevant jobs in the range
      // Include pending-confirmation to prevent double-booking before confirmation
      const jobs = await prisma.job.findMany({
        where: {
          tenantId: actualTenantId,
          status: { in: ['scheduled', 'in-progress', 'pending-confirmation'] },
          deletedAt: null,
          archivedAt: null,
          toBeScheduled: false,
          startTime: { lte: rangeEnd },
          endTime: { gte: rangeStart },
        },
      })

      // Helper to convert HH:mm to minutes since midnight
      const timeToMinutes = (time: string): number => {
        const [hours, minutes] = time.split(':').map(Number)
        return hours * 60 + minutes
      }

      // Helper to check if a slot overlaps with any jobs
      const countOverlappingJobs = (slotStart: Date, slotEnd: Date): number => {
        return jobs.filter(job => {
          if (!job.startTime || !job.endTime) return false
          const jobStart = new Date(job.startTime)
          const jobEnd = new Date(job.endTime)
          return slotStart < jobEnd && slotEnd > jobStart
        }).length
      }

      // Generate slots for each day in range
      const slotsData: { date: string; slots: { start: string; end: string }[] }[] = []

      const currentDay = new Date(rangeStart)
      currentDay.setHours(0, 0, 0, 0)

      while (currentDay <= rangeEnd) {
        const dayOfWeek = currentDay.getDay()
        const workingHours = availability.workingHours.find((wh: any) => wh.dayOfWeek === dayOfWeek)

        console.log(`📅 Checking ${currentDay.toISOString().split('T')[0]} (day ${dayOfWeek}):`, {
          hasWorkingHours: !!workingHours,
          isWorking: workingHours?.isWorking,
          hours: workingHours ? `${workingHours.startTime}-${workingHours.endTime}` : 'N/A',
        })

        if (workingHours && workingHours.isWorking) {
          const daySlots: { start: string; end: string }[] = []

          const startMinutes = timeToMinutes(workingHours.startTime)
          const endMinutes = timeToMinutes(workingHours.endTime)
          const slotDuration = duration + bufferTime

          for (
            let minutes = startMinutes;
            minutes + duration <= endMinutes;
            minutes += slotDuration
          ) {
            const slotStart = new Date(currentDay)
            // Apply timezone offset: working hours are in business local time
            // Lambda runs in UTC, so we need to offset the hours
            const adjustedHours = Math.floor(minutes / 60) - timezoneOffset
            slotStart.setHours(adjustedHours, minutes % 60, 0, 0)

            const slotEnd = new Date(slotStart)
            slotEnd.setMinutes(slotEnd.getMinutes() + duration)

            // Skip if slot is in the past
            if (slotStart < now) continue

            // Skip same-day bookings if not allowed
            if (!sameDayBooking && slotStart.toDateString() === now.toDateString()) continue

            // Skip if outside advance booking window
            const daysInFuture = (slotStart.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
            if (daysInFuture > advanceBookingDays) continue

            // Check for overlapping jobs
            const overlappingCount = countOverlappingJobs(slotStart, slotEnd)
            if (overlappingCount < maxBookingsPerSlot) {
              daySlots.push({
                start: slotStart.toISOString(),
                end: slotEnd.toISOString(),
              })
            }
          }

          if (daySlots.length > 0) {
            console.log(`  ✅ Added ${daySlots.length} slots for this day`)
            slotsData.push({
              date: currentDay.toISOString().split('T')[0],
              slots: daySlots,
            })
          } else {
            console.log(`  ❌ No slots generated for this day`)
          }
        }

        currentDay.setDate(currentDay.getDate() + 1)
      }

      console.log(`🎯 Final result: ${slotsData.length} days with availability`)

      return {
        serviceId: id,
        slots: slotsData,
      }
    },
    bookSlot: async (tenantId: string, id: string, payload: any, contractorEmail?: string) => {
      return await prisma.$transaction(async tx => {
        // 1. Load and validate service
        // For public booking, look up service by ID only (ignore tenantId parameter)
        const service = await tx.service.findUnique({
          where: { id },
        })
        if (!service) throw new Error('Service not found')
        if (!service.isActive) throw new Error('Service is not active')

        // Use the service's actual tenantId for all subsequent operations
        const actualTenantId = service.tenantId

        const availability = service.availability as any
        const bookingSettings = service.bookingSettings as any
        const timezoneOffset = availability.timezoneOffset ?? -8 // Default to PST
        const startTime = new Date(payload.startTime)
        const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000)
        const now = new Date()

        // 2. Validate slot timing
        if (startTime < now) {
          throw new Error('Cannot book slots in the past')
        }

        const dayOfWeek = startTime.getDay()
        const workingHours = availability?.workingHours?.find(
          (wh: any) => wh.dayOfWeek === dayOfWeek
        )

        if (!workingHours || !workingHours.isWorking) {
          throw new Error('Service is not available on this day')
        }

        // Validate time is within working hours (accounting for timezone offset)
        // The incoming time is in UTC, working hours are in business local time
        const localStartHour = startTime.getHours() + timezoneOffset
        const localEndHour = endTime.getHours() + timezoneOffset
        const startMinutes = localStartHour * 60 + startTime.getMinutes()
        const endMinutes = localEndHour * 60 + endTime.getMinutes()
        const workStartMinutes =
          parseInt(workingHours.startTime.split(':')[0]) * 60 +
          parseInt(workingHours.startTime.split(':')[1])
        const workEndMinutes =
          parseInt(workingHours.endTime.split(':')[0]) * 60 +
          parseInt(workingHours.endTime.split(':')[1])

        if (startMinutes < workStartMinutes || endMinutes > workEndMinutes) {
          throw new Error('Slot is outside working hours')
        }

        // Validate advance booking rules
        const sameDayBooking = availability?.sameDayBooking ?? false
        if (!sameDayBooking && startTime.toDateString() === now.toDateString()) {
          throw new Error('Same-day booking is not allowed')
        }

        const advanceBookingDays = availability?.advanceBookingDays || 30
        const daysInFuture = (startTime.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        if (daysInFuture > advanceBookingDays) {
          throw new Error('Booking is too far in advance')
        }

        // Double booking check removed - allowing overlapping bookings

        // 4. Upsert contact
        let contact
        const contactData = payload.contact || {}

        if (contactData.id) {
          contact = await tx.contact.findFirst({
            where: { id: contactData.id, tenantId: actualTenantId },
          })
          if (!contact) throw new Error('Contact not found')
        } else if (contactData.email) {
          contact = await tx.contact.findFirst({
            where: { email: contactData.email, tenantId: actualTenantId },
          })
        }

        if (!contact) {
          // Create new contact - split name if provided
          const fullName = contactData.name || ''
          const nameParts = fullName.trim().split(/\s+/)
          const firstName = nameParts[0] || 'Guest'
          const lastName = nameParts.slice(1).join(' ') || ''

          contact = await tx.contact.create({
            data: {
              tenantId: actualTenantId,
              firstName,
              lastName,
              email: contactData.email,
              phone: contactData.phone,
              company: contactData.company,
              address: contactData.address,
              notes: contactData.notes,
              status: 'active',
            },
          })
        } else {
          // Update existing contact if address is provided
          if (contactData.address !== undefined) {
            contact = await tx.contact.update({
              where: { id: contact.id },
              data: {
                address: contactData.address || undefined,
              },
            })
          }
        }

        // 5. Create job(s)
        // Set status based on whether confirmation is required
        const requireConfirmation = bookingSettings?.requireConfirmation ?? false
        const initialStatus = requireConfirmation ? 'pending-confirmation' : 'scheduled'

        let job: any

        // If recurrence is provided, create recurring jobs inline
        if (payload.recurrence) {
          const recurrence = payload.recurrence
          const title = `${service.name} with ${contact.firstName} ${contact.lastName}`.trim()

          // Create the JobRecurrence record
          const jobRecurrence = await tx.jobRecurrence.create({
            data: {
              tenantId: actualTenantId,
              contactId: contact.id,
              serviceId: service.id,
              title,
              location: payload.location,
              notes: payload.notes,
              status: 'active',
              frequency: recurrence.frequency,
              interval: recurrence.interval,
              count: recurrence.count,
              untilDate: recurrence.untilDate ? new Date(recurrence.untilDate) : null,
              daysOfWeek: recurrence.daysOfWeek || [],
              startTime,
              endTime,
            },
          })

          // Generate all occurrence instances
          const instances = generateRecurrenceInstances({
            startTime,
            endTime,
            recurrence,
          })

          // Check for conflicts across all instances
          const conflicts: Array<{ date: string; time: string }> = []

          for (const instance of instances) {
            const overlappingJobs = await tx.job.count({
              where: {
                tenantId: actualTenantId,
                status: { in: ['scheduled', 'in-progress', 'pending-confirmation'] },
                deletedAt: null,
                archivedAt: null,
                toBeScheduled: false,
                startTime: { lt: instance.endTime },
                endTime: { gt: instance.startTime },
              },
            })

            if (overlappingJobs >= maxBookingsPerSlot) {
              conflicts.push({
                date: instance.startTime.toISOString().split('T')[0],
                time: instance.startTime.toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                }),
              })
            }
          }

          if (conflicts.length > 0) {
            const conflictSummary = conflicts
              .slice(0, 5)
              .map(c => `${c.date} at ${c.time}`)
              .join('; ')
            const moreText = conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : ''

            throw new ApiError(
              `Cannot create recurring schedule due to conflicts: ${conflictSummary}${moreText}`,
              409
            )
          }

          // Create all job instances
          // Map contact address to job location if provided
          const jobLocation = payload.location || contactData.address || undefined

          const jobs = await Promise.all(
            instances.map(instance =>
              tx.job.create({
                data: {
                  tenantId: actualTenantId,
                  title,
                  contactId: contact.id,
                  serviceId: service.id,
                  recurrenceId: jobRecurrence.id,
                  startTime: instance.startTime,
                  endTime: instance.endTime,
                  status: initialStatus,
                  location: jobLocation,
                  notes: payload.notes,
                  breaks: undefined, // Recurring jobs don't have breaks initially
                },
                include: {
                  contact: true,
                  service: true,
                },
              })
            )
          )

          // Use the first job for email notifications
          job = {
            ...jobs[0],
            recurrenceId: jobRecurrence.id,
            occurrenceCount: jobs.length,
          }
        } else {
          // Single job creation (existing logic)
          // Map contact address to job location if provided
          const jobLocation = payload.location || contactData.address || undefined

          job = await tx.job.create({
            data: {
              tenantId: actualTenantId,
              title: `${service.name} with ${contact.firstName} ${contact.lastName}`.trim(),
              contactId: contact.id,
              serviceId: service.id,
              startTime,
              endTime,
              status: initialStatus,
              location: jobLocation,
              notes: payload.notes,
              breaks: undefined, // Public booking jobs don't have breaks initially
            },
            include: {
              contact: true,
              service: true,
            },
          })
        }

        // 6. Send notification emails (after transaction commits)
        // Send emails synchronously to ensure they're sent before Lambda exits
        try {
          const clientEmail = contact.email
          const clientName = `${contact.firstName} ${contact.lastName}`.trim()

          // Get tenant settings for company name and reply-to email
          const settings = await tx.tenantSettings.findUnique({
            where: { tenantId: actualTenantId },
          })

          const companyName = settings?.companyDisplayName || 'JobDock'
          const replyToEmail = settings?.companySupportEmail || undefined

          // Get timezone offset from service availability settings
          const availability = service.availability as any
          const timezoneOffset = availability?.timezoneOffset ?? -8

          // Fetch logo URL if available (7 days expiration for email)
          let logoUrl: string | null = null
          if (settings?.logoUrl) {
            try {
              const { getFileUrl } = await import('./fileUpload')
              logoUrl = await getFileUrl(settings.logoUrl, 7 * 24 * 60 * 60) // 7 days
            } catch (error) {
              console.error('Error fetching logo URL for email:', error)
            }
          }

          if (clientEmail) {
            // Send email to client
            if (requireConfirmation) {
              console.log(`📧 Sending booking request email to ${clientEmail}`)
              const emailPayload = buildClientPendingEmail({
                clientName,
                serviceName: service.name,
                startTime,
                endTime,
                timezoneOffset,
                companyName,
                logoUrl,
                settings: {
                  companySupportEmail: settings?.companySupportEmail || null,
                  companyPhone: settings?.companyPhone || null,
                },
              })
              await sendEmail({
                ...emailPayload,
                to: clientEmail,
                fromName: companyName,
                replyTo: replyToEmail,
              })
              console.log('✅ Booking request email sent successfully')
            } else {
              console.log(`📧 Sending instant confirmation email to ${clientEmail}`)
              const emailPayload = buildClientConfirmationEmail({
                clientName,
                serviceName: service.name,
                startTime,
                endTime,
                location: payload.location,
                timezoneOffset,
                companyName,
                logoUrl,
                settings: {
                  companySupportEmail: settings?.companySupportEmail || null,
                  companyPhone: settings?.companyPhone || null,
                },
              })
              await sendEmail({
                ...emailPayload,
                to: clientEmail,
                fromName: companyName,
                replyTo: replyToEmail,
              })
              console.log('✅ Instant confirmation email sent successfully')
            }
          }

          // Send email to contractor if email is provided
          if (contractorEmail) {
            console.log(`📧 Sending contractor notification email to ${contractorEmail}`)
            const emailPayload = buildContractorNotificationEmail({
              contractorName: 'Contractor',
              serviceName: service.name,
              clientName,
              clientEmail: contact.email ?? undefined,
              clientPhone: contact.phone ?? undefined,
              startTime,
              endTime,
              location: payload.location,
              isPending: requireConfirmation,
              companyName,
              logoUrl,
              settings: {
                companySupportEmail: settings?.companySupportEmail || null,
                companyPhone: settings?.companyPhone || null,
              },
            })
            await sendEmail({
              ...emailPayload,
              to: contractorEmail,
              fromName: companyName,
              replyTo: replyToEmail,
            })
            console.log('✅ Contractor notification email sent successfully')
          }
        } catch (emailError) {
          // Log email errors but don't fail the booking
          console.error('❌ Failed to send booking emails:', emailError)
        }

        return job
      })
    },
  },
  billing: {
    getStatus: async (tenantId: string) => {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          stripePriceId: true,
          stripeSubscriptionStatus: true,
          trialEndsAt: true,
          currentPeriodEndsAt: true,
          cancelAtPeriodEnd: true,
          subscriptionTier: true,
        },
      })

      if (!tenant) {
        throw new ApiError('Tenant not found', 404)
      }

      const singlePriceId = process.env.STRIPE_PRICE_ID
      const teamPriceId = process.env.STRIPE_TEAM_PRICE_ID
      const isTeamPrice =
        tenant.stripePriceId === teamPriceId ||
        (tenant.subscriptionTier === 'team')
      const subscriptionTier =
        tenant.subscriptionTier || (isTeamPrice ? 'team' : 'single')

      const userCount = await prisma.user.count({ where: { tenantId } })
      const canDowngrade =
        subscriptionTier !== 'team' || userCount <= 1

      const teamTestingSkipStripe = process.env.TEAM_TESTING_SKIP_STRIPE === 'true'
      const canInviteTeamMembers =
        subscriptionTier === 'team' || teamTestingSkipStripe

      return {
        hasSubscription: !!tenant.stripeSubscriptionId,
        status: tenant.stripeSubscriptionStatus || 'none',
        trialEndsAt: tenant.trialEndsAt?.toISOString(),
        currentPeriodEndsAt: tenant.currentPeriodEndsAt?.toISOString(),
        cancelAtPeriodEnd: tenant.cancelAtPeriodEnd || false,
        subscriptionTier,
        canInviteTeamMembers,
        canDowngrade,
        teamMemberCount: userCount,
      }
    },
    createEmbeddedCheckoutSession: async (
      tenantId: string,
      userId: string,
      userEmail: string,
      options?: { priceId?: string; plan?: 'single' | 'team' }
    ) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeCustomerId: true,
          name: true,
        },
      })

      if (!tenant) {
        throw new ApiError('Tenant not found', 404)
      }

      // Create or reuse Stripe customer
      let customerId = tenant.stripeCustomerId
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            tenantId,
            ownerUserId: userId,
          },
        })
        customerId = customer.id

        // Save customer ID to tenant
        await prisma.tenant.update({
          where: { id: tenantId },
          data: { stripeCustomerId: customerId },
        })
      }

      let priceId = options?.priceId
      if (!priceId && options?.plan === 'team') {
        priceId = process.env.STRIPE_TEAM_PRICE_ID || undefined
      }
      if (!priceId) {
        priceId = process.env.STRIPE_PRICE_ID || undefined
      }
      if (!priceId) {
        throw new ApiError('STRIPE_PRICE_ID not configured', 500)
      }

      const returnUrl = process.env.PUBLIC_APP_URL
        ? `${process.env.PUBLIC_APP_URL}/app/billing/return?session_id={CHECKOUT_SESSION_ID}`
        : 'http://localhost:5173/app/billing/return?session_id={CHECKOUT_SESSION_ID}'

      const session = await stripe.checkout.sessions.create({
        ui_mode: 'embedded',
        mode: 'subscription',
        customer: customerId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          trial_period_days: 14,
          trial_settings: {
            end_behavior: {
              missing_payment_method: 'cancel',
            },
          },
          metadata: {
            tenantId,
            ownerUserId: userId,
          },
        },
        payment_method_collection: 'always',
        return_url: returnUrl,
        metadata: {
          tenantId,
          ownerUserId: userId,
        },
      })

      return {
        clientSecret: session.client_secret,
      }
    },
    createUpgradeCheckoutUrl: async (
      tenantId: string,
      userId: string,
      userEmail: string,
      plan: 'team'
    ) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { stripeCustomerId: true },
      })

      if (!tenant?.stripeCustomerId) {
        throw new ApiError('No Stripe customer found. Subscribe first.', 400)
      }

      const priceId =
        plan === 'team' ? process.env.STRIPE_TEAM_PRICE_ID : process.env.STRIPE_PRICE_ID
      if (!priceId) {
        throw new ApiError('Stripe price not configured for this plan', 500)
      }

      const returnUrl = process.env.PUBLIC_APP_URL
        ? `${process.env.PUBLIC_APP_URL}/app/settings`
        : 'http://localhost:5173/app/settings'

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: tenant.stripeCustomerId,
        line_items: [{ price: priceId, quantity: 1 }],
        metadata: { tenantId, ownerUserId: userId },
        success_url: `${returnUrl}?upgraded=1`,
        cancel_url: returnUrl,
      })

      return { url: session.url }
    },
    createPortalSession: async (tenantId: string) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          stripeCustomerId: true,
        },
      })

      if (!tenant || !tenant.stripeCustomerId) {
        throw new ApiError('No Stripe customer found for this tenant', 404)
      }

      const returnUrl = process.env.PUBLIC_APP_URL
        ? `${process.env.PUBLIC_APP_URL}/app/billing`
        : 'http://localhost:5173/app/billing'

      const session = await stripe.billingPortal.sessions.create({
        customer: tenant.stripeCustomerId,
        return_url: returnUrl,
      })

      return {
        url: session.url,
      }
    },
    handleWebhook: async (rawBody: string, signature: string) => {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-02-24.acacia',
      })

      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
      if (!webhookSecret) {
        throw new ApiError('STRIPE_WEBHOOK_SECRET not configured', 500)
      }

      let event: any
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      } catch (err: any) {
        console.error('Webhook signature verification failed:', err.message)
        throw new ApiError(`Webhook signature verification failed: ${err.message}`, 400)
      }

      // Check for idempotency
      const existingEvent = await prisma.stripeWebhookEvent.findUnique({
        where: { stripeEventId: event.id },
      })

      if (existingEvent) {
        console.log(`Event ${event.id} already processed, skipping`)
        return { received: true, alreadyProcessed: true }
      }

      // Map Stripe price ID to subscription tier
      const priceIdToTier = (priceId: string | null): string | null => {
        if (!priceId) return null
        const singlePriceId = process.env.STRIPE_PRICE_ID
        const teamPriceId = process.env.STRIPE_TEAM_PRICE_ID
        if (priceId === singlePriceId) return 'single'
        if (priceId === teamPriceId) return 'team'
        return 'single' // default for unknown price
      }

      // Process the event
      console.log(`Processing Stripe event: ${event.type}`)

      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object
          const tenantId = session.metadata?.tenantId

          if (tenantId && session.subscription) {
            const sub = await stripe.subscriptions.retrieve(session.subscription as string)
            const priceId = (sub.items?.data?.[0] as any)?.price?.id ?? process.env.STRIPE_PRICE_ID
            const subscriptionTier = priceIdToTier(priceId)
            await prisma.tenant.update({
              where: { id: tenantId },
              data: {
                stripeSubscriptionId: session.subscription as string,
                stripePriceId: priceId,
                subscriptionTier,
              },
            })
            console.log(`Updated tenant ${tenantId} with subscription ${session.subscription}, tier ${subscriptionTier}`)
          }
          break
        }

        case 'customer.subscription.created':
        case 'customer.subscription.updated': {
          const subscription = event.data.object
          const tenantId = subscription.metadata?.tenantId

          if (tenantId) {
            const priceId = (subscription.items?.data?.[0] as any)?.price?.id ?? null
            const subscriptionTier = priceIdToTier(priceId)
            const updateData: any = {
              stripeSubscriptionId: subscription.id,
              stripeSubscriptionStatus: subscription.status,
              currentPeriodEndsAt: new Date(subscription.current_period_end * 1000),
              cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
              ...(priceId && { stripePriceId: priceId }),
              ...(subscriptionTier && { subscriptionTier }),
            }

            if (subscription.trial_end) {
              updateData.trialEndsAt = new Date(subscription.trial_end * 1000)
            }

            await prisma.tenant.update({
              where: { id: tenantId },
              data: updateData,
            })
            console.log(`Updated tenant ${tenantId} subscription status to ${subscription.status}, tier ${subscriptionTier}`)
          }
          break
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object
          const tenantId = subscription.metadata?.tenantId

          if (tenantId) {
            await prisma.tenant.update({
              where: { id: tenantId },
              data: {
                stripeSubscriptionStatus: 'canceled',
              },
            })
            console.log(`Subscription canceled for tenant ${tenantId}`)
          }
          break
        }

        case 'invoice.paid': {
          const invoice = event.data.object
          // You can add additional logic here if needed
          console.log(`Invoice ${invoice.id} paid`)
          break
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object
          // You can add logic to notify the user or take action
          console.log(`Invoice ${invoice.id} payment failed`)
          break
        }

        default:
          console.log(`Unhandled event type: ${event.type}`)
      }

      // Record the event as processed
      await prisma.stripeWebhookEvent.create({
        data: {
          stripeEventId: event.id,
        },
      })

      return { received: true }
    },
  },
  'job-logs': {
    getAll: async (
      tenantId: string,
      currentUserId?: string,
      currentUserRole?: string
    ) => {
      await ensureTenantExists(tenantId)
      const logs = await prisma.jobLog.findMany({
        where: { tenantId },
        include: {
          job: { include: { createdBy: { select: { name: true } } } },
          contact: true,
          timeEntries: true,
        },
        orderBy: { createdAt: 'desc' },
      })
      const logIds = logs.map((l) => l.id)
      const documents = await prisma.document.findMany({
        where: { tenantId, entityType: 'job_log', entityId: { in: logIds } },
      })
      const photosByLogId = new Map<string, typeof documents>()
      for (const doc of documents) {
        const list = photosByLogId.get(doc.entityId) ?? []
        list.push(doc)
        photosByLogId.set(doc.entityId, list)
      }
      const apiBase = (process.env.API_BASE_URL || '').replace(/\/$/, '')
      return Promise.all(
        logs.map(async (log) => {
          const docs = photosByLogId.get(log.id) ?? []
          const photos = apiBase
            ? docs.map((doc) => ({
                id: doc.id,
                fileName: doc.fileName,
                fileKey: doc.fileKey,
                url: `${apiBase}/job-logs/${log.id}/photo-file?photoId=${doc.id}&token=${createPhotoToken(doc.id, log.id)}`,
                notes: doc.notes ?? null,
                markup: doc.markup ?? null,
                createdAt: doc.createdAt.toISOString(),
              }))
            : await Promise.all(
                docs.map(async (doc) => ({
                  id: doc.id,
                  fileName: doc.fileName,
                  fileKey: doc.fileKey,
                  url: await getFileUrl(doc.fileKey, 3600),
                  notes: doc.notes ?? null,
                  markup: doc.markup ?? null,
                  createdAt: doc.createdAt.toISOString(),
                }))
              )
          const assignedToName = await getAssignedToName(tenantId, log.assignedTo)
          const assignedToWithPrivacy = getAssignedToWithPrivacy(
            log.assignedTo,
            currentUserId,
            currentUserRole
          )
          return {
            ...log,
            assignedToName,
            assignedTo: assignedToWithPrivacy || log.assignedTo,
            job: log.job
              ? {
                  id: log.job.id,
                  title: log.job.title,
                  startTime: log.job.startTime?.toISOString(),
                  endTime: log.job.endTime?.toISOString(),
                  status: log.job.status,
                  createdByName: (log.job as any).createdBy?.name,
                }
              : null,
            contact: log.contact
              ? { id: log.contact.id, name: `${log.contact.firstName} ${log.contact.lastName}`.trim(), email: log.contact.email }
              : null,
            timeEntries: log.timeEntries.map((te) => ({
              id: te.id,
              startTime: te.startTime.toISOString(),
              endTime: te.endTime.toISOString(),
              breakMinutes: te.breakMinutes,
              notes: te.notes,
            })),
            photos,
          }
        })
      )
    },
    getById: async (
      tenantId: string,
      id: string,
      currentUserId?: string,
      currentUserRole?: string
    ) => {
      await ensureTenantExists(tenantId)
      const jobLog = await prisma.jobLog.findFirst({
        where: { id, tenantId },
        include: {
          job: { include: { createdBy: { select: { name: true } } } },
          contact: true,
          timeEntries: true,
        },
      })
      if (!jobLog) {
        throw new ApiError('Job log not found', 404)
      }
      const assignedToName = await getAssignedToName(tenantId, jobLog.assignedTo)
      const assignedToWithPrivacy = getAssignedToWithPrivacy(
        jobLog.assignedTo,
        currentUserId,
        currentUserRole
      )
      // Fetch photos (Documents) from DB and add URLs (proxy preferred to avoid S3 ERR_CONNECTION_RESET)
      const documents = await prisma.document.findMany({
        where: { tenantId, entityType: 'job_log', entityId: id },
      })
      const apiBase = (process.env.API_BASE_URL || '').replace(/\/$/, '')
      const photos = apiBase
        ? documents.map((doc) => ({
            id: doc.id,
            fileName: doc.fileName,
            fileKey: doc.fileKey,
            url: `${apiBase}/job-logs/${id}/photo-file?photoId=${doc.id}&token=${createPhotoToken(doc.id, id)}`,
            notes: doc.notes ?? null,
            markup: doc.markup ?? null,
            createdAt: doc.createdAt.toISOString(),
          }))
        : await Promise.all(
            documents.map(async (doc) => ({
              id: doc.id,
              fileName: doc.fileName,
              fileKey: doc.fileKey,
              url: await getFileUrl(doc.fileKey, 3600),
              notes: doc.notes ?? null,
              markup: doc.markup ?? null,
              createdAt: doc.createdAt.toISOString(),
            }))
          )
      return {
        ...jobLog,
        assignedToName,
        assignedTo: assignedToWithPrivacy || jobLog.assignedTo,
        job: jobLog.job
          ? {
              id: jobLog.job.id,
              title: jobLog.job.title,
              startTime: jobLog.job.startTime?.toISOString(),
              endTime: jobLog.job.endTime?.toISOString(),
              status: jobLog.job.status,
              createdByName: (jobLog.job as any).createdBy?.name,
            }
          : null,
        contact: jobLog.contact
          ? {
              id: jobLog.contact.id,
              firstName: jobLog.contact.firstName,
              lastName: jobLog.contact.lastName,
              email: jobLog.contact.email,
              name: `${jobLog.contact.firstName} ${jobLog.contact.lastName}`.trim(),
            }
          : null,
        timeEntries: jobLog.timeEntries.map((te) => ({
          id: te.id,
          startTime: te.startTime.toISOString(),
          endTime: te.endTime.toISOString(),
          breakMinutes: te.breakMinutes,
          notes: te.notes,
          createdAt: te.createdAt.toISOString(),
          updatedAt: te.updatedAt.toISOString(),
        })),
        photos,
      }
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const normalizedAssignedTo = normalizeAssignedTo(payload.assignedTo)
      if (normalizedAssignedTo) {
        await validateAssignedTo(tenantId, normalizedAssignedTo)
      }
      const jobId = payload.jobId && payload.jobId.trim() ? payload.jobId : null
      const contactId = payload.contactId && payload.contactId.trim() ? payload.contactId : null
      const created = await prisma.jobLog.create({
        data: {
          tenantId,
          title: payload.title,
          description: payload.description ?? null,
          location: payload.location ?? null,
          notes: payload.notes ?? null,
          jobId,
          contactId,
          assignedTo: normalizedAssignedTo,
          status: payload.status ?? 'active',
        },
        include: { job: true, contact: true, timeEntries: true },
      })
      if (normalizedAssignedTo && normalizedAssignedTo.length > 0) {
        const job = created.job
        const contact = created.contact
        sendAssignmentNotification({
          tenantId,
          assignedTo: normalizedAssignedTo,
          assignerUserId: payload._actingUserId,
          jobTitle: created.title,
          startTime: job?.startTime ?? null,
          endTime: job?.endTime ?? null,
          location: created.location ?? job?.location ?? undefined,
          contactName: contact ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || undefined : undefined,
          viewPath: '/app/job-logs',
        }).catch((e) => console.error('Failed to send job log assignment notification:', e))
      }
      // Fetch assigned users separately - extract userIds from assignment objects
      const assignedUserIds = extractUserIds(created.assignedTo)
      const assignedUsers = assignedUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: assignedUserIds }, tenantId },
            select: { id: true, name: true },
          })
        : []
      const assignedToNames = assignedUsers.map(u => u.name).filter(Boolean).join(', ')
      return { ...created, assignedToName: assignedToNames || undefined, assignedToUsers: assignedUsers }
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.jobLog.findFirst({
        where: { id, tenantId },
      })
      if (!existing) {
        throw new ApiError('Job log not found', 404)
      }
      const jobId = payload.jobId !== undefined ? (payload.jobId && payload.jobId.trim() ? payload.jobId : null) : undefined
      const contactId = payload.contactId !== undefined ? (payload.contactId && payload.contactId.trim() ? payload.contactId : null) : undefined
      const normalizedAssignedTo = payload.assignedTo !== undefined ? normalizeAssignedTo(payload.assignedTo) : undefined
      if (normalizedAssignedTo !== undefined && normalizedAssignedTo) {
        await validateAssignedTo(tenantId, normalizedAssignedTo)
      }
      const updated = await prisma.jobLog.update({
        where: { id },
        data: {
          title: payload.title,
          description: payload.description ?? undefined,
          location: payload.location ?? undefined,
          notes: payload.notes ?? undefined,
          jobId,
          contactId,
          assignedTo: normalizedAssignedTo,
          status: payload.status ?? undefined,
        },
        include: { job: true, contact: true, timeEntries: true },
      })
      const newAssignedTo = normalizedAssignedTo !== undefined ? normalizedAssignedTo : (existing.assignedTo as string[] | null)
      if (newAssignedTo && JSON.stringify(newAssignedTo) !== JSON.stringify(existing.assignedTo)) {
        const job = updated.job
        const contact = updated.contact
        sendAssignmentNotification({
          tenantId,
          assignedTo: newAssignedTo,
          assignerUserId: payload._actingUserId,
          jobTitle: updated.title,
          startTime: job?.startTime ?? null,
          endTime: job?.endTime ?? null,
          location: updated.location ?? job?.location ?? undefined,
          contactName: contact ? `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || undefined : undefined,
          viewPath: '/app/job-logs',
        }).catch((e) => console.error('Failed to send job log assignment notification:', e))
      }
      // Fetch assigned users separately - extract userIds from assignment objects
      const assignedUserIds = extractUserIds(updated.assignedTo)
      const assignedUsers = assignedUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: assignedUserIds }, tenantId },
            select: { id: true, name: true },
          })
        : []
      const assignedToNames = assignedUsers.map(u => u.name).filter(Boolean).join(', ')
      return { ...updated, assignedToName: assignedToNames || undefined, assignedToUsers: assignedUsers }
    },
    delete: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.jobLog.findFirst({
        where: { id, tenantId },
      })
      if (!existing) {
        throw new ApiError('Job log not found', 404)
      }
      // Delete documents (photos) for this job log
      const documents = await prisma.document.findMany({
        where: { tenantId, entityType: 'job_log', entityId: id },
      })
      for (const doc of documents) {
        try {
          await deleteFile(doc.fileKey)
        } catch (e) {
          console.error('Error deleting file:', e)
        }
      }
      await prisma.document.deleteMany({
        where: { tenantId, entityType: 'job_log', entityId: id },
      })
      await prisma.jobLog.delete({ where: { id } })
      return { success: true }
    },
    getUploadUrl: async (
      tenantId: string,
      jobLogId: string,
      payload: { filename: string; contentType: string }
    ) => {
      await ensureTenantExists(tenantId)
      const jobLog = await prisma.jobLog.findFirst({
        where: { id: jobLogId, tenantId },
      })
      if (!jobLog) {
        throw new ApiError('Job log not found', 404)
      }
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
      if (!allowedTypes.includes(payload.contentType)) {
        throw new ApiError('Invalid file type. Only PNG, JPEG, JPG, and WebP are allowed.', 400)
      }
      const { randomUUID } = await import('crypto')
      const ext = payload.filename.split('.').pop()
      const key = `job_logs/${tenantId}/${jobLogId}/${randomUUID()}.${ext}`
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' })
      const FILES_BUCKET = process.env.FILES_BUCKET || ''
      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: FILES_BUCKET,
          Key: key,
          ContentType: payload.contentType,
        }),
        { expiresIn: 300 }
      )
      return { uploadUrl, key }
    },
    confirmUpload: async (
      tenantId: string,
      jobLogId: string,
      payload: { key: string; fileName: string; fileSize: number; mimeType: string; uploadedBy: string }
    ) => {
      await ensureTenantExists(tenantId)
      const jobLog = await prisma.jobLog.findFirst({
        where: { id: jobLogId, tenantId },
      })
      if (!jobLog) {
        throw new ApiError('Job log not found', 404)
      }
      const user = await prisma.user.findFirst({
        where: { tenantId },
        select: { id: true },
      })
      await prisma.document.create({
        data: {
          tenantId,
          fileName: payload.fileName,
          fileKey: payload.key,
          fileSize: payload.fileSize,
          mimeType: payload.mimeType,
          entityType: 'job_log',
          entityId: jobLogId,
          uploadedBy: (payload.uploadedBy || user?.id) ?? 'system',
        },
      })
      return { success: true }
    },
    updatePhoto: async (
      tenantId: string,
      jobLogId: string,
      payload: { photoId: string; notes?: string; markup?: object }
    ) => {
      await ensureTenantExists(tenantId)
      const doc = await prisma.document.findFirst({
        where: {
          id: payload.photoId,
          tenantId,
          entityType: 'job_log',
          entityId: jobLogId,
        },
      })
      if (!doc) {
        throw new ApiError('Photo not found', 404)
      }
      await prisma.document.update({
        where: { id: payload.photoId },
        data: {
          ...(payload.notes !== undefined && { notes: payload.notes || null }),
          ...(payload.markup !== undefined && { markup: payload.markup as any }),
        },
      })
      return { success: true }
    },
    deletePhoto: async (tenantId: string, jobLogId: string, photoId: string) => {
      await ensureTenantExists(tenantId)
      const doc = await prisma.document.findFirst({
        where: {
          id: photoId,
          tenantId,
          entityType: 'job_log',
          entityId: jobLogId,
        },
      })
      if (!doc) {
        throw new ApiError('Photo not found', 404)
      }
      // Always delete the DB record scoped to tenant + entity.
      // Using deleteMany is more robust than delete(where: {id}) if the schema ever changes
      // or if ids are not globally unique in some environments.
      const deleteResult = await prisma.$transaction(async (tx) => {
        const res = await tx.document.deleteMany({
          where: {
            id: photoId,
            tenantId,
            entityType: 'job_log',
            entityId: jobLogId,
          },
        })
        return res
      })

      // If DB deletion didn't happen, treat as not found.
      if (!deleteResult.count) {
        throw new ApiError('Photo not found', 404)
      }

      // Best-effort storage cleanup after DB delete.
      try {
        await deleteFile(doc.fileKey)
      } catch (e) {
        console.error('Error deleting file from storage:', e)
      }

      return { success: true, deletedCount: deleteResult.count }
    },
  },
  'time-entries': {
    getAll: async (tenantId: string, jobLogId?: string) => {
      await ensureTenantExists(tenantId)
      return prisma.timeEntry.findMany({
        where: { tenantId, ...(jobLogId ? { jobLogId } : {}) },
        orderBy: { startTime: 'desc' },
      })
    },
    getById: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const te = await prisma.timeEntry.findFirst({
        where: { id, tenantId },
      })
      if (!te) {
        throw new ApiError('Time entry not found', 404)
      }
      return {
        ...te,
        startTime: te.startTime.toISOString(),
        endTime: te.endTime.toISOString(),
      }
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const jobLog = await prisma.jobLog.findFirst({
        where: { id: payload.jobLogId, tenantId },
      })
      if (!jobLog) {
        throw new ApiError('Job log not found', 404)
      }
      const created = await prisma.timeEntry.create({
        data: {
          tenantId,
          jobLogId: payload.jobLogId,
          startTime: new Date(payload.startTime),
          endTime: new Date(payload.endTime),
          breakMinutes: payload.breakMinutes ?? 0,
          notes: payload.notes ?? null,
        },
      })
      return {
        ...created,
        startTime: created.startTime.toISOString(),
        endTime: created.endTime.toISOString(),
      }
    },
    update: async (tenantId: string, id: string, payload: any) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.timeEntry.findFirst({
        where: { id, tenantId },
      })
      if (!existing) {
        throw new ApiError('Time entry not found', 404)
      }
      const updated = await prisma.timeEntry.update({
        where: { id },
        data: {
          startTime: payload.startTime ? new Date(payload.startTime) : undefined,
          endTime: payload.endTime ? new Date(payload.endTime) : undefined,
          breakMinutes: payload.breakMinutes ?? undefined,
          notes: payload.notes ?? undefined,
        },
      })
      return {
        ...updated,
        startTime: updated.startTime.toISOString(),
        endTime: updated.endTime.toISOString(),
      }
    },
    delete: async (tenantId: string, id: string) => {
      await ensureTenantExists(tenantId)
      const existing = await prisma.timeEntry.findFirst({
        where: { id, tenantId },
      })
      if (!existing) {
        throw new ApiError('Time entry not found', 404)
      }
      await prisma.timeEntry.delete({ where: { id } })
      return { success: true }
    },
  },
}
