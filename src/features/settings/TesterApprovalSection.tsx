import { useState } from 'react'
import { Button, Card, Input, Select } from '@/components/ui'
import { services } from '@/lib/api/services'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

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
  const { theme } = useTheme()
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
    <Card
      className={cn(
        'p-6',
        theme === 'dark' ? 'border-amber-900/40 bg-amber-950/20' : 'border-amber-200 bg-amber-50/80'
      )}
    >
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Approve tester</h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Generate a private Stripe Checkout link for an approved tenant owner (6-month trial, tester discount). Not
        shown to other users.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Owner (JobDock id, Cognito sub, or email)
          </label>
          <Input
            value={userId}
            onChange={e => setUserId(e.target.value)}
            placeholder="e.g. Cognito sub, or their login email"
            className="font-mono text-sm"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            The Cognito console &quot;User ID&quot; (sub) is accepted. It is not the same as the UUID in the{' '}
            <code className="rounded bg-slate-200/80 px-1 dark:bg-slate-700">users</code> table unless you paste sub
            here—we match that as <code className="rounded bg-slate-200/80 px-1 dark:bg-slate-700">cognitoId</code>.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Plan</label>
          <Select
            value={plan}
            onChange={e => setPlan(e.target.value as 'solo' | 'team' | 'team-plus')}
            options={[
              { value: 'solo', label: 'Solo' },
              { value: 'team', label: 'Team' },
              { value: 'team-plus', label: 'Team+' },
            ]}
          />
        </div>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <Button type="button" variant="primary" onClick={handleApprove} disabled={loading} isLoading={loading}>
          Approve tester
        </Button>
        {checkoutUrl ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Checkout link</p>
            <p className="mt-1 break-all text-sm text-slate-800 dark:text-slate-200">{checkoutUrl}</p>
            <Button type="button" variant="secondary" className="mt-3" size="sm" onClick={copyLink}>
              {copied ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
