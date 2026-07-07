import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBookingStore } from '../store/bookingStore'
import ServicePicker from '../components/ServicePicker'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import BookingForm from '../components/BookingForm'
import { format } from 'date-fns'
import type { AvailableSlot, BookingFormValues } from '../types/booking'
import { settingsApi } from '@/lib/api/settings'
import {
  CenterCard,
  PublicButton,
  PublicPanel,
  PublicShell,
  StatusCircle,
} from '@/components/public/publicUi'

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const PublicBookingPage = () => {
  const { serviceId } = useParams<{ serviceId?: string }>()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [branding, setBranding] = useState<{
    companyDisplayName?: string
    tenantName?: string
    logoSignedUrl?: string | null
  } | null>(null)

  // Extract tenantId from query params if present (for tenant-level booking links)
  const searchParams = new URLSearchParams(window.location.search)
  const tenantId = searchParams.get('tenant')

  const {
    services,
    selectedService,
    availableSlots,
    selectedSlot,
    isLoading,
    error,
    bookingConfirmation,
    loadServicesForBooking,
    selectService,
    selectSlot,
    submitBooking,
    resetBooking,
    clearError,
  } = useBookingStore()

  useEffect(() => {
    // Load branding if tenantId is in URL
    if (tenantId) {
      settingsApi
        .getPublicSettings(tenantId)
        .then(setBranding)
        .catch(error => {
          console.error('Failed to load tenant branding:', error)
          // Don't show error - branding is optional
        })
    }

    // Determine what to load:
    // - If serviceId in URL path: load that specific service
    // - If tenantId in query param: load all services for that tenant
    // - If neither: try to load all services (requires auth)
    if (serviceId) {
      loadServicesForBooking(serviceId, false).then(() => {
        selectService(serviceId)
      })
    } else if (tenantId) {
      loadServicesForBooking(tenantId, true)
    } else {
      loadServicesForBooking()
    }
  }, [loadServicesForBooking, selectService, serviceId, tenantId])

  // Load branding when service is loaded (for service-specific links)
  useEffect(() => {
    if (serviceId && services.length > 0 && !tenantId && !branding) {
      const service = services.find(s => s.id === serviceId) || services[0]
      if (service?.tenantId) {
        settingsApi
          .getPublicSettings(service.tenantId)
          .then(setBranding)
          .catch(error => {
            console.error('Failed to load tenant branding:', error)
            // Don't show error - branding is optional
          })
      }
    }
  }, [serviceId, services, tenantId, branding])

  const handleServiceSelect = (id: string) => {
    selectService(id)
  }

  const handleSlotSelect = (slot: AvailableSlot) => {
    selectSlot(slot)
  }

  const handleBookingSubmit = async (
    formData: BookingFormValues,
    recurrence?: { frequency: 'weekly' | 'monthly'; interval: number; count: number }
  ) => {
    if (!selectedSlot) return

    try {
      await submitBooking({
        startTime: selectedSlot.start,
        contact: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          address: formData.address,
          notes: formData.notes,
        },
        recurrence,
      })
      setShowConfirmation(true)
    } catch (error) {
      // Error is already set in store
      console.error('Booking failed:', error)
    }
  }

  const handleBookAnother = () => {
    setShowConfirmation(false)
    resetBooking()
    loadServicesForBooking()
  }

  const publicBranding = branding
    ? { logoSignedUrl: branding.logoSignedUrl, name: branding.companyDisplayName || null }
    : null

  // Show confirmation screen after successful booking
  if (showConfirmation && bookingConfirmation) {
    const requiresConfirmation = selectedService?.bookingSettings?.requireConfirmation ?? false
    const isRecurring =
      !!bookingConfirmation.occurrenceCount && bookingConfirmation.occurrenceCount > 1

    return (
      <CenterCard
        branding={
          branding
            ? {
                logoSignedUrl: branding.logoSignedUrl,
                name: branding.companyDisplayName || branding.tenantName || null,
              }
            : null
        }
      >
        {requiresConfirmation ? (
          <StatusCircle kind="pending" label="Pending confirmation" />
        ) : (
          <StatusCircle kind="success" label="Confirmed" />
        )}
        <h1 className="mb-2 text-xl font-semibold tracking-tight text-ink">
          {requiresConfirmation ? 'Booking request received' : 'Booking confirmed'}
        </h1>
        <p className="text-sm leading-relaxed text-ink-muted">
          {requiresConfirmation
            ? 'Your booking request has been received and is pending confirmation'
            : 'Your appointment has been successfully booked'}
        </p>

        <div className="my-6 space-y-2.5 rounded-xl bg-surface-2 p-4 text-left text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">Service</span>
            <span className="text-right font-medium text-ink">{bookingConfirmation.serviceName}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">{isRecurring ? 'First visit' : 'Date'}</span>
            <span className="text-right font-mono font-medium tabular-nums text-ink">
              {format(new Date(bookingConfirmation.startTime), 'EEEE, MMMM d, yyyy')}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">Time</span>
            <span className="text-right font-mono font-medium tabular-nums text-ink">
              {format(new Date(bookingConfirmation.startTime), 'h:mm a')} –{' '}
              {format(new Date(bookingConfirmation.endTime), 'h:mm a')}
            </span>
          </div>
          {isRecurring && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-ink-muted">Total visits</span>
              <span className="text-right font-mono font-medium tabular-nums text-ink">
                {bookingConfirmation.occurrenceCount}
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-muted">Name</span>
            <span className="text-right font-medium text-ink">{bookingConfirmation.contactName}</span>
          </div>
        </div>

        <p className="mb-6 text-[13px] leading-relaxed text-ink-subtle">
          {requiresConfirmation
            ? "You'll receive an email once the contractor confirms your request. This typically happens within 24 hours."
            : isRecurring
              ? `You'll receive a confirmation email shortly with details for all ${bookingConfirmation.occurrenceCount} scheduled visits.`
              : "You'll receive a confirmation email shortly with all the details."}
        </p>

        <PublicButton onClick={handleBookAnother} fullWidth>
          Book another appointment
        </PublicButton>
      </CenterCard>
    )
  }

  return (
    <PublicShell
      branding={publicBranding}
      title="Book an appointment"
      subtitle="Select a service and choose your preferred time"
    >
      {/* Error display - only show non-empty-services errors */}
      {error && error !== 'No services are currently available for booking' && (
        <div
          className="mb-6 flex items-center justify-between gap-3 rounded-xl bg-danger-soft px-4 py-3"
          role="alert"
        >
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={clearError}
            className="shrink-0 text-sm font-semibold text-danger transition-opacity hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && services.length === 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i}>
              <div className="mb-4 h-5 w-36 animate-pulse rounded bg-surface-2" />
              <div className="h-48 animate-pulse rounded-2xl bg-surface shadow-card ring-1 ring-line" />
            </div>
          ))}
        </div>
      )}

      {/* No services available - friendly message */}
      {!isLoading && services.length === 0 && (
        <PublicPanel className="mx-auto max-w-2xl">
          <div className="px-6 py-12 text-center">
            <StatusCircle kind="pending" label="No services" />
            <h2 className="mb-2 text-xl font-semibold tracking-tight text-ink">No services available</h2>
            <p className="mb-1 text-sm text-ink-muted">
              This business hasn't set up any services yet.
            </p>
            <p className="text-sm text-ink-subtle">
              Please check back later or contact them directly to schedule an appointment.
            </p>
          </div>
        </PublicPanel>
      )}

      {/* Main booking interface */}
      {services.length > 0 && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Service picker */}
          <div className="lg:col-span-1">
            <ServicePicker
              services={services}
              selectedServiceId={selectedService?.id || null}
              onServiceSelect={handleServiceSelect}
            />
          </div>

          {/* Middle: Calendar */}
          <div className="lg:col-span-1">
            {selectedService ? (
              <AvailabilityCalendar
                slots={availableSlots}
                selectedSlot={selectedSlot}
                onSlotSelect={handleSlotSelect}
                isLoading={isLoading}
              />
            ) : (
              <PublicPanel className="p-6">
                <div className="py-10 text-center">
                  <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-ink-subtle/60" />
                  <p className="text-sm text-ink-muted">Select a service to view availability</p>
                </div>
              </PublicPanel>
            )}
          </div>

          {/* Right: Booking form */}
          <div className="lg:col-span-1">
            <BookingForm
              service={selectedService}
              selectedSlot={selectedSlot}
              onSubmit={handleBookingSubmit}
              isLoading={isLoading}
            />
          </div>
        </div>
      )}
    </PublicShell>
  )
}

export default PublicBookingPage
