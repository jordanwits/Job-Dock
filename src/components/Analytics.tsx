import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { syncAnalytics } from '@/lib/analytics'

/**
 * Sends a pageview on every marketing-route navigation and disables capture everywhere else.
 * Renders nothing. The scope rules — and why route gating alone isn't sufficient — live in
 * src/lib/analytics.ts.
 *
 * Sign-in state is read here rather than inside analytics.ts so the lib layer keeps no
 * dependency on a feature store. The store persists through zustand's `persist` middleware
 * backed by localStorage, which rehydrates synchronously, so this is already correct on the
 * first render rather than flipping a beat later.
 */
export default function Analytics() {
  const { pathname } = useLocation()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  useEffect(() => {
    syncAnalytics(pathname, isAuthenticated)
  }, [pathname, isAuthenticated])

  return null
}
