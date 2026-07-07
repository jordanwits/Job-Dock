import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'
import {
  CenterCard,
  PublicButton,
  PublicTextArea,
  Spinner,
  StatusCircle,
} from '@/components/public/publicUi'

type ApprovalAction = 'accept' | 'decline'

const DECLINE_REASON_MAX_LEN = 2000

const QuoteApprovalPage = () => {
  const { id, action } = useParams<{ id: string; action: ApprovalAction }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loadingBranding, setLoadingBranding] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quoteNumber, setQuoteNumber] = useState<string>('')
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
        const brandingResponse = await publicApiClient.get(`/quotes/${id}/approval-info?token=${token}`)
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
      // NOTE: we intentionally do NOT auto-submit the acceptance here. Merely opening the
      // emailed link must not accept the quote — the customer confirms with an explicit click
      // below (handleAcceptSubmit). This also avoids a double-accept on React StrictMode/remount.
    }

    run()
    return () => {
      cancelled = true
    }
  }, [id, token, action])

  const handleAcceptSubmit = async () => {
    if (!id || !token || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await publicApiClient.post(`/quotes/${id}/approve-public?token=${token}`, {})
      setQuoteNumber(response.data.quoteNumber || id)
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
      setSubmitting(false)
    }
  }

  const handleDeclineSubmit = async () => {
    if (!id || !token) return
    setSubmitting(true)
    setError(null)
    try {
      const trimmed = declineReason.trim().slice(0, DECLINE_REASON_MAX_LEN)
      const body = trimmed ? { declineReason: trimmed } : {}
      const response = await publicApiClient.post(`/quotes/${id}/decline-public?token=${token}`, body)
      setQuoteNumber(response.data.quoteNumber || id)
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
  const branding = { logoSignedUrl: companyLogoUrl, name: companyDisplayName }

  return (
    <CenterCard branding={branding}>
      {showSpinner && !success ? (
        <div className="flex flex-col items-center gap-4 py-4">
          <Spinner className="h-8 w-8 text-accent-strong" />
          <p className="text-sm text-ink-muted">
            {submitting ? 'Processing your response...' : 'Loading...'}
          </p>
        </div>
      ) : success ? (
        <div>
          {action === 'accept' ? (
            <StatusCircle kind="success" label="Accepted" />
          ) : (
            <StatusCircle kind="declined" label="Declined" />
          )}
          <h2 className="mb-2 text-xl font-semibold tracking-tight text-ink">
            {action === 'accept' ? 'Quote accepted' : 'Quote declined'}
          </h2>
          <p className="text-sm leading-relaxed text-ink-muted">
            {action === 'accept' ? (
              <>
                Thank you for accepting quote{' '}
                <span className="font-mono tabular-nums">{quoteNumber}</span>. The contractor has
                been notified and will be in touch soon.
              </>
            ) : (
              <>
                We've recorded that you declined quote{' '}
                <span className="font-mono tabular-nums">{quoteNumber}</span>. The contractor has
                been notified.
              </>
            )}
          </p>
          <p className="mt-6 text-[13px] text-ink-subtle">You can safely close this window.</p>
        </div>
      ) : action === 'decline' ? (
        <div className="space-y-4 text-left">
          <h2 className="text-center text-xl font-semibold tracking-tight text-ink">
            Decline this quote?
          </h2>
          <p className="text-center text-sm text-ink-muted">
            Optionally let the contractor know why (they will see this in JobDock).
          </p>
          <PublicTextArea
            id="decline-reason"
            label={
              <>
                Reason <span className="font-normal text-ink-subtle">(optional)</span>
              </>
            }
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value.slice(0, DECLINE_REASON_MAX_LEN))}
            rows={4}
            placeholder="e.g. timing, budget, going with another contractor…"
          />
          <p className="text-right font-mono text-xs tabular-nums text-ink-subtle">
            {declineReason.length}/{DECLINE_REASON_MAX_LEN}
          </p>
          {error && (
            <p className="text-center text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <PublicButton
              variant="danger"
              onClick={handleDeclineSubmit}
              disabled={submitting}
              isLoading={submitting}
              className="sm:w-auto"
              fullWidth
            >
              Submit decline
            </PublicButton>
          </div>
        </div>
      ) : action === 'accept' ? (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Accept this quote?</h2>
          <p className="text-sm text-ink-muted">
            Confirm below to accept the quote. The contractor will be notified.
          </p>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <PublicButton
              onClick={handleAcceptSubmit}
              disabled={submitting}
              isLoading={submitting}
              className="sm:w-auto"
              fullWidth
            >
              {submitting ? 'Processing…' : 'Accept quote'}
            </PublicButton>
          </div>
        </div>
      ) : (
        <div>
          <StatusCircle kind="danger" label="Error" />
          <h2 className="mb-2 text-xl font-semibold tracking-tight text-ink">Something went wrong</h2>
          <p className="text-sm leading-relaxed text-ink-muted">{error}</p>
          <p className="mt-6 text-[13px] text-ink-subtle">
            Please contact the contractor directly if you need assistance.
          </p>
        </div>
      )}
    </CenterCard>
  )
}

export default QuoteApprovalPage
