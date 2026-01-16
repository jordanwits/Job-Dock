import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { billingService } from '@/lib/api/services'

export function BillingReturnPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    
    if (!sessionId) {
      setStatus('error')
      return
    }

    // Check billing status after checkout
    const checkStatus = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 2000)) // Brief delay to allow webhook processing
        const billingStatus = await billingService.getStatus()
        
        if (billingStatus.hasSubscription) {
          setStatus('success')
          // Redirect to dashboard after 2 seconds
          setTimeout(() => {
            navigate('/app')
          }, 2000)
        } else {
          setStatus('error')
        }
      } catch (err) {
        console.error('Failed to check billing status:', err)
        setStatus('error')
      }
    }

    checkStatus()
  }, [searchParams, navigate])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">Processing...</h2>
            <p className="text-gray-600">
              We're setting up your subscription. Please wait a moment.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-green-600">Success!</h2>
            <p className="text-gray-600 mb-4">
              Your subscription is now active. Redirecting you to the dashboard...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-red-600">Something went wrong</h2>
            <p className="text-gray-600 mb-6">
              We couldn't confirm your subscription. Please try again or contact support.
            </p>
            <button
              onClick={() => navigate('/app/billing')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Back to Billing
            </button>
          </>
        )}
      </div>
    </div>
  )
}
