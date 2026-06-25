import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef } from 'react'
import { serviceSchema, type ServiceFormData } from '../schemas/serviceSchemas'
import { Service } from '../types/service'
import { TimePicker } from '@/components/ui'
import {
  Alert,
  AlertIcon,
  AppButton,
  CheckboxField,
  TextAreaField,
  TextField,
} from './schedulingUi'

interface ServiceFormProps {
  service?: Service
  onSubmit: (data: ServiceFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
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

const ServiceForm = ({ service, onSubmit, onCancel, isLoading, error }: ServiceFormProps) => {
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) {
      const id = requestAnimationFrame(() => {
        errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
      return () => cancelAnimationFrame(id)
    }
  }, [error])

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
      {error && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
          {error}
        </Alert>
      )}
      <div className="space-y-4">
        <TextField
          label="Service name *"
          {...register('name')}
          error={errors.name?.message}
          placeholder="e.g., Consultation, Site Visit"
        />

        <TextAreaField
          label="Description"
          rows={3}
          {...register('description')}
          error={errors.description?.message}
          placeholder="Describe your service..."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Duration (minutes) *"
            type="number"
            {...register('duration', { valueAsNumber: true })}
            error={errors.duration?.message}
            min={15}
            step={15}
          />

          <TextField
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
          <h3 className="mb-1 text-[15px] font-semibold tracking-tight text-ink">Working hours</h3>
          <p className="text-sm leading-relaxed text-ink-muted">
            Set your availability for each day. Available time slots will be automatically generated based on your service duration and buffer time.
          </p>
        </div>
        <div className="space-y-2">
          {workingHoursFields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col items-stretch gap-3 rounded-xl border border-line bg-surface-2 p-4 sm:flex-row sm:items-center"
            >
              <div className="w-full sm:w-24 sm:flex-shrink-0">
                <span className="text-sm font-medium text-ink">
                  {DAYS_OF_WEEK.find((d) => d.value === field.dayOfWeek)?.label}
                </span>
              </div>
              <Controller
                name={`availability.workingHours.${index}.isWorking`}
                control={control}
                render={({ field: cbField }) => (
                  <CheckboxField
                    checked={!!cbField.value}
                    onChange={cbField.onChange}
                    label="Available"
                  />
                )}
              />
              {watch(`availability.workingHours.${index}.isWorking`) && (
                <div className="flex flex-shrink-0 items-center gap-2">
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
                  <span className="whitespace-nowrap text-ink-muted">to</span>
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
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">Availability settings</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            label="Buffer time (minutes)"
            type="number"
            {...register('availability.bufferTime', { valueAsNumber: true })}
            error={errors.availability?.bufferTime?.message}
            min={0}
          />

          <TextField
            label="Advance booking days"
            type="number"
            {...register('availability.advanceBookingDays', { valueAsNumber: true })}
            error={errors.availability?.advanceBookingDays?.message}
            min={1}
          />
        </div>

        <Controller
          name="availability.sameDayBooking"
          control={control}
          render={({ field }) => (
            <CheckboxField
              checked={!!field.value}
              onChange={field.onChange}
              label="Allow same-day booking"
            />
          )}
        />
      </div>

      {/* Booking Settings */}
      <div className="space-y-4">
        <h3 className="text-[15px] font-semibold tracking-tight text-ink">Booking settings</h3>
        <div className="space-y-3">
          <Controller
            name="bookingSettings.requireConfirmation"
            control={control}
            render={({ field }) => (
              <CheckboxField
                checked={!!field.value}
                onChange={field.onChange}
                label="Require confirmation"
              />
            )}
          />

          <Controller
            name="bookingSettings.allowCancellation"
            control={control}
            render={({ field }) => (
              <CheckboxField
                checked={!!field.value}
                onChange={field.onChange}
                label="Allow cancellation"
              />
            )}
          />

          <Controller
            name="bookingSettings.requireContactInfo"
            control={control}
            render={({ field }) => (
              <CheckboxField
                checked={!!field.value}
                onChange={field.onChange}
                label="Require contact information"
              />
            )}
          />
        </div>

        <TextField
          label="Cancellation hours (hours before appointment)"
          type="number"
          {...register('bookingSettings.cancellationHours', { valueAsNumber: true })}
          error={errors.bookingSettings?.cancellationHours?.message}
          min={0}
        />

        <TextField
          label="Max bookings per slot"
          type="number"
          {...register('bookingSettings.maxBookingsPerSlot', { valueAsNumber: true })}
          error={errors.bookingSettings?.maxBookingsPerSlot?.message}
          min={1}
        />
      </div>

      {error && (
        <div ref={errorRef}>
          <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
            {error}
          </Alert>
        </div>
      )}

      <div className="flex flex-col justify-end gap-3 pt-2 sm:flex-row">
        <AppButton type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
          Cancel
        </AppButton>
        <AppButton type="submit" disabled={isLoading} isLoading={isLoading} className="w-full sm:w-auto">
          {isLoading ? 'Saving...' : service ? 'Update service' : 'Create service'}
        </AppButton>
      </div>
    </form>
  )
}

export default ServiceForm
