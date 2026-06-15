/**
 * Quick smoke-test for the QuickBooks invoice push (Phase 2).
 * Usage: npx tsx scripts/test-qb-invoice-sync.ts [invoiceId]
 *
 * Picks up credentials from .env.local; requires a connected QuickBooks sandbox company
 * for the tenant that owns the given invoice. If no invoiceId is passed, uses the first
 * invoice found for the first connected tenant.
 */
import './bootstrapLocalEnv'
import prisma from '../src/lib/db'
import { pushInvoice } from '../src/lib/quickbooks/sync'

async function main() {
  const argInvoiceId = process.argv[2]

  // Find a tenant that has a connected QuickBooks sandbox connection.
  const conn = await (prisma as any).quickBooksConnection.findFirst({
    where: { status: 'connected' },
    orderBy: { lastRefreshedAt: 'desc' },
  })
  if (!conn) {
    console.error('No connected QuickBooks tenant found. Run the connect flow in Settings first.')
    process.exit(1)
  }
  console.log(`Using tenant ${conn.tenantId} (realmId: ${conn.realmId})`)

  // Find an invoice to push.
  let invoiceId = argInvoiceId
  if (!invoiceId) {
    const invoice = await prisma.invoice.findFirst({
      where: { tenantId: conn.tenantId },
      orderBy: { createdAt: 'desc' },
    })
    if (!invoice) {
      console.error('No invoices found for this tenant.')
      process.exit(1)
    }
    invoiceId = invoice.id
    console.log(`No invoiceId arg — using most recent invoice: ${invoiceId}`)
  }

  console.log(`Pushing invoice ${invoiceId} to QuickBooks sandbox...`)
  const result = await pushInvoice(conn.tenantId, invoiceId, { sendEmail: false })
  console.log('Success:', result)
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err?.message ?? err)
  process.exit(1)
})
