// One-way push of JobDock data into QuickBooks Online: Contact -> Customer, Invoice -> Invoice,
// plus reading back payment status for reconciliation. JobDock remains the source of truth.

import { qboRequest } from './client'
import type { SyncInvoiceResult } from './types'

// QBO Accounting API minor version to include on all requests.
const MV = 'minorversion=70'

async function getPrisma(): Promise<any> {
  const { default: prisma } = await import('../db')
  return prisma as any
}

// ─── Customer helpers ──────────────────────────────────────────────────────────

// Query QuickBooks for an existing Customer by DisplayName; returns the QB Customer Id or null.
async function findCustomerByDisplayName(
  tenantId: string,
  displayName: string
): Promise<string | null> {
  // Single-quote escape: double any embedded single quotes per QBO query syntax.
  const escaped = displayName.replace(/'/g, "''")
  const query = encodeURIComponent(`select * from Customer where DisplayName = '${escaped}'`)
  const result = await qboRequest<any>(tenantId, 'GET', `/query?query=${query}&${MV}`)
  const customers: any[] = result?.QueryResponse?.Customer ?? []
  return customers.length ? customers[0].Id : null
}

// ─── Item helpers ──────────────────────────────────────────────────────────────

// Per-realm cache so repeated pushInvoice calls skip the QB round-trip.
const servicesItemCache = new Map<string, string>()

// Find or create a single reusable "Services" Item per QBO company (identified by tenantId).
// Every invoice line references this item; the per-line description carries the real detail.
async function findOrCreateServicesItem(tenantId: string): Promise<string> {
  const cached = servicesItemCache.get(tenantId)
  if (cached) return cached

  const itemQuery = encodeURIComponent(`select * from Item where Name = 'Services' and Type = 'Service'`)
  const itemResult = await qboRequest<any>(tenantId, 'GET', `/query?query=${itemQuery}&${MV}`)
  const items: any[] = itemResult?.QueryResponse?.Item ?? []
  if (items.length) {
    servicesItemCache.set(tenantId, items[0].Id)
    return items[0].Id
  }

  // No "Services" item yet — need an income account to create one.
  const acctQuery = encodeURIComponent(`select * from Account where AccountType = 'Income'`)
  const acctResult = await qboRequest<any>(tenantId, 'GET', `/query?query=${acctQuery}&${MV}`)
  const accounts: any[] = acctResult?.QueryResponse?.Account ?? []
  if (!accounts.length) throw new Error('No Income accounts found in this QuickBooks company')

  const created = await qboRequest<any>(tenantId, 'POST', `/item?${MV}`, {
    Name: 'Services',
    Type: 'Service',
    IncomeAccountRef: { value: accounts[0].Id },
  })
  const itemId: string = created?.Item?.Id
  if (!itemId) throw new Error('QuickBooks did not return an Item Id when creating Services item')

  servicesItemCache.set(tenantId, itemId)
  return itemId
}

// ─── Exported sync functions ───────────────────────────────────────────────────

// Ensure the JobDock contact exists as a QuickBooks Customer; returns the QB Customer Id and
// caches it on the contact for future pushes.
export async function ensureCustomer(tenantId: string, contactId: string): Promise<string> {
  const prisma = await getPrisma()
  const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } })
  if (!contact) throw new Error('Contact not found')
  if (contact.quickbooksCustomerId) return contact.quickbooksCustomerId

  const displayName =
    [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
    contact.company ||
    contact.email ||
    'Customer'

  // Check for an existing QB Customer before creating to avoid DisplayName collisions.
  const existingId = await findCustomerByDisplayName(tenantId, displayName)
  if (existingId) {
    await prisma.contact.update({ where: { id: contactId }, data: { quickbooksCustomerId: existingId } })
    return existingId
  }

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

  const result = await qboRequest<any>(tenantId, 'POST', `/customer?${MV}`, payload)
  const customerId: string = result?.Customer?.Id
  if (!customerId) throw new Error('QuickBooks did not return a Customer Id')

  await prisma.contact.update({ where: { id: contactId }, data: { quickbooksCustomerId: customerId } })
  return customerId
}

// Push a JobDock invoice to QuickBooks (create or update), enabling online card/ACH payment so
// the client receives a payable invoice with an Intuit "Pay now" link.
export async function pushInvoice(
  tenantId: string,
  invoiceId: string,
  opts: { sendEmail?: boolean } = {}
): Promise<SyncInvoiceResult> {
  const prisma = await getPrisma()
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    include: { lineItems: true, contact: true },
  })
  if (!invoice) throw new Error('Invoice not found')

  const customerId = await ensureCustomer(tenantId, invoice.contactId)
  const servicesItemId = await findOrCreateServicesItem(tenantId)

  // Map JobDock line items; every line needs an ItemRef (QBO rejects lines without one).
  const lines: any[] = (invoice.lineItems ?? []).map((li: any) => ({
    DetailType: 'SalesItemLineDetail',
    Amount: Number(li.total),
    Description: li.description ?? '',
    SalesItemLineDetail: {
      ItemRef: { value: servicesItemId },
      Qty: Number(li.quantity),
      UnitPrice: Number(li.unitPrice),
    },
  }))

  // Discount line (flat amount, must follow sales item lines).
  const discountAmount = Number(invoice.discount ?? 0)
  if (discountAmount > 0) {
    lines.push({
      DetailType: 'DiscountLineDetail',
      Amount: discountAmount,
      DiscountLineDetail: { PercentBased: false },
    })
  }

  const payload: Record<string, any> = {
    CustomerRef: { value: customerId },
    Line: lines,
    AllowOnlineCreditCardPayment: true,
    AllowOnlineACHPayment: true,
    ...(invoice.invoiceNumber ? { DocNumber: String(invoice.invoiceNumber) } : {}),
    ...(invoice.notes ? { CustomerMemo: { value: invoice.notes } } : {}),
    ...(invoice.dueDate
      ? { DueDate: new Date(invoice.dueDate).toISOString().slice(0, 10) }
      : {}),
    ...(invoice.contact?.email
      ? { BillEmail: { Address: invoice.contact.email } }
      : {}),
  }

  // Tax via TxnTaxDetail (only when there is actual tax to apply).
  const taxAmount = Number(invoice.taxAmount ?? 0)
  if (taxAmount > 0) {
    payload.TxnTaxDetail = {
      TotalTax: taxAmount,
      TaxLine: [
        {
          Amount: taxAmount,
          DetailType: 'TaxLineDetail',
          TaxLineDetail: {
            PercentBased: true,
            TaxPercent: Number(invoice.taxRate ?? 0),
            NetAmountTaxable: Number(invoice.subtotal ?? 0),
          },
        },
      ],
    }
  }

  // Include the invoiceLink param so QBO returns the shareable "Pay now" URL in the response.
  const postPath = `/invoice?${MV}&include=invoiceLink`

  let quickbooksInvoiceId: string | null = invoice.quickbooksInvoiceId ?? null
  let quickbooksInvoiceUrl: string | null = null

  if (quickbooksInvoiceId) {
    // Sparse update requires the current SyncToken — read the QB invoice first.
    const existing = await qboRequest<any>(
      tenantId,
      'GET',
      `/invoice/${quickbooksInvoiceId}?${MV}`
    )
    const syncToken: string | undefined = existing?.Invoice?.SyncToken
    if (!syncToken) throw new Error('Could not read SyncToken for existing QuickBooks invoice')

    const result = await qboRequest<any>(tenantId, 'POST', postPath, {
      ...payload,
      Id: quickbooksInvoiceId,
      SyncToken: syncToken,
      sparse: true,
    })
    quickbooksInvoiceId = result?.Invoice?.Id ?? quickbooksInvoiceId
    quickbooksInvoiceUrl = result?.Invoice?.InvoiceLink ?? null
  } else {
    const result = await qboRequest<any>(tenantId, 'POST', postPath, payload)
    quickbooksInvoiceId = result?.Invoice?.Id ?? null
    quickbooksInvoiceUrl = result?.Invoice?.InvoiceLink ?? null
  }

  if (!quickbooksInvoiceId) throw new Error('QuickBooks did not return an Invoice Id')

  // Optionally have Intuit send the payable invoice email to the client.
  if (opts.sendEmail && invoice.contact?.email) {
    try {
      await qboRequest(
        tenantId,
        'POST',
        `/invoice/${quickbooksInvoiceId}/send?sendTo=${encodeURIComponent(invoice.contact.email)}&${MV}`
      )
    } catch (err: any) {
      // Non-fatal: the invoice is created; log and continue.
      console.warn('QuickBooks invoice send email failed (non-fatal):', err?.message)
    }
  }

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

  const qb = await qboRequest<any>(tenantId, 'GET', `/invoice/${quickbooksInvoiceId}?${MV}`)
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
