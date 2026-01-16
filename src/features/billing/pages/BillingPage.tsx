import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'
import { billingService } from '@/lib/api/services'
import { appEnv } from '@/lib/env'

const stripePromise = appEnv.stripePublishableKey 
  ? loadStripe(appEnv.stripePublishableKey)
  : null

interface BillingStatus {
  hasSubscription: boolean
  status: string
  trialEndsAt?: string
  currentPeriodEndsAt?: string
  cancelAtPeriodEnd: boolean
}

export function BillingPage() {
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCheckout, setShowCheckout] = useState(false)

  useEffect(() => {
    loadBillingStatus()
  }, [])

  const loadBillingStatus = async () => {
    try {
      setLoading(true)
      const status = await billingService.getStatus()
      setBillingStatus(status)
    } catch (err: any) {
      console.error('Failed to load billing status:', err)
      setError(err.message || 'Failed to load billing information')
    } finally {
      setLoading(false)
    }
  }

  const handleStartSubscription = async () => {
    try {
      setLoading(true)
      const result = await billingService.createEmbeddedCheckoutSession()
      setClientSecret(result.clientSecret)
      setShowCheckout(true)
    } catch (err: any) {
      console.error('Failed to create checkout session:', err)
      setError(err.message || 'Failed to start subscription')
    } finally {
      setLoading(false)
    }
  }

  const handleManageSubscription = async () => {
    try {
      setLoading(true)
      const result = await billingService.createPortalSession()
      window.location.href = result.url
    } catch (err: any) {
      console.error('Failed to open billing portal:', err)
      setError(err.message || 'Failed to open billing portal')
      setLoading(false)
    }
  }

  if (loading && !billingStatus) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading billing information...</p>
        </div>
      </div>
    )
  }

  if (error && !billingStatus) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-2">Error</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadBillingStatus}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const isActive = billingStatus?.status === 'active' || billingStatus?.status === 'trialing'

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Billing & Subscription</h1>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {!showCheckout && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Subscription Status</h2>
          
          {!billingStatus?.hasSubscription ? (
            <div>
              <div className="mb-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                  No Active Subscription
                </span>
              </div>
              <p className="text-gray-600 mb-6">
                Subscribe to JobDock for $29.99/month with a 14-day free trial. Start managing your business more efficiently today!
              </p>
              <button
                onClick={handleStartSubscription}
                disabled={loading}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Start 14-Day Free Trial'}
              </button>
            </div>
          ) : (
            <div>
              <div className="mb-4 space-y-2">
                <div>
                  <span className="text-sm text-gray-500">Status:</span>
                  <span className={`ml-2 inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {billingStatus.status.charAt(0).toUpperCase() + billingStatus.status.slice(1)}
                  </span>
                </div>
                
                {billingStatus.trialEndsAt && (
                  <div>
                    <span className="text-sm text-gray-500">Trial Ends:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">
                      {new Date(billingStatus.trialEndsAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {billingStatus.currentPeriodEndsAt && (
                  <div>
                    <span className="text-sm text-gray-500">Current Period Ends:</span>
                    <span className="ml-2 text-sm font-medium text-gray-900">
                      {new Date(billingStatus.currentPeriodEndsAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                
                {billingStatus.cancelAtPeriodEnd && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      Your subscription will be canceled at the end of the current period.
                    </p>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleManageSubscription}
                disabled={loading}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : 'Manage Subscription'}
              </button>
            </div>
          )}
        </div>
      )}

      {showCheckout && clientSecret && stripePromise && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Complete Your Subscription</h2>
          <EmbeddedCheckoutProvider
            stripe={stripePromise}
            options={{ clientSecret }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      )}

      {!stripePromise && !billingStatus?.hasSubscription && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
          <p className="text-yellow-800">
            Stripe is not configured. Please contact support to set up billing.
          </p>
        </div>
      )}
    </div>
  )
}
