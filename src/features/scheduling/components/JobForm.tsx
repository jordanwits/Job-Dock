import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { jobSchema, type JobFormData } from '../schemas/jobSchemas'
import { Job, RecurrenceFrequency, JobBreak } from '../types/job'
import { Input, Button, Select, DatePicker, TimePicker } from '@/components/ui'
import { useContactStore } from '@/features/crm/store/contactStore'
import { useServiceStore } from '../store/serviceStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { format, addWeeks, addMonths } from 'date-fns'

interface JobFormProps {
  job?: Job
  onSubmit: (data: JobFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  defaultContactId?: string
  defaultTitle?: string
  defaultNotes?: string
  initialQuoteId?: string
  initialInvoiceId?: string
}

const JobForm = ({ job, onSubmit, onCancel, isLoading, defaultContactId, defaultTitle, defaultNotes, initialQuoteId, initialInvoiceId }: JobFormProps) => {
  const { contacts, fetchContacts } = useContactStore()
  const { services, fetchServices } = useServiceStore()
  const { quotes, fetchQuotes } = useQuoteStore()
  const { invoices, fetchInvoices } = useInvoiceStore()
  const [startDate, setStartDate] = useState(job ? format(new Date(job.startTime), 'yyyy-MM-dd') : '')
  const [startTime, setStartTime] = useState(job ? format(new Date(job.startTime), 'HH:mm') : '09:00')
  const [repeatPattern, setRepeatPattern] = useState<string>('none')
  const [occurrenceCount, setOccurrenceCount] = useState<number>(12)
  
  // Duration unit and value state
  const inferDurationUnit = (startTime: string, endTime: string): { unit: 'minutes' | 'hours' | 'days' | 'weeks', value: number } => {
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()
    const durationMinutes = Math.round(durationMs / 60000)
    const durationHours = durationMinutes / 60
    const durationDays = durationMinutes / (24 * 60)
    
    if (durationMinutes < 60) {
      return { unit: 'minutes', value: durationMinutes }
    } else if (durationHours < 24) {
      return { unit: 'hours', value: Math.round(durationHours) }
    } else if (durationDays < 14) {
      return { unit: 'days', value: Math.ceil(durationDays) }
    } else {
      return { unit: 'weeks', value: Math.ceil(durationDays / 7) }
    }
  }
  
  const initialDuration = job ? inferDurationUnit(job.startTime, job.endTime) : { unit: 'minutes' as const, value: 60 }
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days' | 'weeks'>(initialDuration.unit)
  const [durationValue, setDurationValue] = useState<number>(initialDuration.value)
  
  // Handle duration unit changes and convert values intelligently
  const handleDurationUnitChange = (newUnit: 'minutes' | 'hours' | 'days' | 'weeks') => {
    const oldUnit = durationUnit
    setDurationUnit(newUnit)
    
    // Convert or reset duration value based on unit change
    if (oldUnit === 'minutes' && newUnit === 'hours') {
      // Convert minutes to hours (e.g., 60 min -> 1 hour)
      setDurationValue(Math.max(1, Math.round(durationValue / 60)))
    } else if (oldUnit === 'hours' && newUnit === 'minutes') {
      // Convert hours to minutes (e.g., 2 hours -> 120 min)
      setDurationValue(durationValue * 60)
    } else if ((oldUnit === 'minutes' || oldUnit === 'hours') && (newUnit === 'days' || newUnit === 'weeks')) {
      // Reset to 1 when switching to days/weeks
      setDurationValue(1)
    } else if ((oldUnit === 'days' || oldUnit === 'weeks') && (newUnit === 'minutes' || newUnit === 'hours')) {
      // Set sensible defaults when switching from days/weeks to time-based
      setDurationValue(newUnit === 'hours' ? 1 : 60)
    } else if (oldUnit === 'days' && newUnit === 'weeks') {
      // Convert days to weeks (e.g., 7 days -> 1 week)
      setDurationValue(Math.max(1, Math.round(durationValue / 7)))
    } else if (oldUnit === 'weeks' && newUnit === 'days') {
      // Convert weeks to days (e.g., 2 weeks -> 14 days)
      setDurationValue(durationValue * 7)
    }
  }
  
  // Job breaks state
  const [breaks, setBreaks] = useState<JobBreak[]>(job?.breaks || [])
  const [showBreaks, setShowBreaks] = useState(false)
  
  // Job source selection state
  const [selectedSource, setSelectedSource] = useState<{
    type: 'none' | 'quote' | 'invoice'
    id?: string
  }>({
    type: initialQuoteId ? 'quote' : initialInvoiceId ? 'invoice' : job?.quoteId ? 'quote' : job?.invoiceId ? 'invoice' : 'none',
    id: initialQuoteId || initialInvoiceId || job?.quoteId || job?.invoiceId
  })
  
  // Custom title entry state
  const [isCustomTitle, setIsCustomTitle] = useState(false)

  useEffect(() => {
    fetchContacts()
    fetchServices()
    // Lazily fetch quotes and invoices if not already loaded
    if (quotes.length === 0) {
      fetchQuotes()
    }
    if (invoices.length === 0) {
      fetchInvoices()
    }
  }, [fetchContacts, fetchServices, fetchQuotes, fetchInvoices, quotes.length, invoices.length])

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    control,
    watch,
    setValue,
  } = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      title: job?.title || defaultTitle || '',
      description: job?.description || '',
      contactId: job?.contactId || defaultContactId || '',
      serviceId: job?.serviceId || '',
      quoteId: job?.quoteId || initialQuoteId || '',
      invoiceId: job?.invoiceId || initialInvoiceId || '',
      startTime: job?.startTime || '',
      endTime: job?.endTime || '',
      status: job?.status || 'scheduled',
      location: job?.location || '',
      notes: job?.notes || defaultNotes || '',
      assignedTo: job?.assignedTo || '',
    },
  })

  const selectedServiceId = watch('serviceId')

  // Auto-populate fields when job source is selected
  useEffect(() => {
    if (selectedSource.type === 'quote' && selectedSource.id) {
      const quote = quotes.find((q) => q.id === selectedSource.id)
      if (quote) {
        setValue('contactId', quote.contactId)
        setValue('quoteId', quote.id)
        setValue('invoiceId', '')
        
        // Prepend note about source if notes are empty
        const currentNotes = watch('notes')
        if (!currentNotes || currentNotes === defaultNotes) {
          setValue('notes', `Created from quote ${quote.quoteNumber}`)
        }
      }
    } else if (selectedSource.type === 'invoice' && selectedSource.id) {
      const invoice = invoices.find((i) => i.id === selectedSource.id)
      if (invoice) {
        setValue('contactId', invoice.contactId)
        setValue('invoiceId', invoice.id)
        setValue('quoteId', '')
        
        // Prepend note about source if notes are empty
        const currentNotes = watch('notes')
        if (!currentNotes || currentNotes === defaultNotes) {
          setValue('notes', `Created from invoice ${invoice.invoiceNumber}`)
        }
      }
    } else if (selectedSource.type === 'none') {
      setValue('quoteId', '')
      setValue('invoiceId', '')
      // Reset to defaults if switching back to custom job
      if (!job && !isCustomTitle) {
        setValue('contactId', defaultContactId || '')
        setValue('notes', defaultNotes || '')
      }
    }
  }, [selectedSource, quotes, invoices, setValue, watch, defaultContactId, defaultTitle, defaultNotes, job, isCustomTitle])

  useEffect(() => {
    if (selectedServiceId) {
      const service = services.find((s) => s.id === selectedServiceId)
      if (service) {
        setDurationUnit('minutes')
        setDurationValue(service.duration)
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
      const inferred = inferDurationUnit(job.startTime, job.endTime)
      setDurationUnit(inferred.unit)
      setDurationValue(inferred.value)
    }
  }, [job, reset])

  const handleFormSubmit = async (data: JobFormData) => {
    // Validate date is selected
    if (!startDate) {
      return
    }
    
    // Compute start and end times based on duration unit
    let startDateTime: Date
    let endDateTime: Date
    
    // Use provided time or default to 9:00 AM if not specified
    const effectiveStartTime = startTime || '09:00'
    
    if (durationUnit === 'minutes') {
      // Use specific time for minute-based jobs
      startDateTime = new Date(`${startDate}T${effectiveStartTime}`)
      endDateTime = new Date(startDateTime.getTime() + durationValue * 60000)
    } else if (durationUnit === 'hours') {
      // Use specific time for hour-based jobs
      startDateTime = new Date(`${startDate}T${effectiveStartTime}`)
      endDateTime = new Date(startDateTime.getTime() + durationValue * 60 * 60000)
    } else {
      // For day/week jobs, use a fixed time (9 AM) and compute end date
      startDateTime = new Date(`${startDate}T09:00:00`)
      const totalDays = durationUnit === 'days' ? durationValue : durationValue * 7
      endDateTime = new Date(startDateTime.getTime() + totalDays * 24 * 60 * 60 * 1000)
    }

    const formData: any = {
      ...data,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      breaks: breaks.length > 0 ? breaks : undefined,
      // Convert empty strings to undefined for foreign keys
      quoteId: data.quoteId || undefined,
      invoiceId: data.invoiceId || undefined,
      serviceId: data.serviceId || undefined,
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

  // Prepare job title options
  const approvedQuotes = quotes.filter(q => q.status === 'draft' || q.status === 'sent' || q.status === 'accepted')
  const approvedInvoices = invoices.filter(i => i.status === 'draft' || i.status === 'sent' || i.approvalStatus === 'accepted')
  
  const jobTitleOptions = [
    ...approvedQuotes.map(q => {
      const title = q.title || `Job for quote ${q.quoteNumber}`
      const parts = [title, q.quoteNumber, q.contactName].filter(Boolean)
      return {
        value: `quote:${q.id}`,
        label: parts.join(', '),
        title: title
      }
    }),
    ...approvedInvoices.map(i => {
      const title = i.title || `Job for invoice ${i.invoiceNumber}`
      const parts = [title, i.invoiceNumber, i.contactName].filter(Boolean)
      return {
        value: `invoice:${i.id}`,
        label: parts.join(', '),
        title: title
      }
    }),
    { value: 'custom', label: 'Other (custom job title)', title: '' }
  ]
  
  const handleTitleChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomTitle(true)
      setSelectedSource({ type: 'none' })
      setValue('title', defaultTitle || '')
    } else if (value.startsWith('quote:')) {
      const id = value.replace('quote:', '')
      setIsCustomTitle(false)
      setSelectedSource({ type: 'quote', id })
      const quote = quotes.find((q) => q.id === id)
      if (quote) {
        const title = quote.title || `Job for quote ${quote.quoteNumber}`
        setValue('title', title)
      }
    } else if (value.startsWith('invoice:')) {
      const id = value.replace('invoice:', '')
      setIsCustomTitle(false)
      setSelectedSource({ type: 'invoice', id })
      const invoice = invoices.find((i) => i.id === id)
      if (invoice) {
        const title = invoice.title || `Job for invoice ${invoice.invoiceNumber}`
        setValue('title', title)
      }
    }
  }
  
  const titleValue = isCustomTitle 
    ? 'custom' 
    : selectedSource.type === 'quote' 
    ? `quote:${selectedSource.id}` 
    : selectedSource.type === 'invoice'
    ? `invoice:${selectedSource.id}`
    : 'custom'

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Job Title Selector */}
      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">
          Job Title *
        </label>
        {!isCustomTitle ? (
          <Select
            value={titleValue}
            onChange={(e) => handleTitleChange(e.target.value)}
            options={jobTitleOptions.map(opt => ({
              value: opt.value,
              label: opt.label
            }))}
          />
        ) : (
          <div className="space-y-2">
            <Input
              {...register('title')}
              error={errors.title?.message}
              placeholder="e.g., Kitchen Renovation Consultation"
            />
            <button
              type="button"
              onClick={() => {
                setIsCustomTitle(false)
                if (jobTitleOptions.length > 0) {
                  handleTitleChange(jobTitleOptions[0].value)
                }
              }}
              className="text-xs text-primary-gold hover:text-primary-gold/80"
            >
              ← Select from quote/invoice
            </button>
          </div>
        )}
        <p className="text-xs text-primary-light/50 mt-1">
          Select from approved quotes/invoices or choose "Other" for custom entry
        </p>
      </div>

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

      {/* Duration Unit Selector */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-primary-light mb-2">
            Duration Unit *
          </label>
          <Select
            value={durationUnit}
            onChange={(e) => handleDurationUnitChange(e.target.value as 'minutes' | 'hours' | 'days' | 'weeks')}
            options={[
              { value: 'minutes', label: 'Minutes' },
              { value: 'hours', label: 'Hours' },
              { value: 'days', label: 'Days' },
              { value: 'weeks', label: 'Weeks' },
            ]}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary-light mb-2">
            Duration *
          </label>
          <input
            type="number"
            value={durationValue}
            onChange={(e) => setDurationValue(Number(e.target.value))}
            min={1}
            step={1}
            className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
          />
        </div>
      </div>

      {/* Date and Time Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label={(durationUnit === 'minutes' || durationUnit === 'hours') ? 'Date *' : 'Start Date *'}
          value={startDate}
          onChange={setStartDate}
          minDate={new Date().toISOString().split('T')[0]}
        />

        {(durationUnit === 'minutes' || durationUnit === 'hours') && (
          <TimePicker
            label="Start Time"
            value={startTime}
            onChange={setStartTime}
            placeholder="9:00 AM (default)"
          />
        )}
      </div>

      {/* End time/date preview */}
      {startDate && (
        <div className="text-xs text-primary-light/50">
          {durationUnit === 'minutes' && startTime && (
            <p>End time: {format(new Date(`${startDate}T${startTime}`).getTime() + durationValue * 60000, 'h:mm a')}</p>
          )}
          {durationUnit === 'hours' && startTime && (
            <p>End time: {format(new Date(`${startDate}T${startTime}`).getTime() + durationValue * 60 * 60000, 'MMM d, h:mm a')}</p>
          )}
          {(durationUnit === 'days' || durationUnit === 'weeks') && (
            <p>
              End date: {format(
                new Date(`${startDate}T09:00:00`).getTime() + 
                (durationUnit === 'days' ? durationValue : durationValue * 7) * 24 * 60 * 60 * 1000, 
                'MMM d, yyyy'
              )}
              {' '}(All-day job)
            </p>
          )}
        </div>
      )}

      <Input
        label="Location"
        {...register('location')}
        placeholder="e.g., 123 Main St, New York, NY"
      />

      {/* Job Timeline & Breaks */}
      <div className="border-t border-primary-blue pt-4">
        <button
          type="button"
          onClick={() => setShowBreaks(!showBreaks)}
          className="flex items-center gap-2 text-sm font-medium text-primary-light mb-2"
        >
          <span className="text-primary-gold">
            {showBreaks ? '▼' : '▶'}
          </span>
          <span>Job Timeline & Breaks (Optional)</span>
          {breaks.length > 0 && (
            <span className="text-primary-gold">
              ({breaks.length} break{breaks.length !== 1 ? 's' : ''})
            </span>
          )}
        </button>
        
        {showBreaks && (
          <div className="space-y-3 mt-3">
            <p className="text-xs text-primary-light/50">
              Add planned pauses to the job timeline (e.g., rain delays, material delivery waits)
            </p>
            
            {breaks.map((breakItem, index) => (
              <div key={index} className="border border-primary-blue rounded-lg p-3 space-y-3 bg-primary-dark-secondary/50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-primary-light">Break {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newBreaks = breaks.filter((_, i) => i !== index)
                      setBreaks(newBreaks)
                    }}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-primary-light/70 mb-1">
                      Pause From
                    </label>
                    <DatePicker
                      value={breakItem.startTime.substring(0, 10)}
                      onChange={(date) => {
                        const newBreaks = [...breaks]
                        newBreaks[index] = {
                          ...breakItem,
                          startTime: `${date}T00:00:00.000Z`
                        }
                        setBreaks(newBreaks)
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-primary-light/70 mb-1">
                      Resume On
                    </label>
                    <DatePicker
                      value={breakItem.endTime.substring(0, 10)}
                      onChange={(date) => {
                        const newBreaks = [...breaks]
                        newBreaks[index] = {
                          ...breakItem,
                          endTime: `${date}T00:00:00.000Z`
                        }
                        setBreaks(newBreaks)
                      }}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-primary-light/70 mb-1">
                    Reason (Optional)
                  </label>
                  <input
                    type="text"
                    value={breakItem.reason || ''}
                    onChange={(e) => {
                      const newBreaks = [...breaks]
                      newBreaks[index] = { ...breakItem, reason: e.target.value }
                      setBreaks(newBreaks)
                    }}
                    placeholder="e.g., Rain delay, material delivery"
                    className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-xs text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
                  />
                </div>
              </div>
            ))}
            
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const now = new Date()
                setBreaks([
                  ...breaks,
                  {
                    id: `temp-${Date.now()}`,
                    startTime: now.toISOString(),
                    endTime: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
                    reason: '',
                  },
                ])
              }}
              className="w-full text-sm"
            >
              + Add Break
            </Button>
          </div>
        )}
      </div>

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

