import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { publicApiClient } from '@/lib/api/client'
import { servicesService } from '@/lib/api/services'
import { settingsApi } from '@/lib/api/settings'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { DaySlots, AvailableSlot } from '../types/booking'

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
      } catch (err: any) {
        console.error('Failed to load reschedule info:', err)
        setError(
          err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            'Failed to load booking details. The link may be invalid or expired.'
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
    } catch (err: any) {
      console.error('Reschedule failed:', err)
      setError(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message ||
          'Failed to reschedule. Please try again.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-gold mx-auto mb-4"></div>
          <p className="text-primary-light/70">Loading your booking...</p>
        </div>
      </div>
    )
  }

  if (error && !info) {
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-2xl font-semibold text-red-500 mb-2">Unable to Load</h2>
          <p className="text-primary-light/70 mb-6">{error}</p>
        </Card>
      </div>
    )
  }

  if (success) {
    const companyName = branding?.companyDisplayName || branding?.tenantName || null
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          {(branding?.logoSignedUrl || companyName) && (
            <div className="flex justify-center gap-3 mb-6">
              {branding?.logoSignedUrl && (
                <img
                  src={branding.logoSignedUrl}
                  alt={companyName || 'Logo'}
                  className="h-10 w-auto max-w-[150px] object-contain"
                />
              )}
              {companyName && (
                <h2 className="text-lg font-semibold text-primary-light">{companyName}</h2>
              )}
            </div>
          )}
          <div
            className={cn(
              'w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4',
              success.requireConfirmation ? 'bg-orange-500/20' : 'bg-green-500/20'
            )}
          >
            {success.requireConfirmation ? (
              <svg
                className="w-8 h-8 text-orange-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ) : (
              <svg
                className="w-8 h-8 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-primary-gold mb-2">
            {success.requireConfirmation
              ? 'Reschedule Request Sent!'
              : 'Reschedule Confirmed!'}
          </h1>
          <p className="text-primary-light/70">
            {success.requireConfirmation
              ? "Your new time has been requested. We'll send you an email once it's confirmed."
              : 'Your appointment has been rescheduled successfully.'}
          </p>
        </Card>
      </div>
    )
  }

  const companyName = branding?.companyDisplayName || branding?.tenantName || null

  return (
    <div className="min-h-screen bg-primary-dark">
      <div className="bg-primary-dark-secondary border-b border-primary-blue">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {(branding?.logoSignedUrl || companyName) && (
            <div className="flex gap-4 mb-4">
              {branding?.logoSignedUrl && (
                <img
                  src={branding.logoSignedUrl}
                  alt={companyName || 'Logo'}
                  className="h-12 w-auto max-w-[200px] object-contain"
                />
              )}
              {companyName && (
                <h2 className="text-xl md:text-2xl font-semibold text-primary-light">
                  {companyName}
                </h2>
              )}
            </div>
          )}
          <h1 className="text-2xl md:text-3xl font-bold text-primary-gold">
            Reschedule Your Booking
          </h1>
          <p className="text-primary-light/70 mt-1">
            Choose a new date and time for your appointment
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {info && (
          <>
            {error && (
              <Card className="bg-red-500/10 border-red-500 mb-6">
                <p className="text-sm text-red-500">{error}</p>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <Card>
                <h3 className="text-lg font-semibold text-primary-light mb-3">
                  Current Booking
                </h3>
                <div className="space-y-2 text-primary-light/80">
                  <p>
                    <span className="font-medium text-primary-light">Service:</span>{' '}
                    {info.serviceName}
                  </p>
                  <p>
                    <span className="font-medium text-primary-light">Current time:</span>{' '}
                    {format(new Date(info.startTime), 'EEEE, MMMM d, yyyy')} at{' '}
                    {format(new Date(info.startTime), 'h:mm a')} -{' '}
                    {format(new Date(info.endTime), 'h:mm a')}
                  </p>
                </div>
              </Card>

              <div>
                <Card className="mb-4">
                  <AvailabilityCalendar
                    slots={availableSlots}
                    selectedSlot={selectedSlot}
                    onSlotSelect={setSelectedSlot}
                    isLoading={slotsLoading}
                  />
                </Card>

                <Button
                  onClick={handleSubmit}
                  disabled={!selectedSlot || submitting}
                  className="w-full"
                >
                  {submitting ? 'Rescheduling...' : 'Reschedule Appointment'}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default PublicReschedulePage
