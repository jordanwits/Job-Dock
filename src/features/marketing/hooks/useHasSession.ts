import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Where a signed-in visitor should be sent instead of a signup CTA. Kept here so the three
 * marketing CTAs that swap can't drift apart in wording.
 */
export const SIGNED_IN_CTA = { label: 'Go to app', href: '/app' } as const

/**
 * Whether the visitor already has a signed-in session.
 *
 * Reads the `auth_token` localStorage key rather than useAuthStore, deliberately. Marketing
 * components are in the prerender graph, and the store drags the auth and mock-API layers into the
 * Node render, where they touch localStorage at module scope and throw — see the header comment in
 * scripts/prerender/entry.tsx. That failure is quiet: the build still exits 0 and writes every
 * page. Reaching the store through '@/features/auth' would also close an import cycle, since that
 * barrel re-exports SignupPage, which renders MarketingLayout. The store owns the key, writing it
 * on login and removing it on logout, so it tracks the session faithfully.
 *
 * Resolving after mount is a feature rather than a compromise: prerendered HTML keeps its
 * signed-out CTAs, which is what crawlers and first-time visitors should receive.
 */
export function useHasSession(): boolean {
  const { pathname } = useLocation()
  const [hasSession, setHasSession] = useState(false)

  // Re-checked per navigation so signing out elsewhere in the SPA is reflected without a reload.
  useEffect(() => {
    setHasSession(!!window.localStorage.getItem('auth_token'))
  }, [pathname])

  return hasSession
}
