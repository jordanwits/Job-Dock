import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { apiClient, publicApiClient } from '@/lib/api/client'
import { settingsApi } from '@/lib/api/settings'

type ApprovalAction = 'accept' | 'decline'

const QuoteApprovalPage = () => {
  const { id, action } = useParams<{ id: string; action: ApprovalAction }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  
  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quoteNumber, setQuoteNumber] = useState<string>('')
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | null>(null)

  useEffect(() => {
    const handleApproval = async () => {
      if (!id || !token || !action) {
        setError('Invalid approval link')
        setLoading(false)
        return
      }

      // Fetch branding info first (before approval) - use publicApiClient for unauthenticated requests
      try {
        const brandingResponse = await publicApiClient.get(`/quotes/${id}/approval-info?token=${token}`)
        console.log('Branding response:', brandingResponse.data)
        if (brandingResponse.data.logoSignedUrl) {
          setCompanyLogoUrl(brandingResponse.data.logoSignedUrl)
        }
        if (brandingResponse.data.companyDisplayName || brandingResponse.data.tenantName) {
          setCompanyDisplayName(brandingResponse.data.companyDisplayName || brandingResponse.data.tenantName || null)
        }
      } catch (brandingError: any) {
        // Log error details for debugging
        console.error('Failed to fetch company branding:', brandingError)
        console.error('Error response:', brandingError.response?.data)
        console.error('Error status:', brandingError.response?.status)
        // Silently fail - branding is optional, but log for debugging
      }

      try {
        const endpoint = action === 'accept' 
          ? `/quotes/${id}/approve-public`
          : `/quotes/${id}/decline-public`
        
        const response = await publicApiClient.post(`${endpoint}?token=${token}`, {})
        setQuoteNumber(response.data.quoteNumber || id)
        setSuccess(true)
      } catch (err: any) {
        console.error('Approval error:', err)
        setError(
          err.response?.data?.error?.message || 
          err.response?.data?.message || 
          err.message || 
          'Failed to process your response. The link may be invalid or expired.'
        )
      } finally {
        setLoading(false)
      }
    }

    handleApproval()
  }, [id, token, action])

  return (
    <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-primary-dark-secondary rounded-lg shadow-xl p-8 text-center">
        {/* Logo/Branding */}
        <div className="mb-6">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt={companyDisplayName || 'Company logo'}
              className="h-12 w-auto max-w-[200px] mx-auto object-contain"
            />
          ) : companyDisplayName ? (
            <h1 className="text-3xl font-bold text-primary-gold">{companyDisplayName}</h1>
          ) : (
            <h1 className="text-3xl font-bold text-primary-gold">JobDock</h1>
          )}
        </div>

        {loading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto"></div>
            <p className="text-primary-light/70">Processing your response...</p>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="text-5xl mb-4">
              {action === 'accept' ? '✅' : '📝'}
            </div>
            <h2 className="text-2xl font-semibold text-primary-light mb-2">
              {action === 'accept' ? 'Quote Accepted!' : 'Quote Declined'}
            </h2>
            <p className="text-primary-light/70">
              {action === 'accept' 
                ? `Thank you for accepting quote ${quoteNumber}. The contractor has been notified and will be in touch soon.`
                : `We've recorded that you declined quote ${quoteNumber}. The contractor has been notified.`
              }
            </p>
            <p className="text-sm text-primary-light/50 mt-6">
              You can safely close this window.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-semibold text-red-500 mb-2">
              Error
            </h2>
            <p className="text-primary-light/70">{error}</p>
            <p className="text-sm text-primary-light/50 mt-6">
              Please contact the contractor directly if you need assistance.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuoteApprovalPage
