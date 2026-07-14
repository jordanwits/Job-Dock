// One-way push of CleanDock data into QuickBooks Online: Contact -> Customer, Invoice -> Invoice,
// plus reading back payment status for reconciliation. CleanDock remains the source of truth.

import { qboRequest, getConnectionRecord } from './client'
import type { SyncInvoiceResult } from './types'

// QBO Accounting API minor version to include on all requests.
const MV = 'minorversion=70'

async function getPrisma(): Promise<any> {
  const { default: prisma } = await import('../db')
  return prisma as any
}

// ─── Customer helpers ──────────────────────────────────────────────────────────

// Query QuickBooks for an existing Customer by DisplayName — INCLUDING inactive ones (QBO queries
// exclude them by default). An inactive customer still owns its name in QBO's shared name list,
// so create attempts collide with 6240 "Duplicate Name Exists"; seen in prod after the owner's QB
// subscription lapse deactivated records. Returns the raw QB Customer object or null.
async function findCustomerByDisplayName(tenantId: string, displayName: string): Promise<any | null> {
  // QBO query escaping is backslash-based (not SQL-style quote doubling): escape backslashes,
  // then single quotes, per Intuit's data-queries docs.
  const escaped = displayName.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
  const query = encodeURIComponent(
    `select * from Customer where DisplayName = '${escaped}' and Active in (true, false)`
  )
  const result = await qboRequest<any>(tenantId, 'GET', `/query?query=${query}&${MV}`)
  const customers: any[] = result?.QueryResponse?.Customer ?? []
  return customers.length ? customers[0] : null
}

// Best-effort reactivation of an inactive QB Customer via sparse update (QBO rejects invoice
// references to inactive entities with 610). Optionally restores the original DisplayName when
// QBO's deactivation renamed it to "Name (deleted)". Returns false when QBO refuses — e.g. a
// sub-customer whose parent is also inactive — so callers can fall back to find-or-create.
async function tryReactivateCustomer(
  tenantId: string,
  customer: any,
  restoreName?: string
): Promise<boolean> {
  try {
    console.log(
      `[quickbooks] reactivating inactive QB customer ${customer.Id} (${customer.DisplayName})`
    )
    await qboRequest<any>(tenantId, 'POST', `/customer?${MV}`, {
      Id: customer.Id,
      SyncToken: customer.SyncToken,
      sparse: true,
      Active: true,
      ...(restoreName ? { DisplayName: restoreName } : {}),
    })
    return true
  } catch (err: any) {
    console.warn(`[quickbooks] could not reactivate QB customer ${customer.Id}:`, err?.message)
    return false
  }
}

// Verify a cached QB Customer id against the currently-connected company before referencing it
// on an invoice. Returns the id when usable (reactivating it if needed), or null when it should
// be re-resolved by name: the id doesn't exist in this company, it resolves to a DIFFERENT
// customer (numeric ids collide across QB companies, so a stale id from a previous realm can
// point at an unrelated record), or it's inactive and can't be reactivated. Referencing a bad id
// would fail the push with 610, and the stale-ref self-heal would then discard the invoice's QB
// id and re-create it — duplicating the invoice in the books.
// Identity = DisplayName match (tolerating our "(CleanDock)" suffix and QBO's rename-on-
// deactivate "(deleted)" suffix) OR a PrimaryEmailAddr match, so an owner-side rename in
// QuickBooks doesn't orphan the mapping and mint a duplicate customer.
async function verifyCachedCustomer(
  tenantId: string,
  customerId: string,
  expectedDisplayName: string,
  contactEmail?: string | null
): Promise<string | null> {
  let cached: any
  try {
    const res = await qboRequest<any>(tenantId, 'GET', `/customer/${customerId}?${MV}`)
    cached = res?.Customer
  } catch (err) {
    if (isStaleQbReferenceError(err)) return null
    throw err
  }
  if (!cached) return null

  const rawName = String(cached.DisplayName ?? '')
  const deactivationRenamed = / \(deleted\)$/i.test(rawName)
  const baseName = rawName.replace(/ \(deleted\)$/i, '')
  const nameMatches =
    baseName === expectedDisplayName || baseName === `${expectedDisplayName} (CleanDock)`
  const qbEmail = String(cached.PrimaryEmailAddr?.Address ?? '').toLowerCase()
  const emailMatches = Boolean(contactEmail) && qbEmail === String(contactEmail).toLowerCase()
  if (!nameMatches && !emailMatches) return null

  if (cached.Active === false) {
    const restoreName = deactivationRenamed && nameMatches ? baseName : undefined
    if (!(await tryReactivateCustomer(tenantId, cached, restoreName))) return null
  }
  return customerId
}

// QBO error 6240 "Duplicate Name Exists": the DisplayName is held by an entity our Customer query
// cannot see — customers share one name-list namespace with vendors and employees, and inactive
// records that QBO renamed on deactivation can still collide on create.
function isDuplicateNameError(err: any): boolean {
  const msg = String(err?.message ?? '')
  return /Duplicate Name Exists/i.test(msg) || /"code"\s*:\s*"6240"/.test(msg)
}

// ─── Item helpers ──────────────────────────────────────────────────────────────

// Per-tenant+realm cache so repeated pushInvoice calls skip the QB round-trip. The key MUST
// include the realm: item ids are realm-scoped and collide across QB companies, so after a
// reconnect to a different company a tenant-only key on a warm Lambda instance would silently
// embed the previous company's item id in new invoices.
const servicesItemCache = new Map<string, string>()

// Query for an Item by WHERE clause, INCLUDING inactive rows (an inactive item still owns its
// name and would fail create with Duplicate Name Exists). Prefers an active match: Item.Name is
// only the leaf name, so an inactive sub-item can shadow the active top-level one.
async function queryItem(tenantId: string, where: string): Promise<any | null> {
  const q = encodeURIComponent(`select * from Item where ${where} and Active in (true, false)`)
  const result = await qboRequest<any>(tenantId, 'GET', `/query?query=${q}&${MV}`)
  const items: any[] = result?.QueryResponse?.Item ?? []
  if (!items.length) return null
  return items.find((i: any) => i.Active !== false) ?? items[0]
}

// Reactivate an inactive QB Item. Sparse updates are documented for Customer but reported
// inconsistent for Item across QBO stacks — fall back to a full update from the queried entity.
async function reactivateItem(tenantId: string, item: any): Promise<void> {
  try {
    await qboRequest<any>(tenantId, 'POST', `/item?${MV}`, {
      Id: item.Id,
      SyncToken: item.SyncToken,
      sparse: true,
      Active: true,
    })
  } catch {
    await qboRequest<any>(tenantId, 'POST', `/item?${MV}`, { ...item, Active: true })
  }
}

// Find or create a single reusable "Services" Item per QBO company (identified by tenantId).
// Every invoice line references this item; the per-line description carries the real detail.
async function findOrCreateServicesItem(tenantId: string): Promise<string> {
  const record = await getConnectionRecord(tenantId)
  const cacheKey = `${tenantId}:${record?.realmId ?? 'unknown'}`
  const cached = servicesItemCache.get(cacheKey)
  if (cached) return cached

  const existing = await queryItem(tenantId, `Name = 'Services' and Type = 'Service'`)
  if (existing) {
    if (existing.Active === false) await reactivateItem(tenantId, existing)
    servicesItemCache.set(cacheKey, existing.Id)
    return existing.Id
  }

  // No "Services" item yet — need an income account to create one.
  const acctQuery = encodeURIComponent(`select * from Account where AccountType = 'Income'`)
  const acctResult = await qboRequest<any>(tenantId, 'GET', `/query?query=${acctQuery}&${MV}`)
  const accounts: any[] = acctResult?.QueryResponse?.Account ?? []
  if (!accounts.length) throw new Error('No Income accounts found in this QuickBooks company')

  let created: any
  try {
    created = await qboRequest<any>(tenantId, 'POST', `/item?${MV}`, {
      Name: 'Services',
      Type: 'Service',
      IncomeAccountRef: { value: accounts[0].Id },
    })
  } catch (err) {
    if (!isDuplicateNameError(err)) throw err
    // The name is held by an item the typed query couldn't see (a different Type — item names
    // are unique across ALL types — or an inactive row the combined filter missed). Reuse and
    // reactivate whatever holds it — except a Category, which cannot be referenced from an
    // invoice line; for that, fall through to the disambiguated create.
    const holder = await queryItem(tenantId, `Name = 'Services'`)
    if (holder && holder.Type !== 'Category') {
      if (holder.Active === false) await reactivateItem(tenantId, holder)
      servicesItemCache.set(cacheKey, holder.Id)
      return holder.Id
    }
    created = await qboRequest<any>(tenantId, 'POST', `/item?${MV}`, {
      Name: 'Services (CleanDock)',
      Type: 'Service',
      IncomeAccountRef: { value: accounts[0].Id },
    })
  }
  const itemId: string = created?.Item?.Id
  if (!itemId) throw new Error('QuickBooks did not return an Item Id when creating Services item')

  servicesItemCache.set(cacheKey, itemId)
  return itemId
}

// ─── Exported sync functions ───────────────────────────────────────────────────

// Ensure the CleanDock contact exists as a QuickBooks Customer; returns the QB Customer Id and
// caches it on the contact for future pushes.
export async function ensureCustomer(tenantId: string, contactId: string): Promise<string> {
  const prisma = await getPrisma()
  const contact = await prisma.contact.findFirst({ where: { id: contactId, tenantId } })
  if (!contact) throw new Error('Contact not found')

  const displayName =
    [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
    contact.company ||
    contact.email ||
    'Customer'

  if (contact.quickbooksCustomerId) {
    const verified = await verifyCachedCustomer(
      tenantId,
      contact.quickbooksCustomerId,
      displayName,
      contact.email
    )
    if (verified) return verified
    // Cached id unusable (gone from this company, points at a different customer after a company
    // switch, or stuck inactive) — fall through and re-resolve by name.
  }

  // Check for an existing QB Customer before creating to avoid DisplayName collisions. If it
  // exists but was made inactive (e.g. records deactivated during a QB subscription lapse),
  // reactivate it so the invoice push can reference it.
  const existing = await findCustomerByDisplayName(tenantId, displayName)
  if (existing && (existing.Active !== false || (await tryReactivateCustomer(tenantId, existing)))) {
    await prisma.contact.update({
      where: { id: contactId },
      data: { quickbooksCustomerId: existing.Id },
    })
    return existing.Id
  }
  // If the name's owner exists but can't be reactivated, fall through to create — the
  // Duplicate Name fallback below will disambiguate.

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

  let result: any
  try {
    result = await qboRequest<any>(tenantId, 'POST', `/customer?${MV}`, payload)
  } catch (err: any) {
    if (!isDuplicateNameError(err)) throw err
    // The name is taken by something the Customer query can't see (vendor/employee in the shared
    // name list, or a renamed inactive record). Fall back to a disambiguated DisplayName rather
    // than failing the whole invoice sync — reusing it if a previous run already created it.
    const fallbackName = `${displayName} (CleanDock)`
    const fallbackExisting = await findCustomerByDisplayName(tenantId, fallbackName)
    if (
      fallbackExisting &&
      (fallbackExisting.Active !== false ||
        (await tryReactivateCustomer(tenantId, fallbackExisting)))
    ) {
      result = { Customer: fallbackExisting }
    } else {
      result = await qboRequest<any>(tenantId, 'POST', `/customer?${MV}`, {
        ...payload,
        DisplayName: fallbackName,
      })
    }
  }
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
  if (err?.staleQbRef === true) return true
  const msg = String(err?.message ?? '')
  return (
    /Invalid Reference Id/i.test(msg) ||
    /Object Not Found/i.test(msg) ||
    /"code"\s*:\s*"(2500|610)"/.test(msg)
  )
}

// Null out the QuickBooks ids cached on this invoice and its contact so the next push re-resolves
// them (find-or-create) against the currently-connected company. Also drops the tenant's Services
// item cache entries, which may point at an item id from the previous company.
// keepInvoiceRefs: when the stale reference was INSIDE the payload (customer/item) of an
// already-identity-verified invoice update, the invoice id itself is good — clearing it would
// make the retry CREATE a duplicate QB invoice while the original stays open.
async function clearStaleQbRefs(
  tenantId: string,
  invoiceId: string,
  opts: { keepInvoiceRefs?: boolean } = {}
): Promise<void> {
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
  if (!opts.keepInvoiceRefs) {
    await prisma.invoice.updateMany({
      where: { id: invoiceId, tenantId },
      data: { quickbooksInvoiceId: null, quickbooksInvoiceUrl: null },
    })
  }
  for (const key of Array.from(servicesItemCache.keys())) {
    if (key.startsWith(`${tenantId}:`)) servicesItemCache.delete(key)
  }
}

// Push a CleanDock invoice to QuickBooks (create or update), enabling online card/ACH payment so
// the client receives a payable invoice with an Intuit "Pay now" link. Self-heals stale references
// (ids saved against a previously-connected company) by clearing them and retrying the push once.
export async function pushInvoice(
  tenantId: string,
  invoiceId: string,
  opts: { sendEmail?: boolean } = {}
): Promise<SyncInvoiceResult> {
  try {
    return await pushInvoiceInternal(tenantId, invoiceId, opts)
  } catch (err: any) {
    if (!isStaleQbReferenceError(err)) throw err
    await clearStaleQbRefs(tenantId, invoiceId, { keepInvoiceRefs: err?.invoiceVerified === true })
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

  // Map CleanDock line items; every line needs an ItemRef (QBO rejects lines without one).
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

    // Numeric ids collide across QB companies: after a company switch, a cached id can resolve
    // to an unrelated invoice in the new company. Our pushes ALWAYS set DocNumber from
    // invoiceNumber, so a QB invoice whose DocNumber differs (or is missing) is not ours —
    // flag it stale so the self-heal clears refs and re-creates instead of clobbering it.
    // (Customer is deliberately NOT part of this identity check: a contact change on the
    // invoice must still update it, and a same-customer id collision would pass anyway.)
    const qbDocNumber = existing?.Invoice?.DocNumber
    if (invoice.invoiceNumber && String(qbDocNumber ?? '') !== String(invoice.invoiceNumber)) {
      throw Object.assign(
        new Error(
          `Cached QuickBooks invoice ${quickbooksInvoiceId} has DocNumber ${qbDocNumber ?? '(none)'} (expected ${invoice.invoiceNumber}); treating as a stale cross-company reference`
        ),
        { staleQbRef: true }
      )
    }

    let result: any
    try {
      result = await qboRequest<any>(tenantId, 'POST', postPath, {
        ...payload,
        Id: quickbooksInvoiceId,
        SyncToken: syncToken,
        sparse: true,
      })
    } catch (err: any) {
      // The invoice id itself was just GET-verified by DocNumber — a stale-ref error here means
      // a stale customer/item reference INSIDE the payload, not a stale invoice. Mark it so the
      // self-heal keeps the invoice id and only re-resolves the payload references; otherwise
      // the retry would CREATE a duplicate QB invoice while the original stays open.
      if (isStaleQbReferenceError(err)) err.invoiceVerified = true
      throw err
    }
    quickbooksInvoiceId = result?.Invoice?.Id ?? quickbooksInvoiceId
    // Keep the previously stored pay link if the sparse-update response omits InvoiceLink —
    // never downgrade a working link to null on a re-send.
    quickbooksInvoiceUrl = result?.Invoice?.InvoiceLink ?? invoice.quickbooksInvoiceUrl ?? null
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

// ─── Reconciliation (QuickBooks payment state -> CleanDock) ────────────────────────

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

// Insert (or keep in sync) a CleanDock Payment row mirroring a QB payment applied to an invoice.
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

// Reconcile a QuickBooks invoice's payment state back into CleanDock (called from webhook/poll):
// refresh paymentStatus/paidAmount and mirror its linked QB payments into CleanDock Payment rows.
export async function reconcileInvoice(tenantId: string, quickbooksInvoiceId: string): Promise<void> {
  const prisma = await getPrisma()
  const invoice = await prisma.invoice.findFirst({ where: { tenantId, quickbooksInvoiceId } })
  if (!invoice) return

  const qb = await qboRequest<any>(tenantId, 'GET', `/invoice/${quickbooksInvoiceId}?${MV}`)
  const inv = qb?.Invoice

  // Identity check before writing anything back: cached QB ids can be stale after a company
  // switch, and numeric ids collide across QB companies — a stale id here would let an UNRELATED
  // invoice in the new company drive our paymentStatus/paidAmount and mint phantom Payment rows
  // (the nightly poll and webhook both land here with no user action). Our pushes always set
  // DocNumber from invoiceNumber, so a mismatch (or a missing QB invoice) means "not ours": skip.
  if (invoice.invoiceNumber && String(inv?.DocNumber ?? '') !== String(invoice.invoiceNumber)) {
    console.warn(
      `[quickbooks] reconcileInvoice: QB invoice ${quickbooksInvoiceId} DocNumber ${inv?.DocNumber ?? '(none)'} does not match invoice ${invoice.invoiceNumber}; skipping stale cross-company reference`
    )
    return
  }

  const balance = Number(inv?.Balance ?? 0)
  const total = Number(inv?.TotalAmt ?? invoice.total)
  const paymentStatus = balance <= 0 ? 'paid' : balance < total ? 'partial' : 'pending'
  const paidAmount = Math.max(0, total - balance)

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { paymentStatus, paidAmount },
  })

  // Mirror linked QB payments into CleanDock Payment rows so the invoice's payment history matches.
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

// Reconcile a QuickBooks Payment back into CleanDock (called from the Payment webhook). Finds the
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
