import { useEffect, useState } from 'react'
import { useAuthStore } from '@/features/auth'
import { useGoogleCalendarStore, type GoogleCalendarSyncMode } from '@/features/googleCalendar'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import {
  AppButton,
  Panel,
  SettingsSection,
  SettingsModal,
  Alert,
  AlertIcon,
  Dot,
  InfoPanel,
  CheckboxField,
  SelectField,
} from './settingsUi'

const SYNC_MODE_OPTIONS: Array<{ value: GoogleCalendarSyncMode; label: string }> = [
  { value: 'all', label: 'All company appointments' },
  { value: 'mine', label: 'Only appointments assigned to me' },
]

/** A single token-styled radio row, matching the CheckboxField visual language. */
function RadioRow({
  name,
  value,
  checked,
  onChange,
  label,
  description,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  label: string
  description?: string
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
        <input
          type="radio"
          name={name}
          value={value}
          checked={checked}
          onChange={onChange}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-full border border-line-strong bg-surface outline-none transition-colors checked:border-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        />
        <span className="pointer-events-none absolute h-2 w-2 rounded-full bg-accent-strong opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[13px] leading-relaxed text-ink-subtle">
            {description}
          </span>
        )}
      </span>
    </label>
  )
}

interface GoogleCalendarSectionProps {
  /** Error carried back from the OAuth callback (e.g. consent declined) — shown near the buttons. */
  connectError?: string | null
}

/**
 * Settings tab for the per-user Google Calendar sync. One-way: JobDock pushes appointments to a
 * dedicated Google calendar; changes made in Google are not read back. Visible to every role
 * (each user connects their own Google account); the sync-mode choice is gated on the
 * server-authoritative `canChooseAll` flag. Mirrors QuickBooksSection's structure and the
 * teal settings design language.
 */
export const GoogleCalendarSection = ({ connectError }: GoogleCalendarSectionProps) => {
  const { user } = useAuthStore()
  const { status, loading, error, loadStatus, startConnect, disconnect, updateSyncMode, syncNow } =
    useGoogleCalendarStore()

  // The connect radios start unset; the effective default is derived from the server-authoritative
  // canChooseAll once status loads (see defaultMode below). The role heuristic is only a placeholder
  // before the first status fetch resolves — and the radios aren't even rendered until then.
  const [selectedMode, setSelectedMode] = useState<GoogleCalendarSyncMode | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [savingMode, setSavingMode] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncQueued, setSyncQueued] = useState(false)
  const [showDisconnectModal, setShowDisconnectModal] = useState(false)
  const [removeCalendar, setRemoveCalendar] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState<string | null>(null)

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  // Auto-clear the transient "Sync queued" confirmation.
  useEffect(() => {
    if (!syncQueued) return
    const t = setTimeout(() => setSyncQueued(false), 4000)
    return () => clearTimeout(t)
  }, [syncQueued])

  const configured = status?.configured ?? false
  const connected = status?.connected ?? false
  const inError = status?.status === 'error'
  const canChooseAll = status?.canChooseAll ?? false
  const currentMode = status?.syncMode ?? 'all'
  const sectionError = connectError || error

  // Default the connect radios from the server-authoritative capability once status is loaded
  // (canChooseAll ⇒ 'all', else 'mine'); fall back to the role heuristic only before status arrives
  // (F15). A user's explicit radio choice (selectedMode) always wins over the derived default.
  const defaultMode: GoogleCalendarSyncMode = status
    ? canChooseAll
      ? 'all'
      : 'mine'
    : user?.role === 'owner' || user?.role === 'admin'
      ? 'all'
      : 'mine'
  const effectiveMode: GoogleCalendarSyncMode = selectedMode ?? defaultMode

  const handleConnect = async (mode: GoogleCalendarSyncMode) => {
    setConnecting(true)
    try {
      // Server clamps too, but only send 'all' when this user is allowed to choose it.
      await startConnect(canChooseAll ? mode : 'mine')
      // On success the browser is redirected to Google, so we never fall through here.
    } catch {
      setConnecting(false)
    }
  }

  const handleReconnect = () => handleConnect(status?.syncMode ?? defaultMode)

  const handleChangeMode = async (mode: GoogleCalendarSyncMode) => {
    if (mode === currentMode) return
    setSavingMode(true)
    try {
      await updateSyncMode(mode)
    } catch {
      // Error is surfaced via the store's `error` (section-level alert).
    } finally {
      setSavingMode(false)
    }
  }

  const handleSyncNow = async () => {
    setSyncing(true)
    try {
      await syncNow()
      setSyncQueued(true)
    } catch {
      // Error is surfaced via the store's `error` (section-level alert).
    } finally {
      setSyncing(false)
    }
  }

  const openDisconnect = () => {
    setRemoveCalendar(true)
    setDisconnectError(null)
    setShowDisconnectModal(true)
  }

  const handleConfirmDisconnect = async () => {
    setDisconnecting(true)
    setDisconnectError(null)
    try {
      await disconnect(removeCalendar)
      setShowDisconnectModal(false)
    } catch (err) {
      setDisconnectError(
        getErrorMessage(err, 'Failed to disconnect Google Calendar. Please try again.')
      )
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <SettingsSection
      title="Google Calendar"
      description="Show your JobDock appointments on your Google Calendar."
    >
      {sectionError && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
          {sectionError}
        </Alert>
      )}

      <Panel className="p-5">
        {loading && !status ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : !configured ? (
          /* State 1 — not configured for this server (also the mock/demo state). */
          <p className="text-sm text-ink-muted">
            Google Calendar sync isn&apos;t configured for this server.
          </p>
        ) : inError ? (
          /* State 4 — connection is in an error state. */
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Dot tone="warning" />
              <span className="font-medium text-ink">Sync error</span>
              {status?.googleEmail && (
                <span className="text-sm text-ink-muted">{status.googleEmail}</span>
              )}
            </div>
            <Alert tone="warning" icon={<AlertIcon className="h-4 w-4" />}>
              {status?.lastErrorMessage ||
                'Google Calendar sync ran into a problem. Reconnect to resume syncing.'}
            </Alert>
            <div className="flex flex-wrap items-center gap-3">
              <AppButton onClick={handleReconnect} isLoading={connecting}>
                {connecting ? 'Redirecting…' : 'Reconnect'}
              </AppButton>
              {/* Always offer Disconnect here: `connected` is provably false whenever status is
                  'error', so the old `connected &&` gate stranded errored users with no way to
                  disconnect / remove their tokens + calendar (F7). */}
              <AppButton variant="dangerGhost" onClick={openDisconnect}>
                Disconnect
              </AppButton>
            </div>
          </div>
        ) : connected ? (
          /* State 3 — connected and healthy. */
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Dot tone="success" />
              <span className="font-medium text-ink">Connected</span>
              {status?.googleEmail && (
                <span className="text-sm text-ink-muted">{status.googleEmail}</span>
              )}
            </div>

            <ul className="space-y-1.5 text-sm text-ink-muted">
              <li>
                Last synced:{' '}
                {status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString() : 'Not yet'}
              </li>
              <li>New and updated appointments appear on your Google Calendar within a few minutes.</li>
            </ul>

            <div className="max-w-xs">
              <SelectField
                label="Which appointments sync"
                aria-label="Which appointments sync"
                value={currentMode}
                disabled={!canChooseAll || savingMode}
                onChange={e => handleChangeMode(e.target.value as GoogleCalendarSyncMode)}
                options={SYNC_MODE_OPTIONS}
                helperText={!canChooseAll ? 'Set by your account owner.' : undefined}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <AppButton variant="subtle" onClick={handleSyncNow} isLoading={syncing}>
                {syncing ? 'Syncing…' : 'Sync now'}
              </AppButton>
              <AppButton variant="dangerGhost" onClick={openDisconnect}>
                Disconnect
              </AppButton>
              {syncQueued && <span className="text-sm font-medium text-success">Sync queued</span>}
            </div>
          </div>
        ) : (
          /* State 2 — configured but not connected. */
          <div className="space-y-5">
            <div className="space-y-2 text-sm leading-relaxed text-ink-muted">
              <p>
                Connect your Google account to see your JobDock appointments on your Google
                Calendar. JobDock creates a dedicated{' '}
                <span className="font-medium text-ink">JobDock</span> calendar in your Google account
                and keeps your appointments on it.
              </p>
              <p>
                Sync is one-way, from JobDock to Google — changes you make in Google Calendar
                won&apos;t affect JobDock.
              </p>
            </div>

            {canChooseAll ? (
              <fieldset className="space-y-3">
                <legend className="mb-1 text-sm font-medium text-ink">
                  Which appointments should sync?
                </legend>
                <RadioRow
                  name="gcal-sync-mode"
                  value="all"
                  checked={effectiveMode === 'all'}
                  onChange={() => setSelectedMode('all')}
                  label="All company appointments"
                  description="Every appointment on the schedule syncs to your calendar."
                />
                <RadioRow
                  name="gcal-sync-mode"
                  value="mine"
                  checked={effectiveMode === 'mine'}
                  onChange={() => setSelectedMode('mine')}
                  label="Only appointments assigned to me"
                  description="Only appointments you're assigned to sync to your calendar."
                />
              </fieldset>
            ) : (
              <InfoPanel>Appointments assigned to you will sync to your Google Calendar.</InfoPanel>
            )}

            <AppButton onClick={() => handleConnect(effectiveMode)} isLoading={connecting}>
              {connecting ? 'Redirecting…' : 'Connect Google Calendar'}
            </AppButton>
          </div>
        )}
      </Panel>

      <SettingsModal
        isOpen={showDisconnectModal}
        onClose={() => {
          if (!disconnecting) setShowDisconnectModal(false)
        }}
        title="Disconnect Google Calendar"
        size="sm"
        footer={
          <>
            <AppButton
              variant="subtle"
              onClick={() => setShowDisconnectModal(false)}
              disabled={disconnecting}
            >
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleConfirmDisconnect} isLoading={disconnecting}>
              {disconnecting ? 'Disconnecting…' : 'Disconnect'}
            </AppButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-ink-muted">
            JobDock will stop syncing your appointments to Google Calendar.
          </p>
          <CheckboxField
            id="gcal-remove-calendar"
            checked={removeCalendar}
            onChange={setRemoveCalendar}
            label="Also remove the JobDock calendar from my Google account"
            description="Deletes the dedicated JobDock calendar and its synced events from Google."
          />
          {disconnectError && (
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
              {disconnectError}
            </Alert>
          )}
        </div>
      </SettingsModal>
    </SettingsSection>
  )
}
