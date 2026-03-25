import { Link } from 'react-router-dom'
import { Card } from '@/components/ui'

const linkPrimary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-primary-gold px-4 text-base font-medium text-primary-dark hover:bg-primary-gold/90'
const linkSecondary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-primary-blue px-4 text-base font-medium text-white hover:bg-primary-blue/90 dark:text-primary-light'

export function BillingCancelledPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4 dark:bg-slate-950">
      <Card className="max-w-md p-8 text-center shadow-lg">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Checkout cancelled</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          No charges were made. You can return to JobDock and try again when you are ready.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link to="/" className={linkPrimary}>
            Home
          </Link>
          <Link to="/auth/login" className={linkSecondary}>
            Sign in
          </Link>
        </div>
      </Card>
    </div>
  )
}
