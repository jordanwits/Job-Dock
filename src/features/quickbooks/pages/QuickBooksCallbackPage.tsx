import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { quickbooksApi } from '@/lib/api/quickbooks'

/**
 * Handles the Intuit OAuth redirect. Intuit sends the user back to
 * `${PUBLIC_APP_URL}/quickbooks/callback?code=...&realmId=...&state=...`. We exchange the code via
 * the backend (which verifies the signed CSRF state), then return to the QuickBooks settings tab.
 *
 * Rendered inside ProtectedRoute so the session token is present for the /quickbooks/connect call.
 */
export const QuickBooksCallbackPage = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const code = searchParams.get('code')
    const realmId = searchParams.get('realmId')
    const state = searchParams.get('state')
    const oauthError = searchParams.get('error')

    if (oauthError) {
      setError(`QuickBooks authorization was cancelled (${oauthError}).`)
      return
    }
    if (!code || !realmId || !state) {
      setError('Missing authorization details from QuickBooks.')
      return
    }

    quickbooksApi
      .connect({ code, realmId, state })
      .then(() => navigate('/app/settings?tab=quickbooks&connected=1', { replace: true }))
      .catch((err: any) => {
        setError(err?.response?.data?.message || 'Failed to finish connecting QuickBooks.')
      })
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="max-w-md space-y-4">
        {error ? (
          <>
            <h1 className="text-xl font-semibold text-red-500">Could not connect QuickBooks</h1>
            <p className="text-sm text-gray-500">{error}</p>
            <button
              onClick={() => navigate('/app/settings?tab=quickbooks', { replace: true })}
              className="text-primary-blue underline"
            >
              Back to Settings
            </button>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Connecting QuickBooks...</h1>
            <p className="text-sm text-gray-500">Finishing up, please wait.</p>
          </>
        )}
      </div>
    </div>
  )
}
