import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Input, Button, Card, Select } from '@/components/ui'
import { format, addWeeks, addMonths } from 'date-fns'
import type { AvailableSlot, RecurrenceFrequency } from '../types/booking'
import type { Service } from '@/features/scheduling/types/service'

const bookingFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits'),
  company: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})

type BookingFormData = z.infer<typeof bookingFormSchema>

interface BookingFormProps {
  service: Service | null
  selectedSlot: AvailableSlot | null
  onSubmit: (data: BookingFormData, recurrence?: { frequency: RecurrenceFrequency; interval: number; count: number }) => Promise<void>
  isLoading?: boolean
}

const BookingForm = ({ service, selectedSlot, onSubmit, isLoading }: BookingFormProps) => {
  const [repeatPattern, setRepeatPattern] = useState<string>('none')
  const [occurrenceCount, setOccurrenceCount] = useState<number>(6)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
  })
  
  const handleFormSubmit = async (data: BookingFormData) => {
    let recurrence
    if (repeatPattern !== 'none') {
      const [frequency, intervalStr] = repeatPattern.split('-') as [RecurrenceFrequency, string]
      const interval = parseInt(intervalStr) || 1
      recurrence = { frequency, interval, count: occurrenceCount }
    }
    await onSubmit(data, recurrence)
  }
  
  const getRecurrenceEndDate = () => {
    if (!selectedSlot || repeatPattern === 'none') return null
    
    const start = new Date(selectedSlot.start)
    const [frequency, intervalStr] = repeatPattern.split('-')
    const interval = parseInt(intervalStr) || 1
    const count = occurrenceCount - 1
    
    let endDate = new Date(start)
    if (frequency === 'weekly') {
      endDate = addWeeks(start, interval * count)
    } else if (frequency === 'monthly') {
      endDate = addMonths(start, interval * count)
    }
    
    return format(endDate, 'MMM d, yyyy')
  }

  if (!service || !selectedSlot) {
    return (
      <Card>
        <div className="text-center py-8">
          <svg className="w-12 h-12 mx-auto text-primary-light/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-primary-light/70">
            Please select a service and time slot to continue
          </p>
        </div>
      </Card>
    )
  }

  const bookingSettings = service.bookingSettings
  const requiredFields = bookingSettings?.bookingFormFields || ['name', 'email', 'phone']

  return (
    <Card>
      <h3 className="text-lg font-semibold text-primary-light mb-4">
        Your Information
      </h3>

      {/* Booking summary */}
      <div className="mb-6 p-3 rounded-lg bg-primary-blue/10 border border-primary-blue">
        <div className="space-y-1 text-sm">
          <p className="text-primary-light font-medium">{service.name}</p>
          <p className="text-primary-light/70">
            {format(new Date(selectedSlot.start), 'EEEE, MMMM d, yyyy')}
          </p>
          <p className="text-primary-light/70">
            {format(new Date(selectedSlot.start), 'h:mm a')} - {format(new Date(selectedSlot.end), 'h:mm a')}
          </p>
          {service.duration && (
            <p className="text-primary-light/70">{service.duration} minutes</p>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <Input
          label="Full Name *"
          {...register('name')}
          error={errors.name?.message}
          placeholder="John Doe"
          disabled={isLoading}
        />

        {requiredFields.includes('email') && (
          <Input
            label="Email *"
            type="email"
            {...register('email')}
            error={errors.email?.message}
            placeholder="john@example.com"
            disabled={isLoading}
          />
        )}

        {requiredFields.includes('phone') && (
          <Input
            label="Phone *"
            type="tel"
            {...register('phone')}
            error={errors.phone?.message}
            placeholder="(555) 123-4567"
            disabled={isLoading}
          />
        )}

        {requiredFields.includes('company') && (
          <Input
            label="Company"
            {...register('company')}
            error={errors.company?.message}
            placeholder="Acme Inc."
            disabled={isLoading}
          />
        )}

        <Input
          label="Address"
          {...register('address')}
          error={errors.address?.message}
          placeholder="123 Main St, City, State ZIP"
          disabled={isLoading}
        />

        {/* Recurrence Section */}
        <div className="border-t border-primary-blue pt-3">
          <label className="block text-sm font-medium text-primary-light mb-2">
            How often?
          </label>
          <Select
            value={repeatPattern}
            onChange={(e) => setRepeatPattern(e.target.value)}
            disabled={isLoading}
            options={[
              { value: 'none', label: 'One-time only' },
              { value: 'weekly-1', label: 'Every week' },
              { value: 'weekly-2', label: 'Every 2 weeks' },
              { value: 'weekly-4', label: 'Every 4 weeks' },
              { value: 'monthly-1', label: 'Every month' },
            ]}
          />
          
          {repeatPattern !== 'none' && (
            <div className="mt-3 space-y-3">
              <Select
                label="Number of visits"
                value={occurrenceCount.toString()}
                onChange={(e) => setOccurrenceCount(Number(e.target.value))}
                disabled={isLoading}
                options={[
                  { value: '2', label: '2 visits' },
                  { value: '3', label: '3 visits' },
                  { value: '4', label: '4 visits' },
                  { value: '6', label: '6 visits' },
                  { value: '8', label: '8 visits' },
                  { value: '12', label: '12 visits' },
                ]}
              />
              
              {getRecurrenceEndDate() && (
                <div className="p-3 rounded-lg bg-primary-blue/10 border border-primary-blue">
                  <p className="text-xs text-primary-light/70">
                    {occurrenceCount} visits scheduled through {getRecurrenceEndDate()}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {requiredFields.includes('notes') && (
          <div>
            <label className="block text-sm font-medium text-primary-light mb-2">
              Additional Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Any special requests or information..."
              disabled={isLoading}
            />
          </div>
        )}

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Booking...' : repeatPattern !== 'none' ? `Book ${occurrenceCount} Visits` : 'Confirm Booking'}
        </Button>

        {bookingSettings?.requireConfirmation && (
          <p className="text-xs text-primary-light/60 text-center">
            Your booking will require confirmation from the service provider
          </p>
        )}
      </form>
    </Card>
  )
}

export default BookingForm

