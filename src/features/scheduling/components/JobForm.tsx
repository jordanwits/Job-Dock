import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { jobSchema, type JobFormData } from '../schemas/jobSchemas'
import { Job, RecurrenceFrequency } from '../types/job'
import { Input, Button, Select, DatePicker, TimePicker } from '@/components/ui'
import { useContactStore } from '@/features/crm/store/contactStore'
import { useServiceStore } from '../store/serviceStore'
import { format, addWeeks, addMonths } from 'date-fns'

interface JobFormProps {
  job?: Job
  onSubmit: (data: JobFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

const JobForm = ({ job, onSubmit, onCancel, isLoading }: JobFormProps) => {
  const { contacts, fetchContacts } = useContactStore()
  const { services, fetchServices } = useServiceStore()
  const [startDate, setStartDate] = useState(job ? format(new Date(job.startTime), 'yyyy-MM-dd') : '')
  const [startTime, setStartTime] = useState(job ? format(new Date(job.startTime), 'HH:mm') : '09:00')
  const [duration, setDuration] = useState(job ? Math.round((new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) / 60000) : 60)
  const [repeatPattern, setRepeatPattern] = useState<string>('none')
  const [occurrenceCount, setOccurrenceCount] = useState<number>(12)

  useEffect(() => {
    fetchContacts()
    fetchServices()
  }, [fetchContacts, fetchServices])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: job?.title || '',
      description: job?.description || '',
      contactId: job?.contactId || '',
      serviceId: job?.serviceId || '',
      startTime: job?.startTime || '',
      endTime: job?.endTime || '',
      status: job?.status || 'scheduled',
      location: job?.location || '',
      notes: job?.notes || '',
      assignedTo: job?.assignedTo || '',
    },
  })

  const selectedServiceId = watch('serviceId')

  useEffect(() => {
    if (selectedServiceId) {
      const service = services.find((s) => s.id === selectedServiceId)
      if (service) {
        setDuration(service.duration)
      }
    }
  }, [selectedServiceId, services])

  useEffect(() => {
    if (job) {
      reset({
        title: job.title,
        description: job.description || '',
        contactId: job.contactId,
        serviceId: job.serviceId || '',
        startTime: job.startTime,
        endTime: job.endTime,
        status: job.status,
        location: job.location || '',
        notes: job.notes || '',
        assignedTo: job.assignedTo || '',
      })
      setStartDate(format(new Date(job.startTime), 'yyyy-MM-dd'))
      setStartTime(format(new Date(job.startTime), 'HH:mm'))
      setDuration(Math.round((new Date(job.endTime).getTime() - new Date(job.startTime).getTime()) / 60000))
    }
  }, [job, reset])

  const handleFormSubmit = async (data: JobFormData) => {
    // Validate date and time are selected
    if (!startDate || !startTime) {
      // You could set form errors here if needed
      return
    }
    
    // Combine date and time
    const startDateTime = new Date(`${startDate}T${startTime}`)
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000)

    const formData: any = {
      ...data,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
    }

    // Add recurrence if selected
    if (repeatPattern !== 'none') {
      const [frequency, intervalStr] = repeatPattern.split('-') as [RecurrenceFrequency, string]
      const interval = parseInt(intervalStr) || 1
      
      formData.recurrence = {
        frequency,
        interval,
        count: occurrenceCount,
      }
    }

    await onSubmit(formData)
  }
  
  // Calculate end date for recurrence preview
  const getRecurrenceEndDate = () => {
    if (!startDate || !startTime || repeatPattern === 'none') return null
    
    const start = new Date(`${startDate}T${startTime}`)
    const [frequency, intervalStr] = repeatPattern.split('-')
    const interval = parseInt(intervalStr) || 1
    
    let endDate = new Date(start)
    const count = occurrenceCount - 1 // -1 because first occurrence is the start date
    
    if (frequency === 'weekly') {
      endDate = addWeeks(start, interval * count)
    } else if (frequency === 'monthly') {
      endDate = addMonths(start, interval * count)
    }
    
    return format(endDate, 'MMM d, yyyy')
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <Input
        label="Job Title *"
        {...register('title')}
        error={errors.title?.message}
        placeholder="e.g., Kitchen Renovation Consultation"
      />

      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">
          Description
        </label>
        <textarea
          {...register('description')}
          rows={3}
          className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
          placeholder="Add job description..."
        />
      </div>

      <Controller
        name="contactId"
        control={control}
        render={({ field }) => (
          <Select
            label="Contact *"
            value={field.value}
            onChange={field.onChange}
            error={errors.contactId?.message}
            options={[
              { value: '', label: 'Select a contact' },
              ...contacts.map((contact) => ({
                value: contact.id,
                label: `${contact.firstName} ${contact.lastName}${contact.company ? ` - ${contact.company}` : ''}`,
              })),
            ]}
          />
        )}
      />

      <Controller
        name="serviceId"
        control={control}
        render={({ field }) => (
          <Select
            label="Service (Optional)"
            value={field.value || ''}
            onChange={field.onChange}
            options={[
              { value: '', label: 'No service' },
              ...services.filter((s) => s.isActive).map((service) => ({
                value: service.id,
                label: `${service.name} (${service.duration} min)`,
              })),
            ]}
          />
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label="Date *"
          value={startDate}
          onChange={setStartDate}
          minDate={new Date().toISOString().split('T')[0]}
        />

        <TimePicker
          label="Start Time *"
          value={startTime}
          onChange={setStartTime}
          placeholder="Select start time"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">
          Duration (minutes) *
        </label>
        <input
          type="number"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          min={15}
          step={15}
          className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
        />
        <p className="text-xs text-primary-light/50 mt-1">
          End time: {startDate && startTime ? format(new Date(`${startDate}T${startTime}`).getTime() + duration * 60000, 'h:mm a') : 'N/A'}
        </p>
      </div>

      <Input
        label="Location"
        {...register('location')}
        placeholder="e.g., 123 Main St, New York, NY"
      />

      {/* Recurrence Section */}
      <div className="border-t border-primary-blue pt-4">
        <label className="block text-sm font-medium text-primary-light mb-2">
          Repeat Schedule
        </label>
        <Select
          value={repeatPattern}
          onChange={(e) => setRepeatPattern(e.target.value)}
          options={[
            { value: 'none', label: 'Does not repeat' },
            { value: 'weekly-1', label: 'Every week' },
            { value: 'weekly-2', label: 'Every 2 weeks' },
            { value: 'weekly-4', label: 'Every 4 weeks' },
            { value: 'monthly-1', label: 'Every month' },
          ]}
        />
        
        {repeatPattern !== 'none' && (
          <div className="mt-3 space-y-3">
            <Select
              label="Number of occurrences"
              value={occurrenceCount.toString()}
              onChange={(e) => setOccurrenceCount(Number(e.target.value))}
              options={[
                { value: '2', label: '2 times' },
                { value: '3', label: '3 times' },
                { value: '4', label: '4 times' },
                { value: '6', label: '6 times' },
                { value: '8', label: '8 times' },
                { value: '12', label: '12 times' },
                { value: '24', label: '24 times' },
                { value: '50', label: '50 times' },
              ]}
            />
            
            {getRecurrenceEndDate() && (
              <div className="p-3 rounded-lg bg-primary-blue/10 border border-primary-blue">
                <p className="text-xs text-primary-light/70">
                  Will create {occurrenceCount} jobs through {getRecurrenceEndDate()}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <Controller
        name="status"
        control={control}
        render={({ field }) => (
          <Select
            label="Status"
            value={field.value || 'scheduled'}
            onChange={field.onChange}
            options={[
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'pending-confirmation', label: 'Pending Confirmation' },
              { value: 'in-progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        )}
      />

      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">
          Notes
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
          placeholder="Add notes..."
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isLoading} className="w-full sm:w-auto">
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? 'Saving...' : job ? 'Update Job' : 'Create Job'}
        </Button>
      </div>
    </form>
  )
}

export default JobForm

