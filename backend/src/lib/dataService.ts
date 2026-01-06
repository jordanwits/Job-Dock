import {
  Prisma,
  Quote,
  Invoice,
  QuoteLineItem,
  InvoiceLineItem,
  Contact,
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
} from './email'

const toNumber = (value: Prisma.Decimal | number | null | undefined) =>
  value ? Number(value) : 0

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
  notes: invoice.notes ?? undefined,
  dueDate: invoice.dueDate?.toISOString(),
  paymentTerms: invoice.paymentTerms,
  paidAmount: toNumber(invoice.paidAmount),
  createdAt: invoice.createdAt.toISOString(),
  updatedAt: invoice.updatedAt.toISOString(),
  ...withContactInfo(invoice.contact),
})

export const dataServices = {
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
          },
        }
      })
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
      const lineItems = payload.lineItems
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
            ...payload,
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
    delete: async (_tenantId: string, id: string) => {
      await prisma.quote.delete({ where: { id } })
      return { success: true }
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
    delete: async (_tenantId: string, id: string) => {
      await prisma.invoice.delete({ where: { id } })
      return { success: true }
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
          startTime,
          endTime,
          status: payload.status || 'scheduled',
          location: payload.location,
          notes: payload.notes,
          assignedTo: payload.assignedTo,
        },
        include: { contact: true, service: true },
      })
    },
    update: async (_tenantId: string, id: string, payload: any) => {
      return prisma.job.update({
        where: { id },
        data: {
          ...payload,
          startTime: payload.startTime ? new Date(payload.startTime) : undefined,
          endTime: payload.endTime ? new Date(payload.endTime) : undefined,
        },
        include: { contact: true, service: true },
      })
    },
    delete: async (_tenantId: string, id: string) => {
      await prisma.job.delete({ where: { id } })
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
          const emailPayload = buildClientBookingConfirmedEmail({
            clientName: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
            serviceName: job.service?.name || 'Service',
            startTime: new Date(job.startTime),
            endTime: new Date(job.endTime),
            location: job.location || undefined,
          })
          await sendEmail({ ...emailPayload, to: job.contact.email })
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
          const emailPayload = buildClientBookingDeclinedEmail({
            clientName: `${job.contact.firstName} ${job.contact.lastName}`.trim(),
            serviceName: job.service?.name || 'Service',
            startTime: new Date(job.startTime),
            reason,
          })
          await sendEmail({ ...emailPayload, to: job.contact.email })
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
    getById: async (tenantId: string, id: string) => {
      const service = await prisma.service.findFirst({
        where: { id, tenantId },
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
    update: async (_tenantId: string, id: string, payload: any) => {
      return prisma.service.update({
        where: { id },
        data: payload,
      })
    },
    delete: async (_tenantId: string, id: string) => {
      await prisma.service.delete({ where: { id } })
      return { success: true }
    },
    getBookingLink: async (_tenantId: string, id: string) => {
      const service = await prisma.service.findUnique({ where: { id } })
      if (!service) throw new Error('Service not found')
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
      const service = await prisma.service.findFirst({
        where: { id, tenantId },
      })
      if (!service) throw new Error('Service not found')
      if (!service.isActive) throw new Error('Service is not active')
      
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

      // Calculate date range
      const rangeStart = startDate || now
      const rangeEnd = endDate || new Date(now.getTime() + advanceBookingDays * 24 * 60 * 60 * 1000)

      // Fetch all relevant jobs in the range
      // Include pending-confirmation to prevent double-booking before confirmation
      const jobs = await prisma.job.findMany({
        where: {
          tenantId,
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
            slotsData.push({
              date: currentDay.toISOString().split('T')[0],
              slots: daySlots,
            })
          }
        }

        currentDay.setDate(currentDay.getDate() + 1)
      }

      return {
        serviceId: id,
        slots: slotsData,
      }
    },
    bookSlot: async (tenantId: string, id: string, payload: any, contractorEmail?: string) => {
      return await prisma.$transaction(async (tx) => {
        // 1. Load and validate service
        const service = await tx.service.findFirst({
          where: { id, tenantId },
        })
        if (!service) throw new Error('Service not found')
        if (!service.isActive) throw new Error('Service is not active')

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
            tenantId,
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
            where: { id: contactData.id, tenantId },
          })
          if (!contact) throw new Error('Contact not found')
        } else if (contactData.email) {
          contact = await tx.contact.findFirst({
            where: { email: contactData.email, tenantId },
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
              tenantId,
              firstName,
              lastName,
              email: contactData.email,
              phone: contactData.phone,
              company: contactData.company,
              notes: contactData.notes,
              status: 'active',
            },
          })
        }

        // 5. Create job
        // Set status based on whether confirmation is required
        const requireConfirmation = bookingSettings?.requireConfirmation ?? false
        const initialStatus = requireConfirmation ? 'pending-confirmation' : 'scheduled'
        
        const job = await tx.job.create({
          data: {
            tenantId,
            title: `${service.name} with ${contact.firstName} ${contact.lastName}`.trim(),
            contactId: contact.id,
            serviceId: service.id,
            startTime,
            endTime,
            status: initialStatus,
            location: payload.location,
            notes: payload.notes,
          },
          include: {
            contact: true,
            service: true,
          },
        })

        // 6. Send notification emails (after transaction commits)
        // Send emails synchronously to ensure they're sent before Lambda exits
        try {
          const clientEmail = contact.email
          const clientName = `${contact.firstName} ${contact.lastName}`.trim()
          
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
              await sendEmail({ ...emailPayload, to: clientEmail })
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
              await sendEmail({ ...emailPayload, to: clientEmail })
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
              clientEmail: contact.email,
              clientPhone: contact.phone,
              startTime,
              endTime,
              location: payload.location,
              isPending: requireConfirmation,
            })
            await sendEmail({ ...emailPayload, to: contractorEmail })
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

