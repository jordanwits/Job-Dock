import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { format, addDays, addWeeks, addMonths } from 'date-fns'
import {
  PublicButton,
  PublicPanel,
  PublicPhoneField,
  PublicSelectField,
  PublicTextArea,
  PublicTextField,
} from '@/components/public/publicUi'
import type { AvailableSlot, RecurrenceFrequency } from '../types/booking'
import type { Service } from '@/features/scheduling/types/service'
import { normalizePhoneNumber } from '@/lib/utils/phone'

const bookingFormSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z
    .string()
    .refine((value) => normalizePhoneNumber(value).length >= 10, 'Phone number must be at least 10 digits'),
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

const CalendarIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

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
    if (frequency === 'daily') {
      endDate = addDays(start, interval * count)
    } else if (frequency === 'weekly') {
      endDate = addWeeks(start, interval * count)
    } else if (frequency === 'monthly') {
      endDate = addMonths(start, interval * count)
    }

    return format(endDate, 'MMM d, yyyy')
  }

  if (!service || !selectedSlot) {
    return (
      <PublicPanel className="p-6">
        <div className="py-8 text-center">
          <CalendarIcon className="mx-auto mb-3 h-10 w-10 text-ink-subtle/60" />
          <p className="text-sm text-ink-muted">Please select a service and time slot to continue</p>
        </div>
      </PublicPanel>
    )
  }

  const bookingSettings = service.bookingSettings
  const requiredFields = bookingSettings?.bookingFormFields || ['name', 'email', 'phone']

  return (
    <PublicPanel className="p-5 sm:p-6">
      <h3 className="mb-4 text-lg font-semibold tracking-tight text-ink">Your information</h3>

      {/* Booking summary */}
      <div className="mb-6 rounded-xl bg-accent-soft/50 p-4 ring-1 ring-inset ring-accent/20">
        <p className="font-medium text-ink">{service.name}</p>
        <p className="mt-1 font-mono text-sm tabular-nums text-ink-muted">
          {format(new Date(selectedSlot.start), 'EEEE, MMMM d, yyyy')}
        </p>
        <p className="font-mono text-sm tabular-nums text-ink-muted">
          {format(new Date(selectedSlot.start), 'h:mm a')} – {format(new Date(selectedSlot.end), 'h:mm a')}
          {service.duration ? ` · ${service.duration} min` : ''}
        </p>
      </div>

      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <PublicTextField
          label="Full name *"
          {...register('name')}
          error={errors.name?.message}
          placeholder="John Doe"
          autoComplete="name"
          disabled={isLoading}
        />

        {requiredFields.includes('email') && (
          <PublicTextField
            label="Email *"
            type="email"
            {...register('email')}
            error={errors.email?.message}
            placeholder="john@example.com"
            autoComplete="email"
            disabled={isLoading}
          />
        )}

        {requiredFields.includes('phone') && (
          <PublicPhoneField
            label="Phone *"
            {...register('phone')}
            error={errors.phone?.message}
            placeholder="123-456-7890"
            autoComplete="tel"
            disabled={isLoading}
          />
        )}

        {requiredFields.includes('company') && (
          <PublicTextField
            label="Company"
            {...register('company')}
            error={errors.company?.message}
            placeholder="Acme Inc."
            autoComplete="organization"
            disabled={isLoading}
          />
        )}

        <PublicTextField
          label="Address"
          {...register('address')}
          error={errors.address?.message}
          placeholder="123 Main St, City, State ZIP"
          autoComplete="street-address"
          disabled={isLoading}
        />

        {/* Recurrence */}
        <div className="border-t border-line pt-4">
          <PublicSelectField
            label="How often?"
            value={repeatPattern}
            onChange={(e) => setRepeatPattern(e.target.value)}
            disabled={isLoading}
            options={[
              { value: 'none', label: 'One-time only' },
              { value: 'daily-1', label: 'Every day' },
              { value: 'daily-2', label: 'Every 2 days' },
              { value: 'weekly-1', label: 'Every week' },
              { value: 'weekly-2', label: 'Every 2 weeks' },
              { value: 'weekly-4', label: 'Every 4 weeks' },
              { value: 'monthly-1', label: 'Every month' },
            ]}
          />

          {repeatPattern !== 'none' && (
            <div className="mt-3 space-y-3">
              <PublicSelectField
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
                <p className="rounded-lg bg-surface-2 px-3 py-2.5 font-mono text-xs tabular-nums text-ink-muted">
                  {occurrenceCount} visits scheduled through {getRecurrenceEndDate()}
                </p>
              )}
            </div>
          )}
        </div>

        {requiredFields.includes('notes') && (
          <PublicTextArea
            label="Additional notes"
            {...register('notes')}
            rows={3}
            placeholder="Any special requests or information..."
            disabled={isLoading}
          />
        )}

        <PublicButton type="submit" disabled={isLoading} isLoading={isLoading} fullWidth>
          {isLoading
            ? 'Booking...'
            : repeatPattern !== 'none'
              ? `Book ${occurrenceCount} visits`
              : 'Confirm booking'}
        </PublicButton>

        {bookingSettings?.requireConfirmation && (
          <p className="text-center text-xs text-ink-subtle">
            Your booking will require confirmation from the service provider
          </p>
        )}
      </form>
    </PublicPanel>
  )
}

export default BookingForm
