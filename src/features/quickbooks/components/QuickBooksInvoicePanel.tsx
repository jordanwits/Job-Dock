import { useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import { useQuickBooksStore } from '../store/quickbooksStore'

interface QuickBooksInvoicePanelProps {
  invoice: {
    id: string
    quickbooksInvoiceId?: string | null
    quickbooksSyncStatus?: string | null
    quickbooksInvoiceUrl?: string | null
  }
  /** Called after a successful sync so the parent can refresh the invoice. */
  onSynced?: () => void
}

/**
 * Invoice-detail panel for sending an invoice to QuickBooks. Disabled (with an explanation) until
 * the tenant connects QuickBooks in Settings.
 */
export const QuickBooksInvoicePanel = ({ invoice, onSynced }: QuickBooksInvoicePanelProps) => {
  const { status, loadStatus, syncInvoice } = useQuickBooksStore()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!status) loadStatus()
  }, [status, loadStatus])

  const connected = status?.connected
  const synced = Boolean(invoice.quickbooksInvoiceId)

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
    try {
      await syncInvoice(invoice.id)
      onSynced?.()
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send to QuickBooks.')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-lg border border-black/10 dark:border-white/10 p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">QuickBooks</p>
          <p className="text-sm text-gray-500">
            {!connected
              ? 'Not connected. Connect QuickBooks in Settings to send payable invoices.'
              : synced
                ? 'This invoice is synced to QuickBooks.'
                : 'Send this invoice to QuickBooks so your client can pay online.'}
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={!connected || syncing}
          className="whitespace-nowrap"
        >
          {syncing ? 'Sending...' : synced ? 'Re-sync' : 'Send via QuickBooks'}
        </Button>
      </div>
      {invoice.quickbooksInvoiceUrl && (
        <a
          href={invoice.quickbooksInvoiceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary-blue underline"
        >
          View payable invoice
        </a>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  )
}
