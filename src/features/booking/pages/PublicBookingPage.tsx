import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useBookingStore } from '../store/bookingStore'
import ServicePicker from '../components/ServicePicker'
import AvailabilityCalendar from '../components/AvailabilityCalendar'
import BookingForm from '../components/BookingForm'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import type { BookingFormValues } from '../types/booking'

const PublicBookingPage = () => {
  const { serviceId } = useParams<{ serviceId?: string }>()
  const [showConfirmation, setShowConfirmation] = useState(false)

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
    console.log('PublicBookingPage mounted, serviceId from URL:', serviceId)
    loadServicesForBooking().then(() => {
      console.log('Services loaded, attempting to select service:', serviceId)
      // If serviceId is in URL, preselect that service
      if (serviceId) {
        selectService(serviceId)
      } else {
        console.log('No serviceId in URL')
      }
    })
  }, [loadServicesForBooking, selectService, serviceId])

  const handleServiceSelect = (id: string) => {
    selectService(id)
  }

  const handleSlotSelect = (slot: any) => {
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

  // Show confirmation screen after successful booking
  if (showConfirmation && bookingConfirmation) {
    const requiresConfirmation = selectedService?.bookingSettings?.requireConfirmation ?? false
    
    return (
      <div className="min-h-screen bg-primary-dark flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <div className="mb-6">
            <div className={cn(
              "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4",
              requiresConfirmation ? "bg-orange-500/20" : "bg-green-500/20"
            )}>
              {requiresConfirmation ? (
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <h1 className="text-2xl font-bold text-primary-gold mb-2">
              {requiresConfirmation ? 'Booking Request Received!' : 'Booking Confirmed!'}
            </h1>
            <p className="text-primary-light/70">
              {requiresConfirmation 
                ? "Your booking request has been received and is pending confirmation"
                : "Your appointment has been successfully booked"}
            </p>
          </div>

          <div className="bg-primary-blue/10 border border-primary-blue rounded-lg p-4 mb-6 space-y-2 text-left">
            <div className="flex justify-between">
              <span className="text-primary-light/70">Service:</span>
              <span className="text-primary-light font-medium">
                {bookingConfirmation.serviceName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-light/70">
                {bookingConfirmation.occurrenceCount && bookingConfirmation.occurrenceCount > 1 ? 'First Visit:' : 'Date:'}
              </span>
              <span className="text-primary-light font-medium">
                {format(new Date(bookingConfirmation.startTime), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-primary-light/70">Time:</span>
              <span className="text-primary-light font-medium">
                {format(new Date(bookingConfirmation.startTime), 'h:mm a')} - {format(new Date(bookingConfirmation.endTime), 'h:mm a')}
              </span>
            </div>
            {bookingConfirmation.occurrenceCount && bookingConfirmation.occurrenceCount > 1 && (
              <div className="flex justify-between">
                <span className="text-primary-light/70">Total Visits:</span>
                <span className="text-primary-light font-medium">
                  {bookingConfirmation.occurrenceCount}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-primary-light/70">Name:</span>
              <span className="text-primary-light font-medium">
                {bookingConfirmation.contactName}
              </span>
            </div>
          </div>

          <p className="text-sm text-primary-light/70 mb-6">
            {requiresConfirmation
              ? "You'll receive an email once the contractor confirms your request. This typically happens within 24 hours."
              : bookingConfirmation.occurrenceCount && bookingConfirmation.occurrenceCount > 1
              ? `You'll receive a confirmation email shortly with details for all ${bookingConfirmation.occurrenceCount} scheduled visits.`
              : "You'll receive a confirmation email shortly with all the details."}
          </p>

          <Button onClick={handleBookAnother} className="w-full">
            Book Another Appointment
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-primary-dark">
      {/* Header */}
      <div className="bg-primary-dark-secondary border-b border-primary-blue">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary-gold">
            Book an Appointment
          </h1>
          <p className="text-primary-light/70 mt-1">
            Select a service and choose your preferred time
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Error display */}
        {error && (
          <Card className="bg-red-500/10 border-red-500 mb-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-500">{error}</p>
              <Button variant="ghost" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </Card>
        )}

        {/* Loading state */}
        {isLoading && services.length === 0 && (
          <div className="text-center py-12">
            <p className="text-primary-light/70">Loading services...</p>
          </div>
        )}

        {/* No services available */}
        {!isLoading && services.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-primary-light/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-primary-light/70">
                No services are currently available for booking
              </p>
            </div>
          </Card>
        )}

        {/* Main booking interface */}
        {services.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                <Card>
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 mx-auto text-primary-light/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-primary-light/70">
                      Select a service to view availability
                    </p>
                  </div>
                </Card>
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
      </div>
    </div>
  )
}

export default PublicBookingPage

