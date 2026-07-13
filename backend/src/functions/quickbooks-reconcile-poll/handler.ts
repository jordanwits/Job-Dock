// Scheduled (daily) Lambda: poll-based fallback for QuickBooks payment reconciliation.
//
// Webhooks (lib/quickbooks/service.handleWebhook) are the PRIMARY mechanism for flowing payment
// status back from QuickBooks. This job is a safety net that catches anything a webhook missed
// (a dropped delivery, downtime, a signature mismatch) by re-reading every synced, not-yet-paid
// invoice from QuickBooks and reconciling it. Fully-paid invoices are skipped — they're terminal.

import { reconcileInvoice } from '../../lib/quickbooks/sync'
import { loadSecrets } from '../../lib/secrets'

export const handler = async () => {
  await loadSecrets()
  const { default: prismaClient } = await import('../../lib/db')
  const prisma = prismaClient as any

  const connections = await prisma.quickBooksConnection.findMany({ where: { status: 'connected' } })

  let invoicesChecked = 0
  let tenantsOk = 0
  let tenantsFailed = 0

  for (const conn of connections) {
    try {
      const openInvoices = await prisma.invoice.findMany({
        where: {
          tenantId: conn.tenantId,
          quickbooksInvoiceId: { not: null },
          paymentStatus: { not: 'paid' },
        },
        select: { quickbooksInvoiceId: true },
      })

      for (const inv of openInvoices) {
        try {
          await reconcileInvoice(conn.tenantId, String(inv.quickbooksInvoiceId))
          invoicesChecked++
        } catch (err: any) {
          console.warn(
            `[qb-reconcile-poll] tenant=${conn.tenantId} invoice=${inv.quickbooksInvoiceId} failed:`,
            err?.message
          )
        }
      }

      await prisma.quickBooksConnection.update({
        where: { tenantId: conn.tenantId },
        data: { lastSyncAt: new Date() },
      })
      tenantsOk++
    } catch (err: any) {
      tenantsFailed++
      console.error(`[qb-reconcile-poll] tenant=${conn.tenantId} failed:`, err?.message)
    }
  }

  console.log(
    `[quickbooks-reconcile-poll] tenants=${connections.length} ok=${tenantsOk} failed=${tenantsFailed} invoicesChecked=${invoicesChecked}`
  )
  return { tenants: connections.length, tenantsOk, tenantsFailed, invoicesChecked }
}
