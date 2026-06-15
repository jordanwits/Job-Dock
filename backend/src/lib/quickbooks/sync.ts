// One-way push of JobDock data into QuickBooks Online: Contact -> Customer, Invoice -> Invoice,
// plus reading back payment status for reconciliation. JobDock remains the source of truth.
//
// The Intuit DTO shapes below are scaffolded with the correct structure; the items marked
// TODO(quickbooks) need finishing once we are testing against a real sandbox company.

import { qboRequest } from './client'
import type { SyncInvoiceResult } from './types'

async function getPrisma(): Promise<any> {
  const { default: prisma } = await import('../db')
  return prisma as any
}

// Ensure the JobDock contact exists as a QuickBooks Customer; returns the QB Customer Id and
// caches it on the contact for future pushes.
export async function ensureCustomer(tenantId: string, contactId: string): Promise<string> {
  const prisma = await getPrisma()
  const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } })
  if (!contact) throw new Error('Contact not found')
  if (contact.quickbooksCustomerId) return contact.quickbooksCustomerId

  // TODO(quickbooks): before creating, query for an existing customer by DisplayName/email to
  //   avoid duplicates: GET /query?query=select * from Customer where DisplayName = '...'
  const displayName =
    [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
    contact.company ||
    contact.email ||
    'Customer'

  const payload: Record<string, unknown> = {
    DisplayName: displayName,
    ...(contact.company ? { CompanyName: contact.company } : {}),
    ...(contact.email ? { PrimaryEmailAddr: { Address: contact.email } } : {}),
    ...(contact.phone ? { PrimaryPhone: { FreeFormNumber: contact.phone } } : {}),
    ...(contact.address
      ? {
          BillAddr: {
            Line1: contact.address,
            City: contact.city,
            CountrySubDivisionCode: contact.state,
            PostalCode: contact.zipCode,
          },
        }
      : {}),
  }

  const result = await qboRequest<any>(tenantId, 'POST', '/customer', payload)
  const customerId = result?.Customer?.Id
  if (!customerId) throw new Error('QuickBooks did not return a Customer Id')

  await prisma.contact.update({
    where: { id: contactId },
    data: { quickbooksCustomerId: customerId },
  })
  return customerId
}

// Push a JobDock invoice to QuickBooks (create or update), enabling online card/ACH payment so
// the client receives a payable invoice with an Intuit "Pay now" link.
export async function pushInvoice(tenantId: string, invoiceId: string): Promise<SyncInvoiceResult> {
  const prisma = await getPrisma()
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { lineItems: true, contact: true },
  })
  if (!invoice) throw new Error('Invoice not found')

  const customerId = await ensureCustomer(tenantId, invoice.contactId)

  // TODO(quickbooks): QBO requires an ItemRef per line. For v1, look up (or create once per realm)
  //   a single "Services" Item and reference it on every line; carry the JobDock description and
  //   amounts through. Map taxes via TxnTaxDetail and discount via a DiscountLine.
  const lines = (invoice.lineItems || []).map((li: any) => ({
    DetailType: 'SalesItemLineDetail',
    Amount: Number(li.total),
    Description: li.description,
    SalesItemLineDetail: {
      // ItemRef: { value: servicesItemId }, // TODO(quickbooks)
      Qty: Number(li.quantity),
      UnitPrice: Number(li.unitPrice),
    },
  }))

  const payload: Record<string, any> = {
    CustomerRef: { value: customerId },
    Line: lines,
    AllowOnlineCreditCardPayment: true,
    AllowOnlineACHPayment: true,
    ...(invoice.dueDate ? { DueDate: new Date(invoice.dueDate).toISOString().slice(0, 10) } : {}),
    ...(invoice.contact?.email ? { BillEmail: { Address: invoice.contact.email } } : {}),
    // TODO(quickbooks): DocNumber: invoice.invoiceNumber, CustomerMemo: invoice.notes, tax/discount.
  }

  let quickbooksInvoiceId: string | null = invoice.quickbooksInvoiceId ?? null
  if (quickbooksInvoiceId) {
    // TODO(quickbooks): a sparse update requires the current SyncToken; read it first.
    const result = await qboRequest<any>(tenantId, 'POST', '/invoice', {
      ...payload,
      Id: quickbooksInvoiceId,
      sparse: true,
    })
    quickbooksInvoiceId = result?.Invoice?.Id ?? quickbooksInvoiceId
  } else {
    const result = await qboRequest<any>(tenantId, 'POST', '/invoice', payload)
    quickbooksInvoiceId = result?.Invoice?.Id ?? null
  }
  if (!quickbooksInvoiceId) throw new Error('QuickBooks did not return an Invoice Id')

  // TODO(quickbooks): optionally have Intuit email the payable invoice to the client:
  //   POST /invoice/{id}/send?sendTo=<email>
  const quickbooksInvoiceUrl: string | null = null // TODO(quickbooks): derive shareable pay link

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      quickbooksInvoiceId,
      quickbooksInvoiceUrl,
      quickbooksSyncStatus: 'synced',
      quickbooksSyncedAt: new Date(),
    },
  })

  return { quickbooksInvoiceId, quickbooksInvoiceUrl }
}

// Reconcile a QuickBooks invoice's payment state back into JobDock (called from webhook/poll).
export async function reconcileInvoice(tenantId: string, quickbooksInvoiceId: string): Promise<void> {
  const prisma = await getPrisma()
  const invoice = await prisma.invoice.findFirst({ where: { tenantId, quickbooksInvoiceId } })
  if (!invoice) return

  const qb = await qboRequest<any>(tenantId, 'GET', `/invoice/${quickbooksInvoiceId}`)
  const balance = Number(qb?.Invoice?.Balance ?? 0)
  const total = Number(qb?.Invoice?.TotalAmt ?? invoice.total)
  const paymentStatus = balance <= 0 ? 'paid' : balance < total ? 'partial' : 'pending'
  const paidAmount = Math.max(0, total - balance)

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paymentStatus, paidAmount },
  })

  // TODO(quickbooks): also read linked QB Payment(s) and insert JobDock Payment rows de-duped by
  //   quickbooksPaymentId, so the invoice's payment history mirrors QuickBooks.
}
