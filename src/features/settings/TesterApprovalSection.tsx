import { useState } from 'react'
import { services } from '@/lib/api/services'
import {
  AppButton,
  Panel,
  TextField,
  SelectField,
  Alert,
  AlertIcon,
  InfoPanel,
  CodeChip,
  CopyIcon,
  CheckIcon,
} from './settingsUi'

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

export const TesterApprovalSection = () => {
  const [userId, setUserId] = useState('')
  const [plan, setPlan] = useState<'solo' | 'team' | 'team-plus'>('solo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleApprove = async () => {
    const id = userId.trim()
    if (!id) {
      setError('User ID is required')
      return
    }
    setError(null)
    setCheckoutUrl(null)
    setCopied(false)
    try {
      setLoading(true)
      const res = await services.admin.approveTester({ userId: id, plan })
      setCheckoutUrl(res.checkoutUrl)
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: { message?: string }; message?: string } } }
      const msg =
        ax.response?.data?.error?.message ||
        ax.response?.data?.message ||
        (err instanceof Error ? err.message : 'Request failed')
      setError(typeof msg === 'string' ? msg : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = async () => {
    if (!checkoutUrl) return
    try {
      await navigator.clipboard.writeText(checkoutUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy to clipboard')
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-ink">Approve tester</h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
          Generate a private Stripe Checkout link for an approved tenant owner (6-month trial,
          tester discount). Not shown to other users.
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
            The Cognito console &quot;User ID&quot; (sub) is accepted. It is not the same as the UUID
            in the <CodeChip>users</CodeChip> table unless you paste sub here — we match that as{' '}
            <CodeChip>cognitoId</CodeChip>.
          </InfoPanel>

          <SelectField
            label="Plan"
            value={plan}
            onChange={e => setPlan(e.target.value as 'solo' | 'team' | 'team-plus')}
            options={[
              { value: 'solo', label: 'Solo' },
              { value: 'team', label: 'Team' },
              { value: 'team-plus', label: 'Team+' },
            ]}
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
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
                Checkout link
              </p>
              <p className="mt-1 break-all font-mono text-sm text-ink">{checkoutUrl}</p>
              <AppButton type="button" variant="subtle" size="sm" className="mt-3" onClick={copyLink}>
                {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy link'}
              </AppButton>
            </div>
          )}
        </div>
      </Panel>
    </section>
  )
}
