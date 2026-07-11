import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import {
  BrandingMark,
  CenterCard,
  PublicButton,
  PublicLoading,
  PublicPanel,
  PublicTextArea,
  StatusCircle,
} from '@/components/public/publicUi'

const DECLINE_REASON_MAX_LEN = 2000

const QuoteViewPage = () => {
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
  const [quoteNumber, setQuoteNumber] = useState<string>('')
  const [declineStep, setDeclineStep] = useState<'idle' | 'confirm'>('idle')
  const [declineReason, setDeclineReason] = useState('')

  useEffect(() => {
    const load = async () => {
      if (!id || !token) {
        setError('Invalid link. Missing quote ID or token.')
        setLoading(false)
        return
      }

      try {
        const [brandingRes, pdfRes] = await Promise.all([
          publicApiClient.get(`/quotes/${id}/approval-info?token=${token}`),
          publicApiClient.get(`/quotes/${id}/public-pdf?token=${token}`),
        ])

        if (brandingRes.data.logoSignedUrl) setCompanyLogoUrl(brandingRes.data.logoSignedUrl)
        if (brandingRes.data.companyDisplayName || brandingRes.data.tenantName) {
          setCompanyDisplayName(brandingRes.data.companyDisplayName || brandingRes.data.tenantName || null)
        }
        if (pdfRes.data.pdfUrl) setPdfUrl(pdfRes.data.pdfUrl)
      } catch (err: unknown) {
        console.error('Failed to load quote:', err)
        setError(getErrorMessage(err, 'Failed to load quote. The link may be invalid or expired.'))
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, token])

  const handleAction = async (action: 'accept' | 'decline') => {
    if (!id || !token) return

    if (action === 'decline' && declineStep === 'idle') {
      setDeclineStep('confirm')
      setError(null)
      return
    }

    setSubmitting(action)
    try {
      const endpoint = action === 'accept'
        ? `/quotes/${id}/approve-public`
        : `/quotes/${id}/decline-public`
      const trimmed = declineReason.trim().slice(0, DECLINE_REASON_MAX_LEN)
      const body =
        action === 'accept' ? {} : trimmed ? { declineReason: trimmed } : {}
      const response = await publicApiClient.post(`${endpoint}?token=${token}`, body)
      setQuoteNumber(response.data.quoteNumber || id)
      setSuccess(action)
    } catch (err: unknown) {
      console.error('Approval error:', err)
      setError(
        getErrorMessage(err, 'Failed to process your response. The link may be invalid or expired.')
      )
    } finally {
      setSubmitting(null)
    }
  }

  const branding = { logoSignedUrl: companyLogoUrl, name: companyDisplayName }

  if (loading) {
    return <PublicLoading message="Loading your quote..." />
  }

  if (error && !success) {
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

  if (success) {
    return (
      <CenterCard branding={branding}>
        {success === 'accept' ? (
          <StatusCircle kind="success" label="Accepted" />
        ) : (
          <StatusCircle kind="declined" label="Declined" />
        )}
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-ink">
          {success === 'accept' ? 'Quote accepted' : 'Quote declined'}
        </h2>
        <p className="text-sm leading-relaxed text-ink-muted">
          {success === 'accept' ? (
            <>
              Thank you for accepting quote{' '}
              <span className="font-mono tabular-nums">{quoteNumber}</span>. The contractor has been
              notified and will be in touch soon.
            </>
          ) : (
            <>
              We've recorded that you declined quote{' '}
              <span className="font-mono tabular-nums">{quoteNumber}</span>. The contractor has been
              notified.
            </>
          )}
        </p>
        <p className="mt-6 text-[13px] text-ink-subtle">You can safely close this window.</p>
      </CenterCard>
    )
  }

  return (
    <div className="safe-area-inset flex min-h-[100dvh] flex-col bg-canvas">
      <header className="shrink-0 border-b border-line bg-surface px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center justify-center sm:justify-start">
          <BrandingMark branding={branding} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl min-w-0 flex-1 flex-col p-3 sm:p-4">
        <PublicPanel className="mb-4 flex min-h-0 flex-1 flex-col overflow-hidden sm:mb-6">
          {pdfUrl ? (
            <>
              <iframe
                src={pdfUrl}
                title="Quote PDF"
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

        {declineStep === 'confirm' && (
          <div className="mx-auto mb-4 w-full max-w-xl shrink-0">
            <PublicTextArea
              id="quote-view-decline-reason"
              label={
                <>
                  Reason for declining <span className="font-normal text-ink-subtle">(optional)</span>
                </>
              }
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value.slice(0, DECLINE_REASON_MAX_LEN))}
              rows={3}
              placeholder="The contractor will see this in CleanDock."
            />
            <p className="mt-1 text-right font-mono text-xs tabular-nums text-ink-subtle">
              {declineReason.length}/{DECLINE_REASON_MAX_LEN}
            </p>
          </div>
        )}

        {error && (
          <p className="mb-3 shrink-0 text-center text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex shrink-0 flex-col justify-center gap-2 pb-2 sm:flex-row sm:gap-3">
          <PublicButton
            onClick={() => handleAction('accept')}
            disabled={!!submitting || declineStep === 'confirm'}
            isLoading={submitting === 'accept'}
            className="sm:w-auto"
            fullWidth
          >
            {submitting === 'accept' ? 'Processing...' : 'Accept quote'}
          </PublicButton>
          {declineStep === 'idle' ? (
            <PublicButton
              variant="subtle"
              onClick={() => handleAction('decline')}
              disabled={!!submitting}
              className="sm:w-auto"
              fullWidth
            >
              Decline
            </PublicButton>
          ) : (
            <>
              <PublicButton
                variant="subtle"
                onClick={() => {
                  setDeclineStep('idle')
                  setDeclineReason('')
                }}
                disabled={!!submitting}
                className="sm:w-auto"
                fullWidth
              >
                Back
              </PublicButton>
              <PublicButton
                variant="danger"
                onClick={() => handleAction('decline')}
                disabled={!!submitting}
                isLoading={submitting === 'decline'}
                className="sm:w-auto"
                fullWidth
              >
                {submitting === 'decline' ? 'Processing...' : 'Confirm decline'}
              </PublicButton>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default QuoteViewPage
