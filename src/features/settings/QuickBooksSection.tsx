import { useEffect, useState } from 'react'
import { useQuickBooksStore } from '@/features/quickbooks'
import { AppButton, Panel, SettingsSection, Alert, AlertIcon, Dot } from './settingsUi'

/**
 * Settings tab for linking a tenant's QuickBooks Online company. Owner only.
 * Mirrors the structure of BillingSection.
 */
export const QuickBooksSection = () => {
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
    <SettingsSection
      title="QuickBooks"
      description="Link your QuickBooks Online company to send payable invoices and accept payments through QuickBooks Payments. Payment status flows back into JobDock automatically."
    >
      {error && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
          {error}
        </Alert>
      )}

      <Panel className="p-5">
        {loading && !status ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : connected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Dot tone="success" />
              <span className="font-medium text-ink">Connected</span>
              {status?.realmId && (
                <span className="font-mono text-sm tabular-nums text-ink-subtle">
                  (Company {status.realmId})
                </span>
              )}
            </div>
            <ul className="space-y-1.5 text-sm text-ink-muted">
              <li>
                QuickBooks Payments:{' '}
                {status?.paymentsConnected
                  ? 'Enabled'
                  : 'Not enabled — clients cannot pay online yet'}
              </li>
              {status?.lastSyncAt && (
                <li>Last sync: {new Date(status.lastSyncAt).toLocaleString()}</li>
              )}
              {status?.lastErrorMessage && (
                <li className="text-danger">Last error: {status.lastErrorMessage}</li>
              )}
            </ul>
            <AppButton onClick={handleDisconnect} isLoading={disconnecting} variant="dangerGhost">
              {disconnecting ? 'Disconnecting…' : 'Disconnect QuickBooks'}
            </AppButton>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-ink-muted">QuickBooks is not connected.</p>
            <AppButton onClick={handleConnect} isLoading={connecting}>
              {connecting ? 'Redirecting…' : 'Connect QuickBooks'}
            </AppButton>
          </div>
        )}
      </Panel>
    </SettingsSection>
  )
}
