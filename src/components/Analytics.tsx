import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { syncAnalytics } from '@/lib/analytics'

/**
 * Sends a pageview on every marketing-route navigation and disables capture everywhere else.
 * Renders nothing. The scope rules — and why route gating alone isn't sufficient — live in
 * src/lib/analytics.ts.
 */
export default function Analytics() {
  const { pathname } = useLocation()

  useEffect(() => {
    syncAnalytics(pathname)
  }, [pathname])

  return null
}
