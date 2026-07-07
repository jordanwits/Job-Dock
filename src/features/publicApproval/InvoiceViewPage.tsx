import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import {
  BrandingMark,
  CenterCard,
  PublicLoading,
  PublicPanel,
  StatusCircle,
} from '@/components/public/publicUi'

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
      } catch (err: unknown) {
        console.error('Failed to load invoice:', err)
        setError(getErrorMessage(err, 'Failed to load invoice. The link may be invalid or expired.'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, token])

  if (loading) {
    return <PublicLoading message="Loading your invoice..." />
  }

  if (error) {
    return (
      <CenterCard>
        <StatusCircle kind="danger" label="Error" />
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-ink">Something went wrong</h2>
        <p className="text-sm leading-relaxed text-ink-muted">{error}</p>
        <p className="mt-6 text-[13px] text-ink-subtle">
          Please contact the contractor directly if you need assistance.
        </p>
      </CenterCard>
    )
  }

  return (
    <div className="safe-area-inset flex min-h-[100dvh] flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-center sm:justify-start">
          <BrandingMark branding={{ logoSignedUrl: companyLogoUrl, name: companyDisplayName }} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl min-w-0 flex-1 flex-col p-3 sm:p-4">
        <PublicPanel className="mb-4 flex min-h-0 flex-1 flex-col overflow-hidden sm:mb-6">
          {pdfUrl ? (
            <>
              <iframe
                src={pdfUrl}
                title="Invoice PDF"
                className="min-h-[50vh] w-full flex-1 border-0 sm:min-h-[400px]"
              />
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block border-t border-line py-2.5 text-center text-sm font-medium text-accent-strong transition-colors hover:text-accent sm:hidden"
              >
                Open PDF in new tab
              </a>
            </>
          ) : (
            <div className="flex min-h-[50vh] items-center justify-center text-sm text-ink-subtle sm:min-h-[400px]">
              PDF could not be loaded
            </div>
          )}
        </PublicPanel>

        {payUrl ? (
          <div className="mb-3 flex shrink-0 flex-col items-center gap-2">
            <a
              href={payUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 w-full items-center justify-center rounded-lg bg-accent-strong px-10 text-sm font-semibold text-accent-contrast transition-opacity duration-150 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:w-auto"
            >
              Pay invoice online
            </a>
            <p className="text-xs text-ink-subtle">Pay securely online by card or bank transfer.</p>
          </div>
        ) : (
          <div className="mb-3 shrink-0 text-center">
            <p className="text-sm text-ink-muted">
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
