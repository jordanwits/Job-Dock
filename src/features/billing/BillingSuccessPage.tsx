import { Link, useSearchParams } from 'react-router-dom'
import { Card } from '@/components/ui'

const linkPrimary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-primary-gold px-4 text-base font-medium text-primary-dark hover:bg-primary-gold/90'
const linkSecondary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-primary-blue px-4 text-base font-medium text-white hover:bg-primary-blue/90 dark:text-primary-light'

export function BillingSuccessPage() {
  const [params] = useSearchParams()
  const sessionId = params.get('session_id')

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="max-w-md p-8 text-center shadow-lg">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Checkout complete</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Your subscription is being activated. You can close this tab and return to JobDock.
        </p>
        {sessionId ? (
          <p className="mt-2 font-mono text-xs text-slate-500">Session: {sessionId.slice(0, 20)}…</p>
        ) : null}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/auth/login" className={linkPrimary}>
            Sign in
          </Link>
          <Link to="/app/settings" className={linkSecondary}>
            Open settings
          </Link>
        </div>
      </Card>
    </div>
  )
}
