import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { serviceSchema, type ServiceFormData } from '../schemas/serviceSchemas'
import { Service } from '../types/service'
import { Input, Button, TimePicker, Checkbox } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface ServiceFormProps {
  service?: Service
  onSubmit: (data: ServiceFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

const ServiceForm = ({ service, onSubmit, onCancel, isLoading }: ServiceFormProps) => {
  const { theme } = useTheme()
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = useForm<ServiceFormData>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      name: service?.name || '',
      description: service?.description || '',
      duration: service?.duration || 60,
      price: service?.price,
      isActive: service?.isActive !== undefined ? service.isActive : true,
      availability: service?.availability || {
        workingHours: DAYS_OF_WEEK.map((day) => ({
          dayOfWeek: day.value,
          startTime: '09:00',
          endTime: '17:00',
          isWorking: day.value >= 1 && day.value <= 5, // Monday-Friday
        })),
        bufferTime: 15,
        advanceBookingDays: 30,
        sameDayBooking: false,
      },
      bookingSettings: service?.bookingSettings || {
        requireConfirmation: false,
        allowCancellation: true,
        cancellationHours: 24,
        maxBookingsPerSlot: 1,
        requireContactInfo: true,
        bookingFormFields: ['name', 'email', 'phone'],
      },
    },
  })

  const { fields: workingHoursFields, replace: replaceWorkingHours } = useFieldArray({
    control,
    name: 'availability.workingHours',
  })

  useEffect(() => {
    if (service) {
      reset({
        name: service.name,
        description: service.description || '',
        duration: service.duration,
        price: service.price,
        isActive: service.isActive,
        availability: service.availability,
        bookingSettings: service.bookingSettings,
      })
    } else {
      // Initialize working hours if creating new service
      replaceWorkingHours(
        DAYS_OF_WEEK.map((day) => ({
          dayOfWeek: day.value,
          startTime: '09:00',
          endTime: '17:00',
          isWorking: day.value >= 1 && day.value <= 5,
        }))
      )
    }
  }, [service, reset, replaceWorkingHours])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <Input
          label="Service Name *"
          {...register('name')}
          error={errors.name?.message}
          placeholder="e.g., Consultation, Site Visit"
        />

        <div>
          <label className={cn(
            "block text-sm font-medium mb-2",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>
            Description
          </label>
          <textarea
            {...register('description')}
            rows={3}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold",
              theme === 'dark'
                ? 'border-primary-blue bg-primary-dark-secondary text-primary-light placeholder:text-primary-light/50'
                : 'border-gray-200/20 bg-white text-primary-lightText placeholder:text-primary-lightTextSecondary'
            )}
            placeholder="Describe your service..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Duration (minutes) *"
            type="number"
            {...register('duration', { valueAsNumber: true })}
            error={errors.duration?.message}
            min={15}
            step={15}
          />

          <Input
            label="Price ($)"
            type="number"
            {...register('price', { valueAsNumber: true })}
            error={errors.price?.message}
            min={0}
            step={0.01}
          />
        </div>
      </div>

      {/* Working Hours */}
      <div className="space-y-4">
        <div>
          <h3 className={cn(
            "text-lg font-semibold mb-1",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>Working Hours</h3>
          <p className={cn(
            "text-sm mb-4",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            Set your availability for each day. Available time slots will be automatically generated based on your service duration and buffer time.
          </p>
        </div>
        <div className="space-y-2">
          {workingHoursFields.map((field, index) => (
            <div key={field.id} className={cn(
              "flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-3 rounded-lg border",
              theme === 'dark' 
                ? 'border-primary-blue bg-primary-dark-secondary' 
                : 'border-gray-200/20 bg-gray-50'
            )}>
              <div className="w-full sm:w-24 sm:flex-shrink-0">
                <label className={cn(
                  "text-sm font-medium",
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
                  {DAYS_OF_WEEK.find((d) => d.value === field.dayOfWeek)?.label}
                </label>
              </div>
              <Checkbox
                  {...register(`availability.workingHours.${index}.isWorking`)}
                label="Available"
                />
              {watch(`availability.workingHours.${index}.isWorking`) && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-auto min-w-[100px]">
                    <Controller
                      name={`availability.workingHours.${index}.startTime`}
                      control={control}
                      render={({ field }) => (
                        <TimePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Start"
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                  <span className={cn(
                    "whitespace-nowrap",
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>to</span>
                  <div className="w-auto min-w-[100px]">
                    <Controller
                      name={`availability.workingHours.${index}.endTime`}
                      control={control}
                      render={({ field }) => (
                        <TimePicker
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="End"
                          className="w-full"
                        />
                      )}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Availability Settings */}
      <div className="space-y-4">
        <h3 className={cn(
          "text-lg font-semibold",
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>Availability Settings</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Buffer Time (minutes)"
            type="number"
            {...register('availability.bufferTime', { valueAsNumber: true })}
            error={errors.availability?.bufferTime?.message}
            min={0}
          />

          <Input
            label="Advance Booking Days"
            type="number"
            {...register('availability.advanceBookingDays', { valueAsNumber: true })}
            error={errors.availability?.advanceBookingDays?.message}
            min={1}
          />
        </div>

        <Checkbox
            {...register('availability.sameDayBooking')}
          label="Allow same-day booking"
          />
      </div>

      {/* Booking Settings */}
      <div className="space-y-4">
        <h3 className={cn(
          "text-lg font-semibold",
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>Booking Settings</h3>
        <div className="space-y-2">
          <Checkbox
              {...register('bookingSettings.requireConfirmation')}
            label="Require confirmation"
            />

          <Checkbox
              {...register('bookingSettings.allowCancellation')}
            label="Allow cancellation"
            />

          <Checkbox
              {...register('bookingSettings.requireContactInfo')}
            label="Require contact information"
            />
        </div>

        <Input
          label="Cancellation Hours (hours before appointment)"
          type="number"
          {...register('bookingSettings.cancellationHours', { valueAsNumber: true })}
          error={errors.bookingSettings?.cancellationHours?.message}
          min={0}
        />

        <Input
          label="Max Bookings Per Slot"
          type="number"
          {...register('bookingSettings.maxBookingsPerSlot', { valueAsNumber: true })}
          error={errors.bookingSettings?.maxBookingsPerSlot?.message}
          min={1}
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? 'Saving...' : service ? 'Update Service' : 'Create Service'}
        </Button>
      </div>
    </form>
  )
}

export default ServiceForm

