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
  defaultAssignedTo?: Array<{
    userId: string
    roleId?: string
    role: string
    price?: number | null
    payType?: 'job' | 'hourly'
    hourlyRate?: number | null
  }>
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
  defaultAssignedTo,
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
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
  // Employees can see job prices only if permission is enabled
  // But they can always see their own assignment pay
  const canSeeJobPrices = isAdminOrOwner || (user?.canSeeJobPrices ?? true)
  const currentUserId = user?.id
  const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([])
  const [jobRoles, setJobRoles] = useState<Array<{ id: string; title: string }>>([])
  const [canShowAssignee, setCanShowAssignee] = useState(false)
  const [assignments, setAssignments] = useState<JobAssignment[]>([])
  const [startDate, setStartDate] = useState(
    job && job.startTime ? format(new Date(job.startTime), 'yyyy-MM-dd') : ''
  )
  const [scheduleDateError, setScheduleDateError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
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

  // Title is always a text field - no dropdown

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
        const [usersData, billingData, rolesData] = await Promise.all([
          apiServices.users.getAll(),
          apiServices.billing.getStatus(),
          apiServices.jobRoles.getAll().catch(() => []), // Gracefully handle if job roles don't exist yet
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
        if (Array.isArray(rolesData)) {
          setJobRoles(rolesData.map((r: { id: string; title: string }) => ({ id: r.id, title: r.title })))
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
      status: job?.status || 'active',
      location: job?.location || defaultLocation || '',
      price: job?.price != null ? job.price.toString() : (defaultPrice != null ? defaultPrice.toString() : ''),
      notes: job?.notes || defaultNotes || '',
      assignedTo: (() => {
        // If editing a job, use job's assignedTo
        if (job?.assignedTo) {
          // Handle both old format (string/string[]) and new format (JobAssignment[])
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
              payType: 'job' as const,
              hourlyRate: null,
            }))
          }
          // Old format: single string
          return [{ userId: job.assignedTo as string, role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }]
        }
        // Use defaultAssignedTo if provided
        return defaultAssignedTo || []
      })(),
    },
  })

  const selectedServiceId = watch('serviceId')
  const selectedContactId = watch('contactId')

  // Reset form when defaults change (e.g., when opening from job log detail)
  useEffect(() => {
    if (!job && (defaultTitle || defaultContactId || defaultPrice != null || defaultServiceId || defaultDescription || defaultLocation || defaultNotes || defaultAssignedTo)) {
      // Set assignments state if defaultAssignedTo is provided
      if (defaultAssignedTo && defaultAssignedTo.length > 0) {
        setAssignments(defaultAssignedTo)
      }
      
      reset({
        title: defaultTitle || '',
        description: defaultDescription || '',
        contactId: defaultContactId || '',
        serviceId: defaultServiceId || '',
        quoteId: initialQuoteId || '',
        invoiceId: initialInvoiceId || '',
        startTime: '',
        endTime: '',
        status: 'active',
        location: defaultLocation || '',
        price: defaultPrice != null ? defaultPrice.toString() : '',
        notes: defaultNotes || '',
        assignedTo: defaultAssignedTo || [],
      })
    }
  }, [defaultTitle, defaultContactId, defaultPrice, defaultServiceId, defaultDescription, defaultLocation, defaultNotes, defaultAssignedTo, initialQuoteId, initialInvoiceId, job, reset])

  // Set price from quote/invoice when initialQuoteId/initialInvoiceId is provided and quote/invoice loads
  // Only set if price is empty or matches defaultPrice (user hasn't manually changed it)
  useEffect(() => {
    if (initialQuoteId && quotes.length > 0 && !job) {
      const quote = quotes.find(q => q.id === initialQuoteId)
      const currentPrice = watch('price')
      if (quote && (currentPrice === '' || currentPrice === defaultPrice?.toString() || currentPrice === '0')) {
        setValue('price', quote.total.toString())
      }
    }
    if (initialInvoiceId && invoices.length > 0 && !job) {
      const invoice = invoices.find(i => i.id === initialInvoiceId)
      const currentPrice = watch('price')
      if (invoice && (currentPrice === '' || currentPrice === defaultPrice?.toString() || currentPrice === '0')) {
        setValue('price', invoice.total.toString())
      }
    }
  }, [initialQuoteId, initialInvoiceId, quotes, invoices, defaultPrice, job, setValue, watch])

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
        setValue('price', quote.total.toString())
      }
    } else if (selectedSource.type === 'invoice' && selectedSource.id) {
      const invoice = invoices.find(i => i.id === selectedSource.id)
      if (invoice) {
        setValue('contactId', invoice.contactId)
        setValue('invoiceId', invoice.id)
        setValue('quoteId', '')
        setValue('price', invoice.total.toString())
      }
    } else if (selectedSource.type === 'none') {
      setValue('quoteId', '')
      setValue('invoiceId', '')
      // Reset to defaults if switching back to custom job
      if (!job) {
        setValue('contactId', defaultContactId || '')
        setValue('notes', defaultNotes || '')
        setValue('price', defaultPrice != null ? defaultPrice.toString() : '')
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
    defaultPrice,
    job,
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
          // Ensure payType and hourlyRate are set for all assignments
          setAssignments((job.assignedTo as JobAssignment[]).map(assignment => ({
            ...assignment,
            payType: assignment.payType || 'job',
            hourlyRate: assignment.hourlyRate ?? null,
            price: assignment.price ?? null,
          })))
        } else {
          setAssignments(
            (job.assignedTo as string[]).map(id => ({
              userId: id,
              role: 'Team Member',
              price: null,
              payType: 'job' as const,
              hourlyRate: null,
            }))
          )
        }
      } else {
        setAssignments([{ userId: job.assignedTo as string, role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }])
      }
    } else if (defaultAssignedTo && defaultAssignedTo.length > 0) {
      // Use defaultAssignedTo if no job is being edited
      setAssignments(defaultAssignedTo)
    } else {
      setAssignments([])
    }
  }, [job, defaultAssignedTo])

  // Match existing roles to job roles when jobRoles are loaded
  useEffect(() => {
    if (jobRoles.length > 0 && assignments.length > 0 && job) {
      const updatedAssignments = assignments.map(assignment => {
        // If roleId is already set and valid, keep it
        if (assignment.roleId && assignment.roleId !== 'custom' && jobRoles.some(r => r.id === assignment.roleId)) {
          return assignment
        }
        
        // If role exists but no roleId or invalid roleId, try to match it to a job role
        if (assignment.role) {
          const matchingRole = jobRoles.find(r => r.title === assignment.role)
          if (matchingRole) {
            // Found a match - set the roleId
            return {
              ...assignment,
              roleId: matchingRole.id,
            }
          } else {
            // No match found - this is a custom role, set roleId to 'custom'
            return {
              ...assignment,
              roleId: 'custom',
            }
          }
        }
        
        // No role set - keep as is
        return assignment
      })
      
      // Only update if something changed to avoid infinite loops
      const hasChanges = updatedAssignments.some((updated, index) => 
        updated.roleId !== assignments[index]?.roleId
      )
      
      if (hasChanges) {
        setAssignments(updatedAssignments)
        setValue('assignedTo', updatedAssignments)
      }
    }
  }, [jobRoles, job?.id, assignments, setValue]) // Include assignments and setValue to avoid stale closures

  useEffect(() => {
    if (job) {
      reset({
        title: job.title,
        description: job.description || '',
        contactId: job.contactId,
        serviceId: job.serviceId || '',
        // API can return null for unscheduled jobs; schema expects string (or empty string).
        startTime: job.startTime ?? '',
        endTime: job.endTime ?? '',
        status: job.status || 'active',
        location: job.location || '',
        price: job.price != null ? job.price.toString() : '',
        notes: job.notes || '',
        assignedTo: (() => {
          if (!job.assignedTo) return []
          if (Array.isArray(job.assignedTo)) {
            if (
              job.assignedTo.length > 0 &&
              typeof job.assignedTo[0] === 'object' &&
              'userId' in job.assignedTo[0]
            ) {
              // Ensure payType and hourlyRate are set for all assignments
              return (job.assignedTo as JobAssignment[]).map(assignment => ({
                ...assignment,
                payType: assignment.payType || 'job',
                hourlyRate: assignment.hourlyRate ?? null,
                price: assignment.price ?? null,
              }))
            }
            return (job.assignedTo as string[]).map(id => ({
              userId: id,
              role: 'Team Member',
              price: null,
              payType: 'job' as const,
              hourlyRate: null,
            }))
          }
          return [{ userId: job.assignedTo as string, role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }]
        })(),
      })
      if (job.startTime && job.endTime) {
        setStartDate(format(new Date(job.startTime), 'yyyy-MM-dd'))
        setStartTime(format(new Date(job.startTime), 'HH:mm'))
        const inferred = inferDurationUnit(job.startTime, job.endTime)
        setDurationUnit(inferred.unit)
        setDurationValue(inferred.value)
        setScheduleDateError(null)
      }
      if (!job.startTime || !job.endTime) {
        // Ensure we don't keep stale date/time state when switching between jobs
        setStartDate('')
        setStartTime('09:00')
        setScheduleDateError(null)
      }
      // If we're scheduling an unscheduled job, automatically uncheck toBeScheduled
      // But if user can't schedule, force toBeScheduled to true
      const shouldBeScheduled =
        !canSchedule || (schedulingUnscheduledJob ? false : job.toBeScheduled || false)
      setToBeScheduled(shouldBeScheduled)
    }
  }, [job, reset, schedulingUnscheduledJob])

  const handleFormSubmit = async (data: JobFormData) => {
    // Clear any previous submit-level error (invalid form, etc.)
    if (submitError) setSubmitError(null)

    // Helper function to safely convert price to number
    const convertPrice = (price: any): number | undefined => {
      if (price === undefined || price === null || price === '') {
        return undefined
      }
      const numPrice = typeof price === 'string' ? parseFloat(price) : price
      return !isNaN(numPrice) ? numPrice : undefined
    }

    // If user doesn't have permission to see job prices, don't send job price
    // But they can still see their own assignment pay
    const shouldIncludeJobPrice = canSeeJobPrices

    const normalizedAssignments =
      Array.isArray(data.assignedTo) && data.assignedTo.length > 0
        ? data.assignedTo
            .filter(a => a?.userId && a.userId.trim() !== '')
            .map(a => {
              // Convert roleId: 'custom' to undefined before submission
              const normalizedA = {
                ...a,
                roleId: a.roleId === 'custom' ? undefined : a.roleId,
              }
              // If roleId is missing but role title matches an existing JobRole, attach roleId.
              // This prevents "legacy/self-only" behavior when someone typed a role name.
              if (!normalizedA.roleId && normalizedA.role && jobRoles.length > 0) {
                const match = jobRoles.find(r => r.title === normalizedA.role)
                if (match) {
                  normalizedA.roleId = match.id
                }
              }
              // Employees can see their own assignment pay, but not others'
              // If user doesn't have permission to see job prices, they can't edit assignment prices
              // But they can still see their own assignment pay (read-only, handled in UI)
              if (!canSeeJobPrices) {
                if (normalizedA.userId === currentUserId) {
                  // Keep their own assignment but don't allow price changes
                  // Preserve existing price from the job if editing, otherwise null
                  const existingAssignment = job?.assignedTo && Array.isArray(job.assignedTo) 
                    ? (job.assignedTo as JobAssignment[]).find(existing => existing.userId === normalizedA.userId)
                    : null
                  return {
                    ...normalizedA,
                    // Preserve existing price/hourlyRate if editing, otherwise keep what's in form (but it's disabled)
                    price: existingAssignment?.price ?? normalizedA.price,
                    hourlyRate: existingAssignment?.hourlyRate ?? normalizedA.hourlyRate,
                  }
                } else {
                  // Remove other people's prices if user doesn't have permission
                  return {
                    ...normalizedA,
                    price: null,
                    hourlyRate: null,
                  }
                }
              }
              return normalizedA
            })
        : null

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
        assignedTo: normalizedAssignments,
        // Convert price string to number, or undefined if empty
        // Don't include job price if user doesn't have permission
        price: shouldIncludeJobPrice ? convertPrice(dataWithoutTimes.price) : undefined,
      }
      await onSubmit(formData)
      return
    }

    // Validate date is selected
    if (!startDate) {
      // This used to be a silent no-op (felt like the button "did nothing")
      setScheduleDateError('Please select a date.')
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
      assignedTo: normalizedAssignments,
      // Convert price string to number, or undefined if empty
      // Don't include job price if user doesn't have permission
      price: shouldIncludeJobPrice ? convertPrice(data.price) : undefined,
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

  const handleInvalidSubmit = (invalid: any) => {
    // React Hook Form will not call handleFormSubmit when invalid; without this it can feel like "nothing happened".
    // Surface the actual failing fields, even if the UI doesn't highlight them (e.g. nested assignedTo.* paths).
    const messages: string[] = []
    const walk = (obj: any, path: string) => {
      if (!obj) return
      if (typeof obj.message === 'string') {
        messages.push(path ? `${path}: ${obj.message}` : obj.message)
      }
      if (typeof obj === 'object') {
        for (const key of Object.keys(obj)) {
          if (key === 'message' || key === 'type' || key === 'ref') continue
          walk(obj[key], path ? `${path}.${key}` : key)
        }
      }
    }
    walk(invalid, '')

    setSubmitError(
      messages.length > 0
        ? `Fix these fields: ${messages.slice(0, 3).join(' | ')}`
        : 'Form is invalid. Please review the fields and try again.'
    )
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

  // Title is always a text field - dropdown removed

  return (
    <form onSubmit={handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="space-y-5 sm:space-y-4">
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

      {/* Job Title - Always a text field */}
      <div>
        <label className="block text-sm font-medium text-primary-light mb-2">Job Title *</label>
        <Input
          {...register('title')}
          error={errors.title?.message}
          placeholder="e.g., Kitchen Renovation Consultation"
        />
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
        <div className="pt-2">
          <label className="block text-sm font-medium text-primary-light mb-2">
            Assign to Team Members (with Roles & Pricing)
          </label>
          <p className="text-xs text-primary-light/50 mb-4">
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
                    const newAssignments = [{ userId: '', role: 'Team Member', price: null, payType: 'job' as const, hourlyRate: null }]
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
                      <div className="flex flex-col sm:flex-row items-start gap-3">
                        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                            {jobRoles.length > 0 ? (
                              <Select
                                value={assignment.roleId || ''}
                                placeholder="Select role"
                                onChange={e => {
                                  const newAssignments = [...assignments]
                                  const selectedRoleId = e.target.value
                                  if (selectedRoleId === '') {
                                    // No role selected - clear roleId and role
                                    newAssignments[index] = { ...assignment, roleId: undefined, role: undefined }
                                  } else if (selectedRoleId === 'custom') {
                                    // Custom role - set roleId to 'custom' to track that custom was selected, set role to empty string
                                    newAssignments[index] = { ...assignment, roleId: 'custom', role: '' }
                                  } else {
                                    // Selected role from list
                                    const selectedRole = jobRoles.find(r => r.id === selectedRoleId)
                                    newAssignments[index] = {
                                      ...assignment,
                                      roleId: selectedRoleId,
                                      role: selectedRole?.title || assignment.role || '',
                                    }
                                  }
                                  setAssignments(newAssignments)
                                  setValue('assignedTo', newAssignments)
                                }}
                                options={[
                                  { value: 'custom', label: 'Custom...' },
                                  ...jobRoles.map(r => ({ value: r.id, label: r.title })),
                                ]}
                              />
                            ) : null}
                            {(jobRoles.length === 0 || assignment.roleId === 'custom') && (
                              <Input
                                type="text"
                                value={assignment.role || ''}
                                onChange={e => {
                                  const newAssignments = [...assignments]
                                  // Keep roleId as 'custom' when typing to prevent input from unmounting
                                  newAssignments[index] = { ...assignment, role: e.target.value, roleId: 'custom' }
                                  setAssignments(newAssignments)
                                  setValue('assignedTo', newAssignments)
                                }}
                                placeholder="e.g., Lead, Assistant"
                                className="text-sm mt-1"
                              />
                            )}
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-primary-light/70 mb-1">
                              Pay Type
                            </label>
                            <Select
                              value={assignment.payType || 'job'}
                              onChange={e => {
                                const newAssignments = [...assignments]
                                const payType = e.target.value as 'job' | 'hourly'
                                newAssignments[index] = {
                                  ...assignment,
                                  payType,
                                  // Clear price/hourlyRate when switching
                                  price: payType === 'job' ? assignment.price : null,
                                  hourlyRate: payType === 'hourly' ? assignment.hourlyRate : null,
                                }
                                setAssignments(newAssignments)
                                setValue('assignedTo', newAssignments)
                              }}
                              options={[
                                { value: 'job', label: 'By Job' },
                                { value: 'hourly', label: 'By Hour' },
                              ]}
                            />
                          </div>
                          {assignment.payType === 'hourly' ? (
                            <div>
                              <label className="block text-xs font-medium text-primary-light/70 mb-1">
                                Hourly Rate
                              </label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-light/70 text-sm">
                                  $
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={assignment.hourlyRate ?? ''}
                                  onChange={e => {
                                    const newAssignments = [...assignments]
                                    const hourlyRateValue =
                                      e.target.value === '' ? null : parseFloat(e.target.value)
                                    newAssignments[index] = {
                                      ...assignment,
                                      hourlyRate: isNaN(hourlyRateValue as number) ? null : hourlyRateValue,
                                    }
                                    setAssignments(newAssignments)
                                    setValue('assignedTo', newAssignments)
                                  }}
                                  placeholder="0.00"
                                  className="pl-7 text-sm"
                                  disabled={!canSeeJobPrices || (user?.role === 'employee' && assignment.userId !== currentUserId)}
                                />
                              </div>
                              {(!canSeeJobPrices || (user?.role === 'employee' && assignment.userId !== currentUserId)) && (
                                <p className="text-xs text-yellow-400 mt-0.5">
                                  {assignment.userId === currentUserId ? 'Read-only: Your pay' : 'Insufficient permissions'}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div>
                            <label className="block text-xs font-medium text-primary-light/70 mb-1">
                              Price
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
                                  disabled={!canSeeJobPrices || (user?.role === 'employee' && assignment.userId !== currentUserId)}
                                />
                              </div>
                              {(!canSeeJobPrices || (user?.role === 'employee' && assignment.userId !== currentUserId)) && (
                                <p className="text-xs text-yellow-400 mt-0.5">
                                  {assignment.userId === currentUserId ? 'Read-only: Your pay' : 'Insufficient permissions'}
                                </p>
                              )}
                            </div>
                          )}
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
                          className="text-red-500 hover:text-red-600 text-sm font-medium mt-3 sm:mt-0 sm:self-start"
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
                      { userId: '', role: undefined, roleId: undefined, price: null, payType: 'job' as const, hourlyRate: null },
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
              onChange={(date) => {
                setStartDate(date)
                if (scheduleDateError) setScheduleDateError(null)
              }}
              disabled={!canSchedule || toBeScheduled}
            />
            {scheduleDateError && (
              <p className="text-red-500 text-xs -mt-2 sm:mt-0 sm:col-span-2">{scheduleDateError}</p>
            )}

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
            disabled={!canSeeJobPrices}
          />
        </div>
        {!canSeeJobPrices ? (
          <p className="text-xs text-primary-light/50 mt-1 text-yellow-400">Insufficient permissions to view or edit prices</p>
        ) : (
          <p className="text-xs text-primary-light/50 mt-1">Optional job price or estimated cost</p>
        )}
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
        {submitError && (
          <div className="w-full sm:flex-1 sm:mr-auto">
            <p className="text-red-500 text-xs">{submitError}</p>
          </div>
        )}
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
