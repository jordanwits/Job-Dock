import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'

const InvoiceViewPage = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState<'accept' | 'decline' | null>(null)
  const [success, setSuccess] = useState<'accept' | 'decline' | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      if (!id || !token) {
        setError('Invalid link. Missing invoice ID or token.')
        setLoading(false)
        return
      }

      try {
        const [brandingRes, pdfRes] = await Promise.all([
          publicApiClient.get(`/invoices/${id}/approval-info?token=${token}`),
          publicApiClient.get(`/invoices/${id}/public-pdf?token=${token}`),
        ])

        if (brandingRes.data.logoSignedUrl) setCompanyLogoUrl(brandingRes.data.logoSignedUrl)
        if (brandingRes.data.companyDisplayName || brandingRes.data.tenantName) {
          setCompanyDisplayName(brandingRes.data.companyDisplayName || brandingRes.data.tenantName || null)
        }
        if (pdfRes.data.pdfUrl) setPdfUrl(pdfRes.data.pdfUrl)
      } catch (err: any) {
        console.error('Failed to load invoice:', err)
        setError(
          err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            'Failed to load invoice. The link may be invalid or expired.'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, token])

  const handleAction = async (action: 'accept' | 'decline') => {
    if (!id || !token) return

    setSubmitting(action)
    try {
      const endpoint = action === 'accept'
        ? `/invoices/${id}/approve-public`
        : `/invoices/${id}/decline-public`
      const response = await publicApiClient.post(`${endpoint}?token=${token}`, {})
      setInvoiceNumber(response.data.invoiceNumber || id)
      setSuccess(action)
    } catch (err: any) {
      console.error('Approval error:', err)
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          'Failed to process your response. The link may be invalid or expired.'
      )
    } finally {
      setSubmitting(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto mb-4"></div>
          <p className="text-primary-light/70">Loading your invoice...</p>
        </div>
      </div>
    )
  }

  if (error && !success) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-primary-dark-secondary rounded-lg shadow-xl p-8 text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-semibold text-red-500 mb-2">Error</h2>
          <p className="text-primary-light/70">{error}</p>
          <p className="text-sm text-primary-light/50 mt-6">
            Please contact the contractor directly if you need assistance.
          </p>
        </div>
      </div>
    )
  }

  if (success) {
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
          <div className="text-5xl mb-4">{success === 'accept' ? '✅' : '⚠️'}</div>
          <h2 className="text-2xl font-semibold text-primary-light mb-2">
            {success === 'accept' ? 'Invoice Approved!' : 'Invoice Declined'}
          </h2>
          <p className="text-primary-light/70">
            {success === 'accept'
              ? `Thank you for approving invoice ${invoiceNumber}. The contractor has been notified.`
              : `Invoice ${invoiceNumber} has been declined. The contractor has been notified and will reach out to you.`}
          </p>
          {success === 'accept' && (
            <p className="text-sm text-primary-light/60 mt-4">
              Note: This approval does not constitute payment. Please remit payment according to the invoice terms.
            </p>
          )}
          <p className="text-sm text-primary-light/50 mt-6">You can safely close this window.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary-dark flex flex-col">
      <header className="bg-primary-dark-secondary border-b border-primary-dark/50 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={companyDisplayName || 'Company'}
                className="h-10 w-auto max-w-[160px] object-contain"
              />
            ) : (
              <h1 className="text-xl font-bold text-primary-gold">
                {companyDisplayName || 'JobDock'}
              </h1>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 max-w-4xl mx-auto w-full">
        <div className="bg-primary-dark-secondary rounded-lg overflow-hidden mb-6">
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              title="Invoice PDF"
              className="w-full h-[70vh] min-h-[400px] border-0"
            />
          ) : (
            <div className="h-[70vh] min-h-[400px] flex items-center justify-center text-primary-light/50">
              PDF could not be loaded
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => handleAction('accept')}
            disabled={!!submitting}
            className="px-6 py-3 bg-primary-gold text-primary-dark font-semibold rounded-lg hover:bg-primary-gold/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting === 'accept' ? 'Processing...' : 'Approve Invoice'}
          </button>
          <button
            onClick={() => handleAction('decline')}
            disabled={!!submitting}
            className="px-6 py-3 bg-primary-dark-secondary border border-primary-light/30 text-primary-light font-semibold rounded-lg hover:bg-primary-dark/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting === 'decline' ? 'Processing...' : 'Decline'}
          </button>
        </div>
      </main>
    </div>
  )
}

export default InvoiceViewPage
