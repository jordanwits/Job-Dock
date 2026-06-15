import { useEffect, useState } from 'react'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useQuickBooksStore } from '@/features/quickbooks'

/**
 * Settings tab for linking a tenant's QuickBooks Online company. Owner only.
 * Mirrors the structure of BillingSection.
 */
export const QuickBooksSection = () => {
  const { theme } = useTheme()
  const { status, loading, error, loadStatus, startConnect, disconnect } = useQuickBooksStore()
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleConnect = async () => {
    setConnecting(true)
    try {
      await startConnect() // redirects the browser to Intuit
    } catch {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect QuickBooks? Invoices will stop syncing to QuickBooks.')) return
    setDisconnecting(true)
    try {
      await disconnect()
    } finally {
      setDisconnecting(false)
    }
  }

  const connected = status?.connected

  return (
    <div className="space-y-6">
      <div>
        <h2
          className={cn(
            'text-xl font-semibold',
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}
        >
          QuickBooks
        </h2>
        <p
          className={cn(
            'mt-1 text-sm',
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}
        >
          Link your QuickBooks Online company to send payable invoices and accept payments through
          QuickBooks Payments. Payment status flows back into JobDock automatically.
        </p>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <p className="text-sm text-red-400">{error}</p>
        </Card>
      )}

      <Card>
        {loading && !status ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <span className="font-medium">Connected</span>
              {status?.realmId && (
                <span className="text-sm text-gray-500">(Company {status.realmId})</span>
              )}
            </div>
            <ul className="space-y-1 text-sm">
              <li>
                QuickBooks Payments:{' '}
                {status?.paymentsConnected
                  ? 'Enabled'
                  : 'Not enabled - clients cannot pay online yet'}
              </li>
              {status?.lastSyncAt && (
                <li>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</li>
              )}
              {status?.lastErrorMessage && (
                <li className="text-red-500">Last error: {status.lastErrorMessage}</li>
              )}
            </ul>
            <Button
              onClick={handleDisconnect}
              disabled={disconnecting}
              variant="ghost"
              className="text-red-500"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect QuickBooks'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">QuickBooks is not connected.</p>
            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="bg-primary-blue text-primary-light"
            >
              {connecting ? 'Redirecting...' : 'Connect QuickBooks'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}
