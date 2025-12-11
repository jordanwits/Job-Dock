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
      return prisma.job.create({
        data: {
          tenantId,
          title: payload.title,
          description: payload.description,
          contactId: payload.contactId,
          serviceId: payload.serviceId,
          startTime: new Date(payload.startTime),
          endTime: new Date(payload.endTime),
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
  },
}

