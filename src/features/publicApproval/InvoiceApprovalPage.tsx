import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'

type ApprovalAction = 'accept' | 'decline'

const DECLINE_REASON_MAX_LEN = 2000

const InvoiceApprovalPage = () => {
  const { id, action } = useParams<{ id: string; action: ApprovalAction }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loadingBranding, setLoadingBranding] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | null>(null)
  const [declineReason, setDeclineReason] = useState('')

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!id || !token || !action) {
        setError('Invalid approval link')
        setLoadingBranding(false)
        return
      }

      try {
        const brandingResponse = await publicApiClient.get(`/invoices/${id}/approval-info?token=${token}`)
        if (cancelled) return
        if (brandingResponse.data.logoSignedUrl) {
          setCompanyLogoUrl(brandingResponse.data.logoSignedUrl)
        }
        if (brandingResponse.data.companyDisplayName || brandingResponse.data.tenantName) {
          setCompanyDisplayName(
            brandingResponse.data.companyDisplayName || brandingResponse.data.tenantName || null
          )
        }
      } catch (brandingError: unknown) {
        console.error('Failed to fetch company branding:', brandingError)
      }

      if (cancelled) return
      setLoadingBranding(false)

      if (action === 'decline') {
        return
      }

      setSubmitting(true)
      try {
        const response = await publicApiClient.post(`/invoices/${id}/approve-public?token=${token}`, {})
        if (cancelled) return
        setInvoiceNumber(response.data.invoiceNumber || id)
        setSuccess(true)
      } catch (err: unknown) {
        console.error('Approval error:', err)
        const ax = err as { response?: { data?: { error?: { message?: string }; message?: string } } }
        setError(
          ax.response?.data?.error?.message ||
            ax.response?.data?.message ||
            (err instanceof Error ? err.message : null) ||
            'Failed to process your response. The link may be invalid or expired.'
        )
      } finally {
        if (!cancelled) setSubmitting(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [id, token, action])

  const handleDeclineSubmit = async () => {
    if (!id || !token) return
    setSubmitting(true)
    setError(null)
    try {
      const trimmed = declineReason.trim().slice(0, DECLINE_REASON_MAX_LEN)
      const body = trimmed ? { declineReason: trimmed } : {}
      const response = await publicApiClient.post(`/invoices/${id}/decline-public?token=${token}`, body)
      setInvoiceNumber(response.data.invoiceNumber || id)
      setSuccess(true)
    } catch (err: unknown) {
      console.error('Decline error:', err)
      const ax = err as { response?: { data?: { error?: { message?: string }; message?: string } } }
      setError(
        ax.response?.data?.error?.message ||
          ax.response?.data?.message ||
          (err instanceof Error ? err.message : null) ||
          'Failed to process your response. The link may be invalid or expired.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  const showSpinner = loadingBranding || submitting

  return (
    <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-primary-dark-secondary rounded-lg shadow-xl p-8 text-center">
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

        {showSpinner && !success ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto"></div>
            <p className="text-primary-light/70">Processing your response...</p>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div className="text-5xl mb-4">{action === 'accept' ? '✅' : '⚠️'}</div>
            <h2 className="text-2xl font-semibold text-primary-light mb-2">
              {action === 'accept' ? 'Invoice Approved!' : 'Invoice Declined'}
            </h2>
            <p className="text-primary-light/70">
              {action === 'accept'
                ? `Thank you for approving invoice ${invoiceNumber}. The contractor has been notified.`
                : `Invoice ${invoiceNumber} has been declined. The contractor has been notified and will reach out to you.`}
            </p>
            {action === 'accept' && (
              <p className="text-sm text-primary-light/60 mt-4">
                Note: This approval does not constitute payment. Please remit payment according to the invoice terms.
              </p>
            )}
            <p className="text-sm text-primary-light/50 mt-6">You can safely close this window.</p>
          </div>
        ) : action === 'decline' ? (
          <div className="space-y-4 text-left">
            <h2 className="text-xl font-semibold text-primary-light text-center">Decline this invoice?</h2>
            <p className="text-sm text-primary-light/70 text-center">
              Optionally let the contractor know why (they will see this in JobDock).
            </p>
            <label htmlFor="invoice-decline-reason" className="block text-sm text-primary-light/80">
              Reason <span className="text-primary-light/50">(optional)</span>
            </label>
            <textarea
              id="invoice-decline-reason"
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value.slice(0, DECLINE_REASON_MAX_LEN))}
              rows={4}
              placeholder="e.g. question about a line item, dispute, timing…"
              className="w-full rounded-lg border border-primary-light/20 bg-primary-dark px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/40 focus:border-primary-gold focus:outline-none focus:ring-1 focus:ring-primary-gold"
            />
            <p className="text-xs text-primary-light/50 text-right">
              {declineReason.length}/{DECLINE_REASON_MAX_LEN}
            </p>
            {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center pt-2">
              <button
                type="button"
                onClick={handleDeclineSubmit}
                disabled={submitting}
                className="w-full sm:w-auto px-6 py-3 bg-red-600/90 text-white font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 min-h-[48px]"
              >
                Submit decline
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-5xl mb-4">❌</div>
            <h2 className="text-2xl font-semibold text-red-500 mb-2">Error</h2>
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

export default InvoiceApprovalPage
