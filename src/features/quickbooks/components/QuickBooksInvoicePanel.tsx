import { useEffect, useState } from 'react'
import { useQuickBooksStore } from '../store/quickbooksStore'

interface QuickBooksInvoicePanelProps {
  invoice: {
    id: string
    quickbooksInvoiceId?: string | null
    quickbooksSyncStatus?: string | null
    quickbooksInvoiceUrl?: string | null
  }
  /** Called after a successful re-sync so the parent can refresh the invoice. */
  onSynced?: () => void
}

/**
 * Compact QuickBooks status row in the invoice detail. Online payment is handled automatically: when
 * QuickBooks is connected with Payments enabled, **sending** the invoice creates/updates the
 * QuickBooks invoice and embeds a "Pay Now" link — there is no separate "send to QuickBooks" step.
 * This row reflects that state and offers a subtle "Re-sync" once the invoice has been pushed (e.g.
 * to push edits to QuickBooks without re-sending the email/text).
 */
export const QuickBooksInvoicePanel = ({ invoice, onSynced }: QuickBooksInvoicePanelProps) => {
  const { status, loadStatus, syncInvoice } = useQuickBooksStore()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!status) loadStatus()
  }, [status, loadStatus])

  const connected = status?.connected
  const paymentsEnabled = status?.paymentsConnected
  const synced = Boolean(invoice.quickbooksInvoiceId)

  const handleResync = async () => {
    setSyncing(true)
    setError(null)
    try {
      await syncInvoice(invoice.id)
      onSynced?.()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to sync with QuickBooks.')
    } finally {
      setSyncing(false)
    }
  }

  // Status messaging + a small colored dot reflecting how "ready to be paid online" the invoice is.
  let headline: string
  let tone: 'muted' | 'info' | 'ready' = 'muted'
  if (!connected) {
    headline = 'Connect QuickBooks in Settings to let clients pay this invoice online.'
  } else if (!paymentsEnabled) {
    headline = 'QuickBooks is connected — enable Payments in QuickBooks to let clients pay online.'
  } else if (synced) {
    headline = 'Clients can pay this invoice online. Sending includes a Pay Now link.'
    tone = 'ready'
  } else {
    headline = 'Online card & ACH payment is on. Sending this invoice will include a Pay Now link.'
    tone = 'info'
  }

  const dot = tone === 'ready' ? 'bg-success' : tone === 'info' ? 'bg-accent' : 'bg-ink-subtle'

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">QuickBooks online payment</p>
          <p className="mt-0.5 text-sm text-ink-muted">{headline}</p>
          {synced && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {invoice.quickbooksInvoiceUrl && (
                <a
                  href={invoice.quickbooksInvoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-accent-strong transition-opacity hover:opacity-70"
                >
                  View payable invoice
                </a>
              )}
              {connected && (
                <button
                  type="button"
                  onClick={handleResync}
                  disabled={syncing}
                  className="text-ink-muted underline-offset-2 transition-colors hover:text-ink hover:underline disabled:opacity-50"
                >
                  {syncing ? 'Re-syncing…' : 'Re-sync'}
                </button>
              )}
            </div>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      </div>
    </div>
  )
}
