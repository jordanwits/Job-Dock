import { useState } from 'react'
import { services } from '@/lib/api/services'
import {
  AppButton,
  Panel,
  TextField,
  TextAreaField,
  SelectField,
  CheckboxField,
  Alert,
  AlertIcon,
  InfoPanel,
  CodeChip,
  CopyIcon,
  CheckIcon,
  TrashIcon,
  StatusBadge,
  type Tone,
} from './settingsUi'

type TesterPlan = 'solo' | 'team' | 'team-plus'

function platformAdminEmails(): string[] {
  const raw = (import.meta.env.VITE_PLATFORM_ADMIN_EMAILS || 'jordan@westwavecreative.com').trim()
  return raw
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isTesterApprovalUiVisible(email: string | undefined): boolean {
  if (!email) return false
  const n = email.trim().toLowerCase()
  return platformAdminEmails().includes(n)
}

const PLAN_OPTIONS = [
  { value: 'solo', label: 'Solo' },
  { value: 'team', label: 'Team' },
  { value: 'team-plus', label: 'Team+' },
]

/** Labeled, copyable link row (reused for the set-password and checkout links). */
function LinkBox({
  label,
  url,
  copied,
  onCopy,
}: {
  label: string
  url: string
  copied: boolean
  onCopy: () => void
}) {
  return (
    <div className="rounded-lg bg-surface-2 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-sm text-ink">{url}</p>
      <AppButton type="button" variant="subtle" size="sm" className="mt-3" onClick={onCopy}>
        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
        {copied ? 'Copied' : 'Copy link'}
      </AppButton>
    </div>
  )
}

export const TesterApprovalSection = () => {
  // Which link was most recently copied (keyed so each Copy button tracks itself).
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(cur => (cur === key ? null : cur)), 2000)
    } catch {
      // Clipboard denied (rare in the app shell); the link is visible to copy manually.
    }
  }

  // --- Provision new tester (creates the account + both links) ---
  const [pName, setPName] = useState('')
  const [pEmail, setPEmail] = useState('')
  const [pCompany, setPCompany] = useState('')
  const [pPlan, setPPlan] = useState<TesterPlan>('solo')
  const [pReplace, setPReplace] = useState(false)
  const [pLoading, setPLoading] = useState(false)
  const [pError, setPError] = useState<string | null>(null)
  const [pResult, setPResult] = useState<{
    email: string
    setPasswordUrl: string
    checkoutUrl: string
  } | null>(null)

  const handleProvision = async () => {
    const email = pEmail.trim()
    const name = pName.trim()
    if (!email || !name) {
      setPError('Name and email are required')
      return
    }
    setPError(null)
    setPResult(null)
    try {
      setPLoading(true)
      const res = await services.admin.provisionTester({
        email,
        name,
        companyName: pCompany.trim() || undefined,
        plan: pPlan,
        replaceExisting: pReplace,
      })
      setPResult({
        email: res.email,
        setPasswordUrl: res.setPasswordUrl,
        checkoutUrl: res.checkoutUrl,
      })
    } catch (err: unknown) {
      setPError(extractError(err))
    } finally {
      setPLoading(false)
    }
  }

  // --- Approve existing owner (existing flow) ---
  const [userId, setUserId] = useState('')
  const [plan, setPlan] = useState<TesterPlan>('solo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)

  const handleApprove = async () => {
    const id = userId.trim()
    if (!id) {
      setError('User ID is required')
      return
    }
    setError(null)
    setCheckoutUrl(null)
    try {
      setLoading(true)
      const res = await services.admin.approveTester({ userId: id, plan })
      setCheckoutUrl(res.checkoutUrl)
    } catch (err: unknown) {
      setError(extractError(err))
    } finally {
      setLoading(false)
    }
  }

  // --- Remove testers (bulk delete by email) ---
  const [rEmailsText, setREmailsText] = useState('')
  const [rConfirming, setRConfirming] = useState(false)
  const [rLoading, setRLoading] = useState(false)
  const [rError, setRError] = useState<string | null>(null)
  const [rResults, setRResults] = useState<
    Array<{ email: string; status: string; detail?: string }> | null
  >(null)

  // Parse + dedupe valid emails from the free-form textarea (any whitespace/comma/semicolon separator).
  const parsedRemoveEmails = Array.from(
    new Set(
      rEmailsText
        .split(/[\s,;]+/)
        .map(e => e.trim().toLowerCase())
        .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    )
  )

  const handleRemove = async () => {
    if (!parsedRemoveEmails.length) {
      setRError('Enter at least one valid email')
      setRConfirming(false)
      return
    }
    setRError(null)
    setRResults(null)
    try {
      setRLoading(true)
      const res = await services.admin.removeTesters({ emails: parsedRemoveEmails })
      setRResults(res.results)
      setRConfirming(false)
    } catch (err: unknown) {
      setRError(extractError(err))
    } finally {
      setRLoading(false)
    }
  }

  return (
    <section className="space-y-10">
      {/* Provision a brand-new tester */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Provision new tester</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Creates a fresh owner account (no subscription) and returns two links to send the
            tester: one to set their password, one to add a card. The checkout is a 6-month free
            trial with the tester discount applied for life. Use this for testers who don&apos;t
            have an account yet.
          </p>
        </div>

        <Panel className="p-5 ring-1 ring-inset ring-warning/30">
          <div className="space-y-4">
            <TextField
              label="Full name"
              value={pName}
              onChange={e => setPName(e.target.value)}
              placeholder="Jane Cleaner"
            />
            <TextField
              label="Email"
              type="email"
              value={pEmail}
              onChange={e => setPEmail(e.target.value)}
              placeholder="jane@example.com"
              className="font-mono"
            />
            <TextField
              label="Company name (optional)"
              value={pCompany}
              onChange={e => setPCompany(e.target.value)}
              placeholder="Jane's Cleaning Co."
            />
            <SelectField
              label="Plan"
              value={pPlan}
              onChange={e => setPPlan(e.target.value as TesterPlan)}
              options={PLAN_OPTIONS}
            />

            <CheckboxField
              checked={pReplace}
              onChange={setPReplace}
              label="Replace existing account"
              description="If this email has a leftover/deleted account with no active subscription, delete it first and re-create fresh. Won't touch an account that still has a live subscription."
            />

            {pError && (
              <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                {pError}
              </Alert>
            )}

            <AppButton type="button" onClick={handleProvision} isLoading={pLoading}>
              Provision tester
            </AppButton>

            {pResult && (
              <div className="space-y-3">
                <InfoPanel>
                  Account created for <CodeChip>{pResult.email}</CodeChip>. Send the tester both
                  links — set-password first, then checkout. The set-password link is valid for 7
                  days.
                </InfoPanel>
                <LinkBox
                  label="1 · Set password link"
                  url={pResult.setPasswordUrl}
                  copied={copiedKey === 'p-setpw'}
                  onCopy={() => copy('p-setpw', pResult.setPasswordUrl)}
                />
                <LinkBox
                  label="2 · Checkout link (6-mo trial + discount)"
                  url={pResult.checkoutUrl}
                  copied={copiedKey === 'p-checkout'}
                  onCopy={() => copy('p-checkout', pResult.checkoutUrl)}
                />
              </div>
            )}
          </div>
        </Panel>
      </div>

      {/* Approve an owner who already has an account */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Approve existing owner</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Generate a private Stripe Checkout link for an owner who already signed up (6-month
            trial, tester discount). Only works if they have no active subscription.
          </p>
        </div>

        <Panel className="p-5 ring-1 ring-inset ring-warning/30">
          <div className="space-y-4">
            <TextField
              label="Owner (CleanDock id, Cognito sub, or email)"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="e.g. Cognito sub, or their login email"
              className="font-mono"
            />
            <InfoPanel>
              The Cognito console &quot;User ID&quot; (sub) is accepted. It is not the same as the
              UUID in the <CodeChip>users</CodeChip> table unless you paste sub here — we match that
              as <CodeChip>cognitoId</CodeChip>.
            </InfoPanel>

            <SelectField
              label="Plan"
              value={plan}
              onChange={e => setPlan(e.target.value as TesterPlan)}
              options={PLAN_OPTIONS}
            />

            {error && (
              <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                {error}
              </Alert>
            )}

            <AppButton type="button" onClick={handleApprove} isLoading={loading}>
              Approve tester
            </AppButton>

            {checkoutUrl && (
              <LinkBox
                label="Checkout link"
                url={checkoutUrl}
                copied={copiedKey === 'a-checkout'}
                onCopy={() => copy('a-checkout', checkoutUrl)}
              />
            )}
          </div>
        </Panel>
      </div>

      {/* Remove testers (bulk delete by email) */}
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">Remove testers</h2>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Permanently deletes tester accounts by email — the Cognito login and all their data —
            freeing the email so they can re-sign-up with the no-card link. Paste one or more emails
            (one per line, or comma/space separated). Any account with a real subscription is
            skipped, so a paying customer can never be removed here.
          </p>
        </div>

        <Panel className="p-5 ring-1 ring-inset ring-danger/30">
          <div className="space-y-4">
            <TextAreaField
              label="Emails"
              value={rEmailsText}
              onChange={e => {
                setREmailsText(e.target.value)
                setRConfirming(false)
              }}
              placeholder={'jane@example.com\njohn@example.com'}
              rows={5}
              className="font-mono"
              helperText={
                parsedRemoveEmails.length
                  ? `${parsedRemoveEmails.length} valid email${parsedRemoveEmails.length === 1 ? '' : 's'} detected`
                  : 'One per line, or comma/space separated'
              }
            />

            {rError && (
              <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                {rError}
              </Alert>
            )}

            {!rConfirming ? (
              <AppButton
                type="button"
                variant="danger"
                disabled={!parsedRemoveEmails.length}
                onClick={() => {
                  setRResults(null)
                  setRError(null)
                  setRConfirming(true)
                }}
              >
                <TrashIcon className="h-4 w-4" />
                Remove {parsedRemoveEmails.length || ''} tester
                {parsedRemoveEmails.length === 1 ? '' : 's'}
              </AppButton>
            ) : (
              <div className="space-y-3 rounded-lg bg-danger-soft p-4">
                <p className="text-sm font-medium text-danger">
                  Permanently delete {parsedRemoveEmails.length} account
                  {parsedRemoveEmails.length === 1 ? '' : 's'} and all their data? This can&apos;t be
                  undone.
                </p>
                <div className="flex gap-2">
                  <AppButton
                    type="button"
                    variant="danger"
                    onClick={handleRemove}
                    isLoading={rLoading}
                  >
                    Yes, remove
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="subtle"
                    onClick={() => setRConfirming(false)}
                    disabled={rLoading}
                  >
                    Cancel
                  </AppButton>
                </div>
              </div>
            )}

            {rResults && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                  Results
                </p>
                {rResults.map(r => (
                  <div key={r.email} className="rounded-lg bg-surface-2 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate font-mono text-sm text-ink">{r.email}</span>
                      <StatusBadge tone={removeResultTone(r.status)}>
                        {removeResultLabel(r.status)}
                      </StatusBadge>
                    </div>
                    {r.detail && <p className="mt-0.5 text-[12px] text-ink-subtle">{r.detail}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>
    </section>
  )
}

function removeResultTone(status: string): Tone {
  if (status === 'removed') return 'success'
  if (status === 'not_found') return 'neutral'
  if (status === 'error') return 'danger'
  return 'warning' // skipped_active_subscription | skipped_not_owner
}

function removeResultLabel(status: string): string {
  switch (status) {
    case 'removed':
      return 'Removed'
    case 'not_found':
      return 'Not found'
    case 'skipped_active_subscription':
      return 'Has subscription'
    case 'skipped_not_owner':
      return 'Not owner'
    case 'error':
      return 'Error'
    default:
      return status
  }
}

function extractError(err: unknown): string {
  const ax = err as { response?: { data?: { error?: { message?: string }; message?: string } } }
  const msg =
    ax.response?.data?.error?.message ||
    ax.response?.data?.message ||
    (err instanceof Error ? err.message : 'Request failed')
  return typeof msg === 'string' ? msg : 'Request failed'
}
