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

  const dot = tone === 'ready' ? 'bg-green-500' : tone === 'info' ? 'bg-primary-gold' : 'bg-gray-400'

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">QuickBooks online payment</p>
          <p className="text-sm text-gray-500 mt-0.5">{headline}</p>
          {synced && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              {invoice.quickbooksInvoiceUrl && (
                <a
                  href={invoice.quickbooksInvoiceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-blue underline"
                >
                  View payable invoice
                </a>
              )}
              {connected && (
                <button
                  type="button"
                  onClick={handleResync}
                  disabled={syncing}
                  className="text-gray-500 underline hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
                >
                  {syncing ? 'Re-syncing…' : 'Re-sync'}
                </button>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
