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
  sendQuoteEmail,
  sendInvoiceEmail,
} from './email'
import { uploadFile, deleteFile, getFileUrl } from './fileUpload'
import {
  createImportSession,
  getImportSession,
  processImportSession,
  resolveConflict,
  getImportSessionData,
  parseCSVPreview,
} from './csvImport'

// Recurrence types
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

export interface RecurrencePayload {
  frequency: RecurrenceFrequency
  interval: number
  count?: number
  untilDate?: string
  daysOfWeek?: number[]
}

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  value ? Number(value) : 0

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
  
  const maxCount = recurrence.count 
    ? Math.min(recurrence.count, MAX_OCCURRENCES)
    : MAX_OCCURRENCES
  
  const maxDate = recurrence.untilDate 
    ? new Date(recurrence.untilDate)
    : new Date(startTime.getTime() + MAX_MONTHS * 30 * 24 * 60 * 60 * 1000)
  
  // #region agent log
  console.log('[DEBUG] generateRecurrenceInstances entry:', JSON.stringify({startTimeISO:startTime.toISOString(),endTimeISO:endTime.toISOString(),recurrence,maxCount,durationMs:duration}));
  // #endregion
  
  // Custom weekly pattern (specific days of week)
  if (recurrence.frequency === 'weekly' && recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
    // #region agent log
    console.log('[DEBUG] Using custom weekly pattern:', JSON.stringify({daysOfWeek:recurrence.daysOfWeek,maxCount}));
    // #endregion
    let currentDate = new Date(startTime)
    let instanceCount = 0
    
    // Generate instances for up to MAX_MONTHS
    const endSearchDate = new Date(Math.min(maxDate.getTime(), startTime.getTime() + MAX_MONTHS * 30 * 24 * 60 * 60 * 1000))
    
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
    console.log('[DEBUG] Custom weekly instances generated:', JSON.stringify({instanceCount,firstDateISO:instances[0]?.startTime.toISOString(),lastDateISO:instances[instances.length-1]?.startTime.toISOString()}));
    // #endregion
    
    return instances
  }
  
  // Standard patterns - FIXED 2026-01-12T22:20:00
  // Normalize frequency to lowercase string for comparison safety
  const freq = String(recurrence.frequency).toLowerCase().trim()
  const interval = recurrence.interval || 1
  // DEBUG: Log frequency detection
  console.log('RECURRENCE_DEBUG_V3:', { freq, interval, originalFreq: recurrence.frequency, maxCount })
  
  // #region agent log
  console.log('[DEBUG] Using standard pattern:', JSON.stringify({freq,originalFrequency:recurrence.frequency,interval,maxCount}));
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
      console.log('[DEBUG] Unknown frequency, defaulting to daily:', freq);
      currentStart = new Date(currentStart.getTime() + interval * 24 * 60 * 60 * 1000)
    }
    
    currentEnd = new Date(currentStart.getTime() + duration)
  }
  
  // #region agent log
  console.log('[DEBUG] Standard pattern instances generated:', JSON.stringify({
    totalInstances: instances.length,
    firstDateISO: instances[0]?.startTime.toISOString(),
    secondDateISO: instances[1]?.startTime.toISOString(),
    lastDateISO: instances[instances.length-1]?.startTime.toISOString()
  }));
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
  assignedTo?: string
  breaks?: Array<{ startTime: string; endTime: string; reason?: string }>
  recurrence: RecurrencePayload
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
    assignedTo,
    breaks,
    recurrence,
  } = params

  return await prisma.$transaction(async (tx) => {
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
        assignedTo,
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
    console.log('[DEBUG] Generated instances:', JSON.stringify({
      count: instances.length,
      first3: instances.slice(0, 3).map(i => ({start: i.startTime.toISOString(), end: i.endTime.toISOString()})),
      allStartTimes: instances.map(i => i.startTime.toISOString())
    }));
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
            console.log(`Skipping instance ${instanceStart.toISOString()} due to break period ${breakStart.toISOString()} - ${breakEnd.toISOString()}`)
            return false // Skip this instance
          }
        }
        
        return true // Keep this instance
      })
    }

    // 3. Check for conflicts across all instances
    const conflicts: Array<{ date: string; time: string; conflictingJob: string }> = []
    
    for (const instance of instances) {
      const overlappingJobs = await tx.job.findMany({
        where: {
          tenantId,
          status: { in: ['scheduled', 'in-progress', 'pending-confirmation'] },
          startTime: { lt: instance.endTime },
          endTime: { gt: instance.startTime },
        },
        include: { contact: true },
      })
      
      if (overlappingJobs.length > 0) {
        for (const job of overlappingJobs) {
          conflicts.push({
            date: instance.startTime.toISOString().split('T')[0],
            time: instance.startTime.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            }),
            conflictingJob: `${job.title} (${job.contact.firstName} ${job.contact.lastName})`,
          })
        }
      }
    }

    if (conflicts.length > 0) {
      const conflictSummary = conflicts
        .slice(0, 5)
        .map(c => `${c.date} at ${c.time} conflicts with ${c.conflictingJob}`)
        .join('; ')
      const moreText = conflicts.length > 5 ? ` and ${conflicts.length - 5} more` : ''
      
      throw new ApiError(
        `Cannot create recurring schedule due to conflicts: ${conflictSummary}${moreText}`,
        409
      )
    }

    // 4. Create all job instances
    const jobs = await Promise.all(
      instances.map((instance) =>
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
            assignedTo,
            breaks: undefined, // Recurring jobs don't have breaks initially
          },
          include: {
            contact: true,
            service: true,
          },
        })
      )
    )

    // Return the first job with recurrence metadata
    return {
      ...jobs[0],
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

async function generateSequentialNumber(
  tenantId: string,
  model: 'quote' | 'invoice'
) {
  const count =
    model === 'quote'
      ? await prisma.quote.count({ where: { tenantId } })
      : await prisma.invoice.count({ where: { tenantId } })
  const prefix = model === 'quote' ? 'QT' : 'INV'
  return `${prefix}-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`
}

const serializeQuote = (quote: Quote & {
  contact?: Contact
  lineItems: QuoteLineItem[]
}) => ({
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
  total: toNumber(quote.total),
  status: quote.status as any,
  notes: quote.notes ?? undefined,
  validUntil: quote.validUntil?.toISOString(),
  createdAt: quote.createdAt.toISOString(),
  updatedAt: quote.updatedAt.toISOString(),
  ...withContactInfo(quote.contact),
})

const serializeInvoice = (invoice: Invoice & {
  contact?: Contact
  lineItems: InvoiceLineItem[]
}) => ({
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
  total: toNumber(invoice.total),
  status: invoice.status,
  paymentStatus: invoice.paymentStatus,
  approvalStatus: (invoice as any).approvalStatus ?? 'none',
  approvalAt: (invoice as any).approvalAt?.toISOString(),
  notes: invoice.notes ?? undefined,
  dueDate: invoice.dueDate?.toISOString(),
  paymentTerms: invoice.paymentTerms,
  paidAmount: toNumber(invoice.paidAmount),
  createdAt: invoice.createdAt.toISOString(),
  updatedAt: invoice.updatedAt.toISOString(),
  ...withContactInfo(invoice.contact),
})

export const dataServices = {
  settings: {
    get: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
      let settings = await prisma.tenantSettings.findUnique({
        where: { tenantId },
      })
      
      // If settings don't exist, create default settings
      if (!settings) {
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { name: true },
        })
        
        settings = await prisma.tenantSettings.create({
          data: {
            tenantId,
            companyDisplayName: tenant?.name || 'Your Company',
          },
        })
      }
      
      // Generate signed URLs for logo and PDF templates if they exist
      const result: any = { ...settings }
      
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
    getUploadUrl: async (tenantId: string, payload: { type: 'logo' | 'invoice-pdf' | 'quote-pdf'; filename: string; contentType: string }) => {
      await ensureTenantExists(tenantId)
      
      const { type, filename, contentType } = payload
      
      // Validate file type based on upload type
      if (type === 'logo') {
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml']
        if (!allowedTypes.includes(contentType)) {
          throw new ApiError('Invalid file type. Only PNG, JPEG, and SVG are allowed for logos.', 400)
        }
      } else {
        if (contentType !== 'application/pdf') {
          throw new ApiError('Invalid file type. Only PDF files are allowed for templates.', 400)
        }
      }
      
      // Generate unique key
      const { randomUUID } = await import('crypto')
      const ext = filename.split('.').pop()
      const folder = type === 'logo' ? `logos/${tenantId}` : `pdf-templates/${tenantId}/${type.replace('-pdf', 's')}`
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
    confirmUpload: async (tenantId: string, payload: { key: string; type: 'logo' | 'invoice-pdf' | 'quote-pdf' }) => {
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
          status: payload.status ?? 'active',
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

      return prisma.$transaction(async (tx) => {
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

        const quoteIdList = quoteIds.map((record) => record.id)
        const invoiceIdList = invoiceIds.map((record) => record.id)

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
      console.log('[CSV IMPORT v2.0] importPreview called', { tenantId, contentLength: payload?.csvContent?.length })
      await ensureTenantExists(tenantId)
      console.log('[CSV IMPORT v2.0] Tenant exists, calling parseCSVPreview')
      const result = parseCSVPreview(payload.csvContent)
      console.log('[CSV IMPORT v2.0] parseCSVPreview result:', { headers: result.headers, totalRows: result.totalRows, suggestedMapping: result.suggestedMapping })
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
      const quoteNumber =
        payload.quoteNumber || (await generateSequentialNumber(tenantId, 'quote'))
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
        ? lineItems.reduce(
            (sum: number, item: any) => sum + item.quantity * item.unitPrice,
            0
          )
        : undefined
      const taxRate = payload.taxRate
      const discount = payload.discount

      await prisma.$transaction(async (tx) => {
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
          throw new ApiError('You have already accepted this quote. The contractor has been notified.', 400)
        } else if (quote.status === 'rejected') {
          throw new ApiError('You have already declined this quote. Please contact the contractor if you\'ve changed your mind.', 400)
        }
        throw new ApiError('This quote can no longer be responded to. Please contact the contractor for assistance.', 400)
      }
      
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: { status: 'accepted' },
        include: { contact: true, lineItems: true },
      })
      
      console.log(`✅ Quote ${quote.quoteNumber} approved by client`)
      
      return serializeQuote(updatedQuote)
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
          throw new ApiError('You have already accepted this quote. Please contact the contractor if you need to cancel.', 400)
        } else if (quote.status === 'rejected') {
          throw new ApiError('You have already declined this quote. The contractor has been notified.', 400)
        }
        throw new ApiError('This quote can no longer be responded to. Please contact the contractor for assistance.', 400)
      }
      
      const updatedQuote = await prisma.quote.update({
        where: { id },
        data: { status: 'rejected' },
        include: { contact: true, lineItems: true },
      })
      
      console.log(`✅ Quote ${quote.quoteNumber} declined by client`)
      
      return serializeQuote(updatedQuote)
    },
  },
  invoices: {
    getAll: async (tenantId: string) => {
      await ensureTenantExists(tenantId)
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
        paymentStatus === 'paid'
          ? total
          : paymentStatus === 'partial'
            ? payload.paidAmount || 0
            : 0

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
          total,
          status: payload.status || 'draft',
          paymentStatus,
          notes: payload.notes,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          paymentTerms: payload.paymentTerms || 'Net 30',
          paidAmount,
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

      const lineItems = payload.lineItems
      await prisma.$transaction(async (tx) => {
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
            ...payload,
          },
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
    setApprovalStatus: async (tenantId: string, id: string, approvalStatus: 'accepted' | 'declined') => {
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
          throw new ApiError(`You have already ${action} this invoice. The contractor has been notified.`, 400)
        } else {
          const previousAction = currentStatus === 'accepted' ? 'approved' : 'reported an issue with'
          throw new ApiError(`You have already ${previousAction} this invoice. Please contact the contractor if you need to make changes.`, 400)
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
      
      return serializeInvoice(updatedInvoice)
    },
  },
  jobs: {
    getAll: async (tenantId: string, startDate?: Date, endDate?: Date) => {
      await ensureTenantExists(tenantId)
      return prisma.job.findMany({
        where: {
          tenantId,
          ...(startDate || endDate
            ? {
                startTime: {
                  gte: startDate,
                  lte: endDate,
                },
              }
            : {}),
        },
        include: {
          contact: true,
          service: true,
        },
        orderBy: { startTime: 'asc' },
      })
    },
    getById: async (tenantId: string, id: string) => {
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
        include: { contact: true, service: true },
      })
      if (!job) throw new Error('Job not found')
      return job
    },
    create: async (tenantId: string, payload: any) => {
      await ensureTenantExists(tenantId)
      
      const startTime = new Date(payload.startTime)
      const endTime = new Date(payload.endTime)
      
      // If recurrence is provided, use the recurring jobs logic
      if (payload.recurrence) {
        return createRecurringJobs({
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
          assignedTo: payload.assignedTo,
          breaks: payload.breaks,
          recurrence: payload.recurrence,
        })
      }
      
      // Single job creation (existing logic)
      // Check for overlapping jobs to prevent accidental double-booking
      const overlappingJobs = await prisma.job.findMany({
        where: {
          tenantId,
          status: { in: ['scheduled', 'in-progress', 'pending-confirmation'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        include: { contact: true, service: true },
      })
      
      if (overlappingJobs.length > 0) {
        const conflictDetails = overlappingJobs.map(j => 
          `${j.title} (${new Date(j.startTime).toLocaleString()} - ${new Date(j.endTime).toLocaleString()})`
        ).join(', ')
        throw new ApiError(
          `This time slot conflicts with existing job(s): ${conflictDetails}`,
          409
        )
      }
      
      return prisma.job.create({
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
          status: payload.status || 'scheduled',
          location: payload.location,
          price: payload.price !== undefined ? payload.price : null,
          notes: payload.notes,
          assignedTo: payload.assignedTo,
          breaks: payload.breaks || null,
        },
        include: { contact: true, service: true },
      })
    },
    update: async (tenantId: string, id: string, payload: any) => {
      // Verify job belongs to tenant before updating
      const existingJob = await prisma.job.findFirst({
        where: { id, tenantId },
      })
      if (!existingJob) {
        throw new ApiError('Job not found', 404)
      }
      
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
      if (payload.price !== undefined) updateData.price = payload.price
      if (payload.notes !== undefined) updateData.notes = payload.notes
      if (payload.assignedTo !== undefined) updateData.assignedTo = payload.assignedTo
      if (payload.startTime !== undefined) updateData.startTime = new Date(payload.startTime)
      if (payload.endTime !== undefined) updateData.endTime = new Date(payload.endTime)
      if (payload.breaks !== undefined) updateData.breaks = payload.breaks
      
      return prisma.job.update({
        where: { id },
        data: updateData,
        include: { contact: true, service: true },
      })
    },
    delete: async (tenantId: string, id: string, deleteAll?: boolean) => {
      // Verify job belongs to tenant before deleting
      const job = await prisma.job.findFirst({
        where: { id, tenantId },
      })
      if (!job) {
        throw new ApiError('Job not found', 404)
      }
      
      if (deleteAll && job.recurrenceId) {
        // Delete all jobs with the same recurrenceId
        await prisma.job.deleteMany({
          where: {
            recurrenceId: job.recurrenceId,
            tenantId,
          },
        })
      } else {
        // Delete only this job
        await prisma.job.delete({ where: { id } })
      }
      
      return { success: true }
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
          
          const emailPayload = buildClientBookingConfirmedEmail({
            clientName: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
            serviceName: job.service?.name || 'Service',
            startTime: new Date(job.startTime),
            endTime: new Date(job.endTime),
            location: job.location || undefined,
          })
          
          await sendEmail({ 
            ...emailPayload, 
            to: job.contact.email,
            fromName: settings?.companyDisplayName || 'JobDock',
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
          
          const emailPayload = buildClientBookingDeclinedEmail({
            clientName: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
            serviceName: job.service?.name || 'Service',
            startTime: new Date(job.startTime),
            reason,
          })
          
          await sendEmail({ 
            ...emailPayload, 
            to: job.contact.email,
            fromName: settings?.companyDisplayName || 'JobDock',
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
          isActive: true 
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
        where: { id, tenantId } 
      })
      if (!service) {
        throw new ApiError('Service not found', 404)
      }
      const baseUrl =
        process.env.PUBLIC_APP_URL || 'https://app.jobdock.dev'
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
        workingHoursCount: availability.workingHours?.length
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
        return jobs.filter((job) => {
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
          hours: workingHours ? `${workingHours.startTime}-${workingHours.endTime}` : 'N/A'
        })

        if (workingHours && workingHours.isWorking) {
          const daySlots: { start: string; end: string }[] = []
          
          const startMinutes = timeToMinutes(workingHours.startTime)
          const endMinutes = timeToMinutes(workingHours.endTime)
          const slotDuration = duration + bufferTime

          for (let minutes = startMinutes; minutes + duration <= endMinutes; minutes += slotDuration) {
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
      return await prisma.$transaction(async (tx) => {
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
        const timezoneOffset = availability.timezoneOffset ?? -8  // Default to PST
        const startTime = new Date(payload.startTime)
        const endTime = new Date(startTime.getTime() + service.duration * 60 * 1000)
        const now = new Date()

        // 2. Validate slot timing
        if (startTime < now) {
          throw new Error('Cannot book slots in the past')
        }

        const dayOfWeek = startTime.getDay()
        const workingHours = availability?.workingHours?.find((wh: any) => wh.dayOfWeek === dayOfWeek)
        
        if (!workingHours || !workingHours.isWorking) {
          throw new Error('Service is not available on this day')
        }

        // Validate time is within working hours (accounting for timezone offset)
        // The incoming time is in UTC, working hours are in business local time
        const localStartHour = startTime.getHours() + timezoneOffset
        const localEndHour = endTime.getHours() + timezoneOffset
        const startMinutes = (localStartHour * 60) + startTime.getMinutes()
        const endMinutes = (localEndHour * 60) + endTime.getMinutes()
        const workStartMinutes = parseInt(workingHours.startTime.split(':')[0]) * 60 + parseInt(workingHours.startTime.split(':')[1])
        const workEndMinutes = parseInt(workingHours.endTime.split(':')[0]) * 60 + parseInt(workingHours.endTime.split(':')[1])

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

        // 3. Check for conflicts
        // Include pending-confirmation to prevent double-booking before confirmation
        const maxBookingsPerSlot = bookingSettings?.maxBookingsPerSlot || 1
        const conflictingJobs = await tx.job.count({
          where: {
            tenantId: actualTenantId,
            status: { in: ['scheduled', 'in-progress', 'pending-confirmation'] },
            startTime: { lt: endTime },
            endTime: { gt: startTime },
          },
        })

        if (conflictingJobs >= maxBookingsPerSlot) {
          throw new Error('This time slot is no longer available')
        }

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
                startTime: { lt: instance.endTime },
                endTime: { gt: instance.startTime },
              },
            })
            
            if (overlappingJobs >= maxBookingsPerSlot) {
              conflicts.push({
                date: instance.startTime.toISOString().split('T')[0],
                time: instance.startTime.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
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
            instances.map((instance) =>
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
          
          if (clientEmail) {
            // Send email to client
            if (requireConfirmation) {
              console.log(`📧 Sending booking request email to ${clientEmail}`)
              const emailPayload = buildClientPendingEmail({
                clientName,
                serviceName: service.name,
                startTime,
                endTime,
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
}

