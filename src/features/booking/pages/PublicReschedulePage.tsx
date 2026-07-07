import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'
import { servicesService } from '@/lib/api/services'
import { settingsApi } from '@/lib/api/settings'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import { format } from 'date-fns'
import type { DaySlots, AvailableSlot } from '../types/booking'
import {
  CenterCard,
  PublicButton,
  PublicLoading,
  PublicPanel,
  PublicShell,
  StatusCircle,
} from '@/components/public/publicUi'

interface RescheduleInfo {
  jobId: string
  tenantId?: string
  serviceId: string
  serviceName: string
  startTime: string
  endTime: string
  location: string | null
  requireConfirmation: boolean
  contact: { firstName: string; lastName: string } | null
}

const PublicReschedulePage = () => {
  const { jobId } = useParams<{ jobId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<RescheduleInfo | null>(null)
  const [availableSlots, setAvailableSlots] = useState<DaySlots[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [success, setSuccess] = useState<{ requireConfirmation: boolean } | null>(null)
  const [branding, setBranding] = useState<{
    companyDisplayName?: string
    tenantName?: string
    logoSignedUrl?: string | null
  } | null>(null)

  useEffect(() => {
    if (!jobId || !token) {
      setError('Invalid link. Missing job ID or token.')
      setLoading(false)
      return
    }

    const load = async () => {
      try {
        const data = await publicApiClient.get(`/jobs/${jobId}/reschedule-info`, {
          params: { token },
        })
        setInfo(data.data)
        if ((data.data as RescheduleInfo)?.serviceId) {
          setSlotsLoading(true)
          const rangeStart = new Date()
          const rangeEnd = new Date()
          rangeEnd.setDate(rangeEnd.getDate() + 60)
          const avail = await servicesService.getAvailability(
            (data.data as RescheduleInfo).serviceId,
            rangeStart,
            rangeEnd
          )
          setAvailableSlots(avail?.slots || [])
          setSlotsLoading(false)
        }
        const rescheduleData = data.data as RescheduleInfo
        if (rescheduleData?.tenantId) {
          settingsApi
            .getPublicSettings(rescheduleData.tenantId)
            .then(setBranding)
            .catch(() => {})
        }
      } catch (err: unknown) {
        console.error('Failed to load reschedule info:', err)
        setError(
          getErrorMessage(err, 'Failed to load booking details. The link may be invalid or expired.')
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [jobId, token])

  const handleSubmit = async () => {
    if (!jobId || !token || !selectedSlot) return

    setSubmitting(true)
    setError(null)
    try {
      const response = await publicApiClient.post(
        `/jobs/${jobId}/reschedule-public`,
        { startTime: selectedSlot.start },
        { params: { token } }
      )
      setSuccess({
        requireConfirmation: response.data?.requireConfirmation ?? false,
      })
    } catch (err: unknown) {
      console.error('Reschedule failed:', err)
      setError(getErrorMessage(err, 'Failed to reschedule. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const companyName = branding?.companyDisplayName || branding?.tenantName || null
  const publicBranding = branding ? { logoSignedUrl: branding.logoSignedUrl, name: companyName } : null

  if (loading) {
    return <PublicLoading message="Loading your booking..." />
  }

  if (error && !info) {
    return (
      <CenterCard>
        <StatusCircle kind="danger" label="Error" />
        <h2 className="mb-2 text-xl font-semibold tracking-tight text-ink">Unable to load</h2>
        <p className="text-sm leading-relaxed text-ink-muted">{error}</p>
      </CenterCard>
    )
  }

  if (success) {
    return (
      <CenterCard branding={publicBranding}>
        {success.requireConfirmation ? (
          <StatusCircle kind="pending" label="Pending confirmation" />
        ) : (
          <StatusCircle kind="success" label="Confirmed" />
        )}
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-ink">
          {success.requireConfirmation ? 'Reschedule request sent' : 'Reschedule confirmed'}
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          {success.requireConfirmation
            ? "Your new time has been requested. We'll send you an email once it's confirmed."
            : 'Your appointment has been rescheduled successfully.'}
        </p>
      </CenterCard>
    )
  }

  return (
    <PublicShell
      branding={publicBranding}
      title="Reschedule your booking"
      subtitle="Choose a new date and time for your appointment"
      width="max-w-4xl"
    >
      {info && (
        <>
          {error && (
            <div className="mb-6 rounded-xl bg-danger-soft px-4 py-3" role="alert">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <PublicPanel className="p-5">
                <h3 className="mb-3 text-lg font-semibold tracking-tight text-ink">Current booking</h3>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-muted">Service</span>
                    <span className="text-right font-medium text-ink">{info.serviceName}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-ink-muted">Current time</span>
                    <span className="text-right font-mono font-medium tabular-nums text-ink">
                      {format(new Date(info.startTime), 'EEE, MMM d, yyyy')}
                      <br />
                      {format(new Date(info.startTime), 'h:mm a')} –{' '}
                      {format(new Date(info.endTime), 'h:mm a')}
                    </span>
                  </div>
                </div>
              </PublicPanel>
            </div>

            <div>
              <div className="mb-4">
                <AvailabilityCalendar
                  slots={availableSlots}
                  selectedSlot={selectedSlot}
                  onSlotSelect={setSelectedSlot}
                  isLoading={slotsLoading}
                />
              </div>

              <PublicButton
                onClick={handleSubmit}
                disabled={!selectedSlot || submitting}
                isLoading={submitting}
                fullWidth
              >
                {submitting ? 'Rescheduling...' : 'Reschedule appointment'}
              </PublicButton>
            </div>
          </div>
        </>
      )}
    </PublicShell>
  )
}

export default PublicReschedulePage
