import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'

/**
 * Public, unauthenticated invoice page. Clients reach it from the email/SMS link, see the branded
 * invoice PDF, and tap "Pay Now" to pay online via QuickBooks. Invoices no longer use Accept/Decline
 * (that remains a quotes-only flow) — paying the invoice is the only action here.
 */
const InvoiceViewPage = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null)
  const [companyDisplayName, setCompanyDisplayName] = useState<string | null>(null)
  const [payUrl, setPayUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

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
        if (brandingRes.data.payUrl) setPayUrl(brandingRes.data.payUrl)
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

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-primary-dark flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto mb-4"></div>
          <p className="text-primary-light/70 text-sm sm:text-base">Loading your invoice...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] bg-primary-dark flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-primary-dark-secondary rounded-lg shadow-xl p-6 sm:p-8 text-center">
          <div className="text-4xl sm:text-5xl mb-4">❌</div>
          <h2 className="text-xl sm:text-2xl font-semibold text-red-500 mb-2">Error</h2>
          <p className="text-primary-light/70 text-sm sm:text-base">{error}</p>
          <p className="text-sm text-primary-light/50 mt-6">
            Please contact the contractor directly if you need assistance.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-primary-dark flex flex-col safe-area-inset">
      <header className="bg-primary-dark-secondary border-b border-primary-dark/50 px-3 py-2 sm:px-4 sm:py-3 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-center sm:justify-start">
          {companyLogoUrl ? (
            <img
              src={companyLogoUrl}
              alt={companyDisplayName || 'Company'}
              className="h-8 sm:h-10 w-auto max-w-[120px] sm:max-w-[160px] object-contain"
            />
          ) : (
            <h1 className="text-lg sm:text-xl font-bold text-primary-gold truncate max-w-[200px] sm:max-w-none">
              {companyDisplayName || 'JobDock'}
            </h1>
          )}
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-4 max-w-4xl mx-auto w-full min-w-0 flex flex-col">
        <div className="bg-primary-dark-secondary rounded-lg overflow-hidden mb-4 sm:mb-6 flex-1 min-h-0 flex flex-col">
          {pdfUrl ? (
            <>
              <iframe
                src={pdfUrl}
                title="Invoice PDF"
                className="w-full flex-1 min-h-[50vh] sm:min-h-[400px] border-0"
              />
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block sm:hidden py-2 text-center text-sm text-primary-gold hover:text-primary-gold/80"
              >
                Open PDF in new tab
              </a>
            </>
          ) : (
            <div className="min-h-[50vh] sm:min-h-[400px] flex items-center justify-center text-primary-light/50 text-sm">
              PDF could not be loaded
            </div>
          )}
        </div>

        {payUrl ? (
          <div className="mb-3 shrink-0 flex flex-col items-center gap-2">
            <a
              href={payUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-10 py-3.5 sm:py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 active:scale-[0.98] transition-colors touch-manipulation min-h-[48px] text-center"
            >
              Pay Now
            </a>
            <p className="text-xs text-primary-light/50">Pay securely online by card or bank transfer.</p>
          </div>
        ) : (
          <div className="mb-3 shrink-0 text-center">
            <p className="text-sm text-primary-light/60">
              {companyDisplayName
                ? `To pay this invoice, please contact ${companyDisplayName}.`
                : 'To pay this invoice, please contact the contractor.'}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}

export default InvoiceViewPage
