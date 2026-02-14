import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { jobSchema, type JobFormData } from '../schemas/jobSchemas'
import { Job, RecurrenceFrequency, JobBreak, JobAssignment } from '../types/job'
import { Input, Button, Select, DatePicker, TimePicker } from '@/components/ui'
import { useContactStore } from '@/features/crm/store/contactStore'
import { useServiceStore } from '../store/serviceStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useAuthStore } from '@/features/auth/store/authStore'
import { services as apiServices } from '@/lib/api/services'
import { format, addWeeks, addMonths } from 'date-fns'

interface JobFormProps {
  job?: Job
  onSubmit: (data: JobFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  defaultContactId?: string
  defaultTitle?: string
  defaultNotes?: string
  defaultLocation?: string
  defaultServiceId?: string
  defaultDescription?: string
  defaultPrice?: number
  initialQuoteId?: string
  initialInvoiceId?: string
  error?: string | null
  schedulingUnscheduledJob?: boolean
}

interface TeamMemberOption {
  id: string
  name: string
}

const JobForm = ({
  job,
  onSubmit,
  onCancel,
  isLoading,
  defaultContactId,
  defaultTitle,
  defaultNotes,
  defaultLocation,
  defaultServiceId,
  defaultDescription,
  defaultPrice,
  initialQuoteId,
  initialInvoiceId,
  error,
  schedulingUnscheduledJob,
}: JobFormProps) => {
  const { contacts, fetchContacts } = useContactStore()
  const { services, fetchServices } = useServiceStore()
  const { quotes, fetchQuotes } = useQuoteStore()
  const { invoices, fetchInvoices } = useInvoiceStore()
  const { user } = useAuthStore()
  const canSchedule = user?.canScheduleAppointments !== false
  const canCreateJobs = user?.canCreateJobs !== false
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [canShowAssignee, setCanShowAssignee] = useState(false)
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [startDate, setStartDate] = useState(
    job && job.startTime ? format(new Date(job.startTime), 'yyyy-MM-dd') : ''
  )
  const [startTime, setStartTime] = useState(
    job && job.startTime ? format(new Date(job.startTime), 'HH:mm') : '09:00'
  )
  const [isAllDay, setIsAllDay] = useState(false)
  const [toBeScheduled, setToBeScheduled] = useState(() => {
    // If user can't schedule, always default to toBeScheduled = true
    if (!canSchedule) return true
    return job?.toBeScheduled || false
  })
  const [repeatPattern, setRepeatPattern] = useState<string>('none')
  const [endRepeatMode, setEndRepeatMode] = useState<'never' | 'on-date'>('never')
  const [endRepeatDate, setEndRepeatDate] = useState<string>('')
  const [occurrenceCount, setOccurrenceCount] = useState<number>(12)
  const [customDays, setCustomDays] = useState<number[]>([])

  // Duration unit and value state
  const inferDurationUnit = (
    startTime: string,
    endTime: string
  ): { unit: 'minutes' | 'hours' | 'days' | 'weeks'; value: number } => {
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

  const initialDuration =
    job && job.startTime && job.endTime
      ? inferDurationUnit(job.startTime, job.endTime)
      : { unit: 'minutes' as const, value: 60 }
  const [durationUnit, setDurationUnit] = useState<'minutes' | 'hours' | 'days' | 'weeks'>(
    initialDuration.unit
  )
  const [durationValue, setDurationValue] = useState<number>(initialDuration.value)

  // Handle duration unit changes - keeps the entered value
  const handleDurationUnitChange = (newUnit: 'minutes' | 'hours' | 'days' | 'weeks') => {
    setDurationUnit(newUnit)
  }

  // Job breaks state
  const [breaks, setBreaks] = useState<JobBreak[]>(job?.breaks || [])
  const [showBreaks, setShowBreaks] = useState(false)

  // Job source selection state
  const [selectedSource, setSelectedSource] = useState<{
    type: 'none' | 'quote' | 'invoice'
    id?: string
  }>({
    type: initialQuoteId
      ? 'quote'
      : initialInvoiceId
        ? 'invoice'
        : job?.quoteId
          ? 'quote'
          : job?.invoiceId
            ? 'invoice'
            : 'none',
    id: initialQuoteId || initialInvoiceId || job?.quoteId || job?.invoiceId,
  })

  // Custom title entry state
  const [isCustomTitle, setIsCustomTitle] = useState(false)

  // Location state
  const [locationMode, setLocationMode] = useState<'contact' | 'custom'>('contact')
  const [customLocation, setCustomLocation] = useState('')

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

  useEffect(() => {
    const role = user?.role
    const canAssign = role !== 'employee'
    if (!canAssign) {
      setCanShowAssignee(false)
      return
    }
    const load = async () => {
      try {
        const [usersData, billingData] = await Promise.all([
          apiServices.users.getAll(),
          apiServices.billing.getStatus(),
        ])
        const hasTeamTier =
          !!billingData?.canInviteTeamMembers || billingData?.subscriptionTier === 'team'
        const hasTeamMembers = Array.isArray(usersData) && usersData.length > 0
        setCanShowAssignee(hasTeamTier || hasTeamMembers)
        if (hasTeamTier || hasTeamMembers) {
          setTeamMembers(
            (usersData || []).map((m: { id: string; name: string; email?: string }) => ({
              id: m.id,
              name: m.name || m.email || 'Unknown',
            }))
          )
        }
      } catch {
        setCanShowAssignee(false)
      }
    }
    load()
  }, [user?.role])

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
      description: job?.description || defaultDescription || '',
      contactId: job?.contactId || defaultContactId || '',
      serviceId: job?.serviceId || defaultServiceId || '',
      quoteId: job?.quoteId || initialQuoteId || '',
      invoiceId: job?.invoiceId || initialInvoiceId || '',
      startTime: job?.startTime || '',
      endTime: job?.endTime || '',
      status: job?.status || 'scheduled',
      location: job?.location || defaultLocation || '',
      price: job?.price?.toString() || defaultPrice?.toString() || '',
      notes: job?.notes || defaultNotes || '',
      assignedTo: (() => {
        // Handle both old format (string/string[]) and new format (JobAssignment[])
        if (!job?.assignedTo) return []
        if (Array.isArray(job.assignedTo)) {
          // Check if it's new format (objects with userId)
          if (
            job.assignedTo.length > 0 &&
            typeof job.assignedTo[0] === 'object' &&
            'userId' in job.assignedTo[0]
          ) {
            return job.assignedTo as JobAssignment[]
          }
          // Old format: array of strings
          return (job.assignedTo as string[]).map(id => ({
            userId: id,
            role: 'Team Member',
            price: null,
          }))
        }
        // Old format: single string
        return [{ userId: job.assignedTo as string, role: 'Team Member', price: null }]
      })(),
    },
  })

  const selectedServiceId = watch('serviceId')
  const selectedContactId = watch('contactId')

  // Auto-populate location when contact changes
  useEffect(() => {
    if (locationMode === 'contact' && selectedContactId) {
      const contact = contacts.find(c => c.id === selectedContactId)
      if (contact && contact.address) {
        const fullAddress = [contact.address, contact.city, contact.state, contact.zipCode]
          .filter(Boolean)
          .join(', ')
        setValue('location', fullAddress)
      } else {
        setValue('location', '')
      }
    }
  }, [selectedContactId, locationMode, contacts, setValue])

  // Auto-populate fields when job source is selected
  useEffect(() => {
    if (selectedSource.type === 'quote' && selectedSource.id) {
      const quote = quotes.find(q => q.id === selectedSource.id)
      if (quote) {
        setValue('contactId', quote.contactId)
        setValue('quoteId', quote.id)
        setValue('invoiceId', '')
      }
    } else if (selectedSource.type === 'invoice' && selectedSource.id) {
      const invoice = invoices.find(i => i.id === selectedSource.id)
      if (invoice) {
        setValue('contactId', invoice.contactId)
        setValue('invoiceId', invoice.id)
        setValue('quoteId', '')
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
  }, [
    selectedSource,
    quotes,
    invoices,
    setValue,
    defaultContactId,
    defaultTitle,
    defaultNotes,
    job,
    isCustomTitle,
  ])

  useEffect(() => {
    if (selectedServiceId) {
      const service = services.find(s => s.id === selectedServiceId)
      if (service) {
        setDurationUnit('minutes')
        setDurationValue(service.duration)
      }
    }
  }, [selectedServiceId, services])

  // Initialize assignments from job
  useEffect(() => {
    if (job?.assignedTo) {
      if (Array.isArray(job.assignedTo)) {
        if (
          job.assignedTo.length > 0 &&
          typeof job.assignedTo[0] === 'object' &&
          'userId' in job.assignedTo[0]
        ) {
          setAssignments(job.assignedTo as JobAssignment[])
        } else {
          setAssignments(
            (job.assignedTo as string[]).map(id => ({
              userId: id,
              role: 'Team Member',
              price: null,
            }))
          )
        }
      } else {
        setAssignments([{ userId: job.assignedTo as string, role: 'Team Member', price: null }])
      }
    } else {
      setAssignments([])
    }
  }, [job])

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
        assignedTo: (() => {
          if (!job.assignedTo) return []
          if (Array.isArray(job.assignedTo)) {
            if (
              job.assignedTo.length > 0 &&
              typeof job.assignedTo[0] === 'object' &&
              'userId' in job.assignedTo[0]
            ) {
              return job.assignedTo as JobAssignment[]
            }
            return (job.assignedTo as string[]).map(id => ({
              userId: id,
              role: 'Team Member',
              price: null,
            }))
          }
          return [{ userId: job.assignedTo as string, role: 'Team Member', price: null }]
        })(),
      })
      if (job.startTime && job.endTime) {
        setStartDate(format(new Date(job.startTime), 'yyyy-MM-dd'))
        setStartTime(format(new Date(job.startTime), 'HH:mm'))
        const inferred = inferDurationUnit(job.startTime, job.endTime)
        setDurationUnit(inferred.unit)
        setDurationValue(inferred.value)
      }
      // If we're scheduling an unscheduled job, automatically uncheck toBeScheduled
      // But if user can't schedule, force toBeScheduled to true
      const shouldBeScheduled =
        !canSchedule || (schedulingUnscheduledJob ? false : job.toBeScheduled || false)
      setToBeScheduled(shouldBeScheduled)
    }
  }, [job, reset, schedulingUnscheduledJob])

  const handleFormSubmit = async (data: JobFormData) => {
    // Helper function to safely convert price to number
    const convertPrice = (price: any): number | undefined => {
      if (price === undefined || price === null || price === '') {
        return undefined
      }
      const numPrice = typeof price === 'string' ? parseFloat(price) : price
      return !isNaN(numPrice) ? numPrice : undefined
    }

    // If toBeScheduled, skip date/time validation and send without times
    if (toBeScheduled) {
      const { startTime: _st, endTime: _et, ...dataWithoutTimes } = data
      const formData: any = {
        ...dataWithoutTimes,
        toBeScheduled: true,
        breaks: undefined,
        // Convert empty strings to undefined for foreign keys
        quoteId: dataWithoutTimes.quoteId || undefined,
        invoiceId: dataWithoutTimes.invoiceId || undefined,
        serviceId: dataWithoutTimes.serviceId || undefined,
        assignedTo:
          Array.isArray(dataWithoutTimes.assignedTo) && dataWithoutTimes.assignedTo.length > 0
            ? dataWithoutTimes.assignedTo
            : null,
        // Convert price string to number, or undefined if empty
        price: convertPrice(dataWithoutTimes.price),
      }
      await onSubmit(formData)
      return
    }

    // Validate date is selected
    if (!startDate) {
      return
    }

    // Compute start and end times based on duration unit
    let startDateTime: Date
    let endDateTime: Date

    if (isAllDay) {
      // All-day event: starts at 00:00 and ends at 23:59
      startDateTime = new Date(`${startDate}T00:00:00`)
      const totalDays = durationUnit === 'days' ? durationValue : durationValue * 7
      endDateTime = new Date(startDateTime.getTime() + (totalDays - 1) * 24 * 60 * 60 * 1000)
      // Set to end of last day (23:59:59)
      endDateTime.setHours(23, 59, 59, 999)
    } else {
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
    }

    const formData: any = {
      ...data,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      toBeScheduled: false,
      breaks: breaks.length > 0 ? breaks : undefined,
      // Convert empty strings to undefined for foreign keys
      quoteId: data.quoteId || undefined,
      invoiceId: data.invoiceId || undefined,
      serviceId: data.serviceId || undefined,
      assignedTo:
        Array.isArray(data.assignedTo) && data.assignedTo.length > 0
          ? data.assignedTo.filter(a => a.userId && a.userId.trim() !== '')
          : null,
      // Convert price string to number, or undefined if empty
      price: convertPrice(data.price),
    }

    // Add recurrence if selected
    console.log('🔄 JobForm: Checking recurrence', {
      repeatPattern,
      isNone: repeatPattern === 'none',
      job: job ? 'editing' : 'creating',
      jobId: job?.id,
    })

    if (repeatPattern !== 'none') {
      const [frequency, intervalStr] = repeatPattern.split('-') as [RecurrenceFrequency, string]
      const interval = parseInt(intervalStr) || 1

      console.log('➕ JobForm: Adding recurrence', { frequency, interval, endRepeatMode })

      // Validate custom recurrence has days selected
      if (frequency === 'custom' && customDays.length === 0) {
        alert('Please select at least one day for custom recurrence')
        return
      }

      if (endRepeatMode === 'never') {
        formData.recurrence = {
          frequency,
          interval,
          count: occurrenceCount,
          daysOfWeek: frequency === 'custom' ? customDays : undefined,
        }
        console.log('✅ JobForm: Recurrence added (never ends)', formData.recurrence)
      } else if (endRepeatMode === 'on-date' && endRepeatDate) {
        // Calculate count based on end date
        const start = new Date(`${startDate}T${startTime || '09:00'}`)
        const end = new Date(endRepeatDate)
        let count = 1
        let currentDate = new Date(start)

        if (frequency === 'custom') {
          // For custom, count occurrences on selected days
          currentDate.setDate(currentDate.getDate() + 1) // Start from next day
          while (currentDate <= end) {
            if (customDays.includes(currentDate.getDay())) {
              count++
            }
            currentDate.setDate(currentDate.getDate() + 1)
          }
        } else {
          while (currentDate <= end) {
            if (frequency === 'daily') {
              currentDate.setDate(currentDate.getDate() + interval)
            } else if (frequency === 'weekly') {
              currentDate = addWeeks(currentDate, interval)
            } else if (frequency === 'monthly') {
              currentDate = addMonths(currentDate, interval)
            }
            if (currentDate <= end) count++
          }
        }

        formData.recurrence = {
          frequency,
          interval,
          count: count,
          daysOfWeek: frequency === 'custom' ? customDays : undefined,
        }
        console.log('✅ JobForm: Recurrence added (ends on date)', formData.recurrence)
      }
    } else {
      console.log('⏭️ JobForm: No recurrence selected, skipping')
    }

    console.log('📤 JobForm: Final formData being submitted:', {
      ...formData,
      recurrence: formData.recurrence ? 'yes' : 'no',
      recurrenceDetails: formData.recurrence,
    })
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

    if (frequency === 'custom') {
      // For custom, estimate based on average days per week
      if (customDays.length === 0) return null
      const daysPerWeek = customDays.length
      const weeksNeeded = Math.ceil(count / daysPerWeek)
      endDate.setDate(endDate.getDate() + weeksNeeded * 7)
    } else if (frequency === 'daily') {
      endDate.setDate(endDate.getDate() + interval * count)
    } else if (frequency === 'weekly') {
      endDate = addWeeks(start, interval * count)
    } else if (frequency === 'monthly') {
      endDate = addMonths(start, interval * count)
    }

    return format(endDate, 'MMM d, yyyy')
  }

  // Helper function to extract last name from contact name
  const getLastName = (contactName?: string): string => {
    if (!contactName) return ''
    const parts = contactName.trim().split(/\s+/)
    return parts.length > 0 ? parts[parts.length - 1] : contactName
  }

  // Prepare job title options - include services, quotes, and invoices
  const approvedQuotes = quotes.filter(
    q => q.status === 'draft' || q.status === 'sent' || q.status === 'accepted'
  )
  const approvedInvoices = invoices.filter(
    i => i.status === 'draft' || i.status === 'sent' || i.approvalStatus === 'accepted'
  )
  const activeServices = services.filter(s => s.isActive)

  const jobTitleOptions = [
    // Add services as job title options
    ...activeServices.map(s => ({
      value: `service:${s.id}`,
      label: `${s.name} (Service)`,
      title: s.name,
    })),
    // Add quotes
    ...approvedQuotes.map(q => {
      const title = q.title || `Job for quote ${q.quoteNumber}`
      const lastName = getLastName(q.contactName)
      const label = lastName ? `${lastName}-${title}` : title
      return {
        value: `quote:${q.id}`,
        label: label,
        title: lastName ? `${lastName}-${title}` : title,
      }
    }),
    // Add invoices
    ...approvedInvoices.map(i => {
      const title = i.title || `Job for invoice ${i.invoiceNumber}`
      const lastName = getLastName(i.contactName)
      const label = lastName ? `${lastName}-${title}` : title
      return {
        value: `invoice:${i.id}`,
        label: label,
        title: lastName ? `${lastName}-${title}` : title,
      }
    }),
    { value: 'custom', label: 'Enter Custom Job Title', title: '' },
  ]

  const handleTitleChange = (value: string) => {
    if (value === 'custom') {
      setIsCustomTitle(true)
      setSelectedSource({ type: 'none' })
      setValue('title', defaultTitle || '')
      setValue('serviceId', '') // Clear service when custom
    } else if (value.startsWith('service:')) {
      const id = value.replace('service:', '')
      setIsCustomTitle(false)
      setSelectedSource({ type: 'none' })
      const service = services.find(s => s.id === id)
      if (service) {
        setValue('title', service.name)
        setValue('serviceId', service.id) // Auto-populate service
      }
    } else if (value.startsWith('quote:')) {
      const id = value.replace('quote:', '')
      setIsCustomTitle(false)
      setSelectedSource({ type: 'quote', id })
      const quote = quotes.find(q => q.id === id)
      if (quote) {
        const title = quote.title || `Job for quote ${quote.quoteNumber}`
        const lastName = getLastName(quote.contactName)
        const formattedTitle = lastName ? `${lastName}-${title}` : title
        setValue('title', formattedTitle)
      }
    } else if (value.startsWith('invoice:')) {
      const id = value.replace('invoice:', '')
      setIsCustomTitle(false)
      setSelectedSource({ type: 'invoice', id })
      const invoice = invoices.find(i => i.id === id)
      if (invoice) {
        const title = invoice.title || `Job for invoice ${invoice.invoiceNumber}`
        const lastName = getLastName(invoice.contactName)
        const formattedTitle = lastName ? `${lastName}-${title}` : title
        setValue('title', formattedTitle)
      }
    }
  }

  const titleValue = isCustomTitle
    ? 'custom'
    : selectedServiceId && !selectedSource.id
      ? `service:${selectedServiceId}`
      : selectedSource.type === 'quote'
        ? `quote:${selectedSource.id}`
        : selectedSource.type === 'invoice'
          ? `invoice:${selectedSource.id}`
          : 'custom'

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-500 bg-red-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-red-500 text-xl flex-shrink-0">✗</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-500 mb-1">Failed to create job</p>
              <p className="text-sm text-red-400">{error}</p>
              <p className="text-xs text-red-400/80 mt-2">
                Please check for scheduling conflicts or adjust the job details and try again.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Job Title Selector */}
      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">Job Title *</label>
        {!isCustomTitle ? (
          <Select
            value={titleValue}
            onChange={e => handleTitleChange(e.target.value)}
            options={jobTitleOptions.map(opt => ({
              value: opt.value,
              label: opt.label,
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
          Select a service, quote, invoice, or enter a custom job title
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">Description</label>
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
              ...contacts.map(contact => ({
                value: contact.id,
                label: `${contact.firstName} ${contact.lastName}${contact.company ? ` - ${contact.company}` : ''}`,
              })),
            ]}
          />
        )}
      />

      {canShowAssignee && (
        <div>
          <label className="block text-sm font-medium text-primary-light mb-2">
            Assign to Team Members (with Roles & Pricing)
          </label>
          <p className="text-xs text-primary-light/50 mb-3">
            Assign team members to this job and set their role and individual pricing. Team members
            can only see their own pricing.
          </p>
          <div className="space-y-3">
            {assignments.length === 0 ? (
              <div className="border border-primary-blue/30 rounded-lg p-4 bg-primary-dark-secondary/30 text-center">
                <p className="text-sm text-primary-light/70 mb-3">No team members assigned yet</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const newAssignments = [{ userId: '', role: 'Team Member', price: null }]
                    setAssignments(newAssignments)
                    setValue('assignedTo', newAssignments)
                  }}
                  className="text-sm"
                >
                  + Add Team Member
                </Button>
              </div>
            ) : (
              <>
                {assignments.map((assignment, index) => {
                  const member = teamMembers.find(m => m.id === assignment.userId)
                  return (
                    <div
                      key={index}
                      className="border border-primary-blue rounded-lg p-3 bg-primary-dark-secondary/50 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-primary-light/70 mb-1">
                              Team Member
                            </label>
                            <Select
                              value={assignment.userId}
                              onChange={e => {
                                const newAssignments = [...assignments]
                                newAssignments[index] = { ...assignment, userId: e.target.value }
                                setAssignments(newAssignments)
                                setValue('assignedTo', newAssignments)
                              }}
                              options={[
                                { value: '', label: 'Select member' },
                                ...teamMembers.map(m => ({ value: m.id, label: m.name })),
                              ]}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-primary-light/70 mb-1">
                              Role
                            </label>
                            <Input
                              type="text"
                              value={assignment.role}
                              onChange={e => {
                                const newAssignments = [...assignments]
                                newAssignments[index] = { ...assignment, role: e.target.value }
                                setAssignments(newAssignments)
                                setValue('assignedTo', newAssignments)
                              }}
                              placeholder="e.g., Lead, Assistant"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-primary-light/70 mb-1">
                              Price (Optional)
                            </label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-light/70 text-sm">
                                $
                              </span>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={assignment.price ?? ''}
                                onChange={e => {
                                  const newAssignments = [...assignments]
                                  const priceValue =
                                    e.target.value === '' ? null : parseFloat(e.target.value)
                                  newAssignments[index] = {
                                    ...assignment,
                                    price: isNaN(priceValue as number) ? null : priceValue,
                                  }
                                  setAssignments(newAssignments)
                                  setValue('assignedTo', newAssignments)
                                }}
                                placeholder="0.00"
                                className="pl-7 text-sm"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newAssignments = assignments.filter((_, i) => i !== index)
                            setAssignments(newAssignments)
                            // Allow empty assignments - set to empty array or undefined
                            if (newAssignments.length === 0) {
                              setValue('assignedTo', undefined)
                            } else {
                              setValue('assignedTo', newAssignments)
                            }
                          }}
                          className="text-red-500 hover:text-red-600 text-sm font-medium mt-6"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    const newAssignments = [
                      ...assignments,
                      { userId: '', role: 'Team Member', price: null },
                    ]
                    setAssignments(newAssignments)
                    setValue('assignedTo', newAssignments)
                  }}
                  className="w-full text-sm"
                >
                  + Add Another Team Member
                </Button>
              </>
            )}
          </div>
          {errors.assignedTo && (
            <p className="text-red-500 text-xs mt-1">{errors.assignedTo.message}</p>
          )}
        </div>
      )}

      {/* Service field is now integrated into Job Title dropdown above */}

      {/* To Be Scheduled checkbox - show if user can schedule appointments */}
      {canSchedule && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary-blue/5 border border-primary-blue/30">
          <input
            type="checkbox"
            id="toBeScheduled"
            checked={toBeScheduled}
            onChange={e => {
              setToBeScheduled(e.target.checked)
              if (e.target.checked) {
                // Clear date/time when setting to unscheduled
                setRepeatPattern('none')
              }
            }}
            className="w-4 h-4 rounded border-primary-blue bg-primary-dark-secondary text-primary-gold focus:ring-2 focus:ring-primary-gold focus:ring-offset-0 cursor-pointer"
          />
          <label
            htmlFor="toBeScheduled"
            className="text-sm font-medium text-primary-light cursor-pointer"
          >
            To Be Scheduled
          </label>
          <span className="text-xs text-primary-light/50 ml-auto">(Schedule date/time later)</span>
        </div>
      )}
      {!canSchedule && (
        <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-sm text-amber-400">
            You do not have permission to schedule appointments. This job will be created without
            scheduled times.
          </p>
        </div>
      )}

      {/* Job Time */}
      {!isAllDay && !toBeScheduled && (
        <div>
          <label className="block text-sm font-medium text-primary-light mb-2">Job Time *</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={durationValue}
              onChange={e => setDurationValue(Number(e.target.value))}
              min={0.1}
              step={0.1}
              className="w-24 rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
            />
            <Select
              value={durationUnit}
              onChange={e =>
                handleDurationUnitChange(e.target.value as 'minutes' | 'hours' | 'days' | 'weeks')
              }
              options={[
                { value: 'minutes', label: 'Minutes' },
                { value: 'hours', label: 'Hours' },
                { value: 'days', label: 'Days' },
                { value: 'weeks', label: 'Weeks' },
              ]}
              className="w-32"
            />
          </div>
        </div>
      )}

      {/* Date and Time Selection */}
      {!toBeScheduled && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isAllDay"
              checked={isAllDay}
              onChange={e => {
                setIsAllDay(e.target.checked)
                if (e.target.checked) {
                  setStartTime('00:00')
                  setDurationUnit('days')
                  setDurationValue(1)
                }
              }}
              className="w-4 h-4 rounded border-primary-blue bg-primary-dark-secondary text-primary-gold focus:ring-2 focus:ring-primary-gold focus:ring-offset-0 cursor-pointer"
            />
            <label
              htmlFor="isAllDay"
              className="text-sm font-medium text-primary-light cursor-pointer"
            >
              All Day Event
            </label>
          </div>

          {!canSchedule && (
            <div className="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
              <p className="text-sm text-amber-400">
                You do not have permission to schedule appointments. This job will be created
                without scheduled times.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker
              label={
                isAllDay
                  ? 'Start Date *'
                  : durationUnit === 'minutes' || durationUnit === 'hours'
                    ? 'Date *'
                    : 'Start Date *'
              }
              value={startDate}
              onChange={setStartDate}
              disabled={!canSchedule || toBeScheduled}
            />

            {!isAllDay && (durationUnit === 'minutes' || durationUnit === 'hours') && (
              <TimePicker
                label="Start Time"
                value={startTime}
                onChange={setStartTime}
                placeholder="9:00 AM (default)"
                disabled={!canSchedule || toBeScheduled}
              />
            )}
          </div>

          {/* End time/date preview */}
          {startDate && (
            <div className="text-xs text-primary-light/50">
              {isAllDay ? (
                <p>
                  All-day event: {format(new Date(startDate), 'MMM d, yyyy')}
                  {durationValue > 1 && (
                    <>
                      {' '}
                      through{' '}
                      {format(
                        new Date(
                          new Date(startDate).getTime() + (durationValue - 1) * 24 * 60 * 60 * 1000
                        ),
                        'MMM d, yyyy'
                      )}
                    </>
                  )}
                </p>
              ) : (
                <>
                  {durationUnit === 'minutes' && startTime && (
                    <p>
                      End time:{' '}
                      {format(
                        new Date(`${startDate}T${startTime}`).getTime() + durationValue * 60000,
                        'h:mm a'
                      )}
                    </p>
                  )}
                  {durationUnit === 'hours' && startTime && (
                    <p>
                      End time:{' '}
                      {format(
                        new Date(`${startDate}T${startTime}`).getTime() +
                          durationValue * 60 * 60000,
                        'MMM d, h:mm a'
                      )}
                    </p>
                  )}
                  {(durationUnit === 'days' || durationUnit === 'weeks') && (
                    <p>
                      End date:{' '}
                      {format(
                        new Date(`${startDate}T09:00:00`).getTime() +
                          (durationUnit === 'days' ? durationValue : durationValue * 7) *
                            24 *
                            60 *
                            60 *
                            1000,
                        'MMM d, yyyy'
                      )}{' '}
                      (All-day job)
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">Location</label>
        <Select
          value={locationMode}
          onChange={e => {
            const mode = e.target.value as 'contact' | 'custom'
            setLocationMode(mode)
            if (mode === 'contact') {
              const contactId = watch('contactId')
              const contact = contacts.find(c => c.id === contactId)
              if (contact && contact.address) {
                const fullAddress = [contact.address, contact.city, contact.state, contact.zipCode]
                  .filter(Boolean)
                  .join(', ')
                setValue('location', fullAddress)
              }
            } else {
              setValue('location', customLocation)
            }
          }}
          options={[
            { value: 'contact', label: 'Contact Address' },
            { value: 'custom', label: 'Add Other Address' },
          ]}
        />
        {locationMode === 'custom' && (
          <input
            type="text"
            value={customLocation}
            onChange={e => {
              setCustomLocation(e.target.value)
              setValue('location', e.target.value)
            }}
            placeholder="e.g., 123 Main St, New York, NY"
            className="mt-2 w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
          />
        )}
        {locationMode === 'contact' && watch('contactId') && (
          <p className="mt-2 text-xs text-primary-light/50">
            {(() => {
              const contact = contacts.find(c => c.id === watch('contactId'))
              if (contact && contact.address) {
                return [contact.address, contact.city, contact.state, contact.zipCode]
                  .filter(Boolean)
                  .join(', ')
              }
              return 'No address available for this contact'
            })()}
          </p>
        )}
      </div>

      {/* Price Field */}
      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">Price</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-light/70">$</span>
          <Input
            {...register('price')}
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            className="pl-7"
            error={errors.price?.message}
          />
        </div>
        <p className="text-xs text-primary-light/50 mt-1">Optional job price or estimated cost</p>
      </div>

      {/* Job Timeline & Breaks */}
      <div className="border-t border-primary-blue pt-4">
        <button
          type="button"
          onClick={() => setShowBreaks(!showBreaks)}
          className="flex items-center gap-2 text-sm font-medium text-primary-light mb-2"
        >
          <span className="text-primary-gold">{showBreaks ? '▼' : '▶'}</span>
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
              <div
                key={index}
                className="border border-primary-blue rounded-lg p-3 space-y-3 bg-primary-dark-secondary/50"
              >
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
                      onChange={date => {
                        const newBreaks = [...breaks]
                        newBreaks[index] = {
                          ...breakItem,
                          startTime: `${date}T00:00:00.000Z`,
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
                      onChange={date => {
                        const newBreaks = [...breaks]
                        newBreaks[index] = {
                          ...breakItem,
                          endTime: `${date}T00:00:00.000Z`,
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
                    onChange={e => {
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
      {!toBeScheduled && (
        <div className="border-t border-primary-blue pt-4">
          <label className="block text-sm font-medium text-primary-light mb-2">
            Repeat Schedule
          </label>
          <Select
            value={repeatPattern}
            onChange={e => {
              setRepeatPattern(e.target.value)
            }}
            options={[
              { value: 'none', label: 'Does not repeat' },
              { value: 'daily-1', label: 'Every day' },
              { value: 'daily-2', label: 'Every 2 days' },
              { value: 'weekly-1', label: 'Every week' },
              { value: 'weekly-2', label: 'Every 2 weeks' },
              { value: 'weekly-4', label: 'Every 4 weeks' },
              { value: 'monthly-1', label: 'Every month' },
              { value: 'custom-1', label: 'Custom (select days)' },
            ]}
          />

          {repeatPattern !== 'none' && (
            <div className="mt-3 space-y-3">
              {repeatPattern === 'custom-1' && (
                <div>
                  <label className="block text-sm font-medium text-primary-light mb-2">
                    Select Days
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 0, label: 'Sun' },
                      { value: 1, label: 'Mon' },
                      { value: 2, label: 'Tue' },
                      { value: 3, label: 'Wed' },
                      { value: 4, label: 'Thu' },
                      { value: 5, label: 'Fri' },
                      { value: 6, label: 'Sat' },
                    ].map(day => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => {
                          setCustomDays(prev =>
                            prev.includes(day.value)
                              ? prev.filter(d => d !== day.value)
                              : [...prev, day.value].sort()
                          )
                        }}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          customDays.includes(day.value)
                            ? 'bg-primary-gold text-primary-dark'
                            : 'bg-primary-dark-secondary text-primary-light border border-primary-blue hover:border-primary-gold'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                  {customDays.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">Please select at least one day</p>
                  )}
                </div>
              )}

              <Select
                label="End Repeat"
                value={endRepeatMode}
                onChange={e => {
                  const mode = e.target.value as 'never' | 'on-date'
                  setEndRepeatMode(mode)
                  if (mode === 'on-date' && !endRepeatDate && startDate) {
                    // Set default end date to 3 months from start
                    const defaultEnd = new Date(startDate)
                    defaultEnd.setMonth(defaultEnd.getMonth() + 3)
                    setEndRepeatDate(format(defaultEnd, 'yyyy-MM-dd'))
                  }
                }}
                options={[
                  { value: 'never', label: 'Never' },
                  { value: 'on-date', label: 'On Date' },
                ]}
              />

              {endRepeatMode === 'on-date' && (
                <DatePicker
                  label="End Date"
                  value={endRepeatDate}
                  onChange={setEndRepeatDate}
                  minDate={startDate || new Date().toISOString().split('T')[0]}
                />
              )}

              {endRepeatMode === 'never' && getRecurrenceEndDate() && (
                <div className="p-3 rounded-lg bg-primary-blue/10 border border-primary-blue">
                  <p className="text-xs text-primary-light/70">
                    Will create {occurrenceCount} jobs through {getRecurrenceEndDate()}
                  </p>
                </div>
              )}

              {endRepeatMode === 'on-date' && endRepeatDate && (
                <div className="p-3 rounded-lg bg-primary-blue/10 border border-primary-blue">
                  <p className="text-xs text-primary-light/70">
                    Will repeat until {format(new Date(endRepeatDate), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

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
        <label className="block text-sm font-medium text-primary-light mb-2">Notes</label>
        <textarea
          {...register('notes')}
          rows={3}
          className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
          placeholder="Add notes..."
        />
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
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
