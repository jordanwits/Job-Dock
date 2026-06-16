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

// A stored QuickBooks id (Customer / Invoice) can reference an entity that does not exist in the
// currently-connected company — most commonly ids cached while connected to a different (e.g.
// sandbox) company before a production cutover. QBO rejects these with 2500 "Invalid Reference Id"
// or 610 "Object Not Found".
function isStaleQbReferenceError(err: any): boolean {
  const msg = String(err?.message ?? '')
  return (
    /Invalid Reference Id/i.test(msg) ||
    /Object Not Found/i.test(msg) ||
    /"code"\s*:\s*"(2500|610)"/.test(msg)
  )
}

// Null out the QuickBooks ids cached on this invoice and its contact so the next push re-resolves
// them (find-or-create) against the currently-connected company. Also drops the per-tenant Services
// item cache, which may point at an item id from the previous company.
async function clearStaleQbRefs(tenantId: string, invoiceId: string): Promise<void> {
  const prisma = await getPrisma()
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId },
    select: { contactId: true },
  })
  if (invoice?.contactId) {
    await prisma.contact.updateMany({
      where: { id: invoice.contactId, tenantId },
      data: { quickbooksCustomerId: null },
    })
  }
  await prisma.invoice.updateMany({
    where: { id: invoiceId, tenantId },
    data: { quickbooksInvoiceId: null, quickbooksInvoiceUrl: null },
  })
  servicesItemCache.delete(tenantId)
}

// Push a JobDock invoice to QuickBooks (create or update), enabling online card/ACH payment so
// the client receives a payable invoice with an Intuit "Pay now" link. Self-heals stale references
// (ids saved against a previously-connected company) by clearing them and retrying the push once.
export async function pushInvoice(
  tenantId: string,
  invoiceId: string,
  opts: { sendEmail?: boolean } = {}
): Promise<SyncInvoiceResult> {
  try {
    return await pushInvoiceInternal(tenantId, invoiceId, opts)
  } catch (err) {
    if (!isStaleQbReferenceError(err)) throw err
    await clearStaleQbRefs(tenantId, invoiceId)
    return await pushInvoiceInternal(tenantId, invoiceId, opts)
  }
}

async function pushInvoiceInternal(
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

// ─── Reconciliation (QuickBooks payment state -> JobDock) ────────────────────────

// Sum the portion of a QB Payment that is applied to a specific QB invoice. A single QB
// payment can be split across multiple invoices, each as its own Payment.Line with a LinkedTxn.
function appliedAmountForInvoice(qbPayment: any, quickbooksInvoiceId: string): number {
  let amount = 0
  for (const line of qbPayment?.Line ?? []) {
    for (const lt of line?.LinkedTxn ?? []) {
      if (lt?.TxnType === 'Invoice' && String(lt?.TxnId) === String(quickbooksInvoiceId)) {
        amount += Number(line?.Amount ?? 0)
      }
    }
  }
  return amount
}

// Insert (or keep in sync) a JobDock Payment row mirroring a QB payment applied to an invoice.
// Deduped by (invoiceId, quickbooksPaymentId): a QB payment split across invoices yields one
// row per invoice. Returns true when a new row was created.
async function upsertPaymentRow(
  prisma: any,
  params: {
    tenantId: string
    invoiceId: string
    quickbooksPaymentId: string
    amount: number
    paymentDate?: string | null
    reference?: string | null
  }
): Promise<boolean> {
  const existing = await prisma.payment.findFirst({
    where: { invoiceId: params.invoiceId, quickbooksPaymentId: params.quickbooksPaymentId },
  })
  if (existing) {
    // Keep the amount in sync in case the payment was edited in QuickBooks.
    if (Number(existing.amount) !== params.amount) {
      await prisma.payment.update({ where: { id: existing.id }, data: { amount: params.amount } })
    }
    return false
  }
  await prisma.payment.create({
    data: {
      tenantId: params.tenantId,
      invoiceId: params.invoiceId,
      amount: params.amount,
      method: 'quickbooks',
      reference: params.reference ?? params.quickbooksPaymentId,
      quickbooksPaymentId: params.quickbooksPaymentId,
      notes: 'Recorded via QuickBooks Payments',
      ...(params.paymentDate ? { paymentDate: new Date(params.paymentDate) } : {}),
    },
  })
  return true
}

// Reconcile a QuickBooks invoice's payment state back into JobDock (called from webhook/poll):
// refresh paymentStatus/paidAmount and mirror its linked QB payments into JobDock Payment rows.
export async function reconcileInvoice(tenantId: string, quickbooksInvoiceId: string): Promise<void> {
  const prisma = await getPrisma()
  const invoice = await prisma.invoice.findFirst({ where: { tenantId, quickbooksInvoiceId } })
  if (!invoice) return

  const qb = await qboRequest<any>(tenantId, 'GET', `/invoice/${quickbooksInvoiceId}?${MV}`)
  const inv = qb?.Invoice
  const balance = Number(inv?.Balance ?? 0)
  const total = Number(inv?.TotalAmt ?? invoice.total)
  const paymentStatus = balance <= 0 ? 'paid' : balance < total ? 'partial' : 'pending'
  const paidAmount = Math.max(0, total - balance)

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paymentStatus, paidAmount },
  })

  // Mirror linked QB payments into JobDock Payment rows so the invoice's payment history matches.
  const paymentTxns = (inv?.LinkedTxn ?? []).filter((t: any) => t?.TxnType === 'Payment')
  for (const t of paymentTxns) {
    try {
      const payRes = await qboRequest<any>(tenantId, 'GET', `/payment/${t.TxnId}?${MV}`)
      const payment = payRes?.Payment
      if (!payment) continue
      const applied = appliedAmountForInvoice(payment, quickbooksInvoiceId)
      if (applied <= 0) continue
      await upsertPaymentRow(prisma, {
        tenantId,
        invoiceId: invoice.id,
        quickbooksPaymentId: String(payment.Id),
        amount: applied,
        paymentDate: payment.TxnDate,
        reference: payment.PaymentRefNum ?? String(payment.Id),
      })
    } catch (err: any) {
      console.warn(`reconcileInvoice: failed to mirror QB payment ${t?.TxnId}:`, err?.message)
    }
  }
}

// Reconcile a QuickBooks Payment back into JobDock (called from the Payment webhook). Finds the
// invoice(s) the payment is applied to and reconciles each; reconcileInvoice both refreshes the
// invoice status and upserts the Payment row, so this stays DRY.
export async function reconcilePayment(tenantId: string, quickbooksPaymentId: string): Promise<void> {
  const payRes = await qboRequest<any>(tenantId, 'GET', `/payment/${quickbooksPaymentId}?${MV}`)
  const payment = payRes?.Payment
  if (!payment) return

  const invoiceTxnIds = new Set<string>()
  for (const line of payment.Line ?? []) {
    for (const lt of line?.LinkedTxn ?? []) {
      if (lt?.TxnType === 'Invoice' && lt?.TxnId) invoiceTxnIds.add(String(lt.TxnId))
    }
  }

  for (const qbInvoiceId of invoiceTxnIds) {
    await reconcileInvoice(tenantId, qbInvoiceId)
  }
}
