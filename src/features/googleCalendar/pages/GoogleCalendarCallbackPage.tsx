import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '@/features/auth'
import { googleCalendarApi } from '@/lib/api/googleCalendar'
import { getErrorMessage } from '@/lib/utils/errorHandler'

/**
 * Handles the Google OAuth redirect. Google sends the user back to
 * `${PUBLIC_APP_URL}/google-calendar/callback?code=...&state=...` (or `?error=...` when the
 * user declines consent). We exchange the code via the backend (which verifies the signed
 * state), then return to where this user manages the connection: owners/admins to the
 * Settings tab, employees to the Profile page (AdminRoute blocks them from /app/settings).
 * On any failure we navigate back with an error param so the host page surfaces it inside
 * the section (never an error dead-end here).
 *
 * Rendered inside ProtectedRoute so the session token is present for the /connect call.
 */
export const GoogleCalendarCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const ran = useRef(false)

  // Employees land on Profile; everyone else (incl. undefined role, which AdminRoute
  // treats as admin) lands on the Settings tab.
  const isEmployee = user?.role === 'employee'

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const successPath = isEmployee
      ? '/app/profile?googleConnected=1'
      : '/app/settings?tab=google-calendar&connected=1'
    const backWithError = (message: string) => {
      const encoded = encodeURIComponent(message)
      navigate(
        isEmployee
          ? `/app/profile?googleError=${encoded}`
          : `/app/settings?tab=google-calendar&error=${encoded}`,
        { replace: true }
      )
    }

    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

    if (oauthError) {
      backWithError('Google Calendar authorization was cancelled.')
      return
    }
    if (!code || !state) {
      backWithError('Missing authorization details from Google.')
      return
    }

    googleCalendarApi
      .connect({ code, state })
      .then(() => navigate(successPath, { replace: true }))
      .catch((err: unknown) =>
        backWithError(getErrorMessage(err, 'Failed to finish connecting Google Calendar.'))
      )
  }, [searchParams, navigate, isEmployee])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold">Connecting Google Calendar...</h1>
        <p className="text-sm text-gray-500">Finishing up, please wait.</p>
      </div>
    </div>
  )
}
