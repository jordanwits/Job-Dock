import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useJobStore } from '../store/jobStore'
import { useServiceStore } from '../store/serviceStore'
import { useAuthStore } from '@/features/auth'
import Calendar from '../components/Calendar'
import JobForm from '../components/JobForm'
import JobDetail from '../components/JobDetail'
import JobList from '../components/JobList'
import ServiceList from '../components/ServiceList'
import ServiceForm from '../components/ServiceForm'
import ServiceDetail from '../components/ServiceDetail'
import ScheduleJobModal from '../components/ScheduleJobModal'
import DeleteRecurringJobModal from '../components/DeleteRecurringJobModal'
import EditRecurringJobModal from '../components/EditRecurringJobModal'
import PermanentDeleteRecurringJobModal from '../components/PermanentDeleteRecurringJobModal'
import ArchivedJobsPage from '../components/ArchivedJobsPage'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  CheckIcon,
  ClockIcon,
  TextField,
  TextAreaField,
  Tabs,
} from '../components/schedulingUi'
import NotifyClientModal from '../components/NotifyClientModal'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addWeeks,
  isSameMonth,
  parseISO,
} from 'date-fns'
import { services as apiServices } from '@/lib/api/services'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import type { Job, UpdateJobData } from '../types/job'

// Label for a staged-monthly virtual chip: "Monthly · Aug" where the month is the calendar
// month the chip is currently showing for (carried on the chip as `stagedTargetMonth`).
const stagedMonthlyLabel = (job: Job): string | null => {
  if (!job.isStagedSeries) return null
  if (!job.stagedTargetMonth) return 'Monthly'
  const month = format(parseISO(`${job.stagedTargetMonth}-01`), 'MMM')
  return `Monthly · ${month}`
}

const SchedulingPage = () => {
  const { user } = useAuthStore()
  const [isTeamAccount, setIsTeamAccount] = useState(false)

  useEffect(() => {
    const checkTeam = async () => {
      try {
        const status = await apiServices.billing.getStatus()
        setIsTeamAccount(status.subscriptionTier === 'team' || status.subscriptionTier === 'team-plus')
      } catch {
        setIsTeamAccount(false)
      }
    }
    checkTeam()
  }, [])
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const returnTo = searchParams.get('returnTo')
  const openCreateJob = searchParams.get('openCreateJob') === '1'
  const jobIdParam = searchParams.get('jobId')
  const linkJobId = searchParams.get('linkJobId') // Job ID to link to when scheduling appointment
  const [createJobDefaults, setCreateJobDefaults] = useState<{
    contactId?: string
    title?: string
    notes?: string
    location?: string
    description?: string
    price?: number
    serviceId?: string
    assignedTo?: Array<{
      userId: string
      roleId?: string
      role: string
      price?: number | null
      payType?: 'job' | 'hourly'
      hourlyRate?: number | null
    }>
  }>({})

  const {
    jobs,
    selectedJob,
    isLoading: jobsLoading,
    error: jobsError,
    viewMode,
    currentDate,
    createJob,
    createIndependentBooking,
    updateJob,
    updateIndependentBooking,
    deleteJob,
    permanentDeleteJob,
    restoreJob,
    confirmJob,
    declineJob,
    setSelectedJob,
    setViewMode,
    setCurrentDate,
    fetchJobs,
    clearError: clearJobsError,
  } = useJobStore()

  // Floating overlay for unscheduled jobs (keeps them accessible on small screens)
  const [toBeScheduledOverlayOpen, setToBeScheduledOverlayOpen] = useState(true)
  const toBeScheduledInlineRef = useRef<HTMLDivElement | null>(null)
  const calendarPaneRef = useRef<HTMLDivElement | null>(null)
  const [inlineToBeScheduledInView, setInlineToBeScheduledInView] = useState(true)
  const [floatingToBeScheduledPos, setFloatingToBeScheduledPos] = useState<{
    top: number
    left: number
    maxWidth: number
  }>({ top: 12, left: 12, maxWidth: 520 })

  const {
    services,
    selectedService,
    isLoading: servicesLoading,
    error: servicesError,
    createService,
    updateService,
    deleteService,
    setSelectedService,
    getBookingLink,
    fetchServices,
    clearError: clearServicesError,
  } = useServiceStore()

  const [showJobForm, setShowJobForm] = useState(false)
  const [editingJob, setEditingJob] = useState<typeof selectedJob>(null)
  const [linkExistingJobId, setLinkExistingJobId] = useState<string | undefined>(undefined)
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [showServiceDetail, setShowServiceDetail] = useState(false)
  const [bookingLink, setBookingLink] = useState<string>('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  // Initialize activeTab from URL query parameter or default to 'calendar'
  const tabParam = searchParams.get('tab')
  const initialTab =
    tabParam === 'services' || tabParam === 'calendar' || tabParam === 'upcoming-bookings'
      ? tabParam
      : 'calendar'
  const [activeTab, setActiveTab] = useState<
    'calendar' | 'upcoming-bookings' | 'services' | 'archived'
  >((initialTab as 'calendar' | 'upcoming-bookings' | 'services' | 'archived') || 'calendar')

  const [linkCopied, setLinkCopied] = useState(false)
  const [buttonLinkCopied, setButtonLinkCopied] = useState(false)
  const [showFollowupModal, setShowFollowupModal] = useState(false)
  const [followupDefaults, setFollowupDefaults] = useState<{
    contactId?: string
    title?: string
    notes?: string
    location?: string
    serviceId?: string
    description?: string
    price?: number
  }>({})
  const [showDeleteRecurringModal, setShowDeleteRecurringModal] = useState(false)
  const [showEditRecurringModal, setShowEditRecurringModal] = useState(false)
  const [editUpdateAll, setEditUpdateAll] = useState(false)
  const [showNotifyClientModal, setShowNotifyClientModal] = useState(false)
  // Guards the notify modal's Yes/No/close handlers against firing twice in the
  // same tick (double-click before the close re-renders) — that double-created
  // the job/booking and double-sent client notifications. Reset on each open.
  const notifyHandledRef = useRef(false)
  const [pendingUpdatePayload, setPendingUpdatePayload] = useState<any>(null)
  const [pendingCreatePayload, setPendingCreatePayload] = useState<any>(null)

  useEffect(() => {
    if (showNotifyClientModal) notifyHandledRef.current = false
  }, [showNotifyClientModal])

  const [showJobConfirmation, setShowJobConfirmation] = useState(false)
  const [jobConfirmationMessage, setJobConfirmationMessage] = useState('')

  // Conflict handling removed - double booking now allowed
  const [showJobError, setShowJobError] = useState(false)
  const [jobErrorMessage, setJobErrorMessage] = useState('')
  const [showServiceConfirmation, setShowServiceConfirmation] = useState(false)
  const [serviceConfirmationMessage, setServiceConfirmationMessage] = useState('')
  const [showArchivedJobs, setShowArchivedJobs] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showStopSeriesConfirm, setShowStopSeriesConfirm] = useState(false)
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false)
  const [showPermanentDeleteRecurringModal, setShowPermanentDeleteRecurringModal] = useState(false)
  const [deletedJobId, setDeletedJobId] = useState<string | null>(null)
  const [deletedRecurrenceId, setDeletedRecurrenceId] = useState<string | null>(null)
  const [showJobDetail, setShowJobDetail] = useState(false)
  const [showNoServicesModal, setShowNoServicesModal] = useState(false)

  // External drag state for "To Be Scheduled" chips
  const [externalDragState, setExternalDragState] = useState<{
    jobId: string | null
    bookingId: string | null
    pointerId: number | null
    isDragging: boolean
    hasMoved: boolean
  }>({
    jobId: null,
    bookingId: null,
    pointerId: null,
    isDragging: false,
    hasMoved: false,
  })
  const externalDragRef = useRef(false) // Track drag state to prevent clicks
  const [externalDragGhost, setExternalDragGhost] = useState<{
    isVisible: boolean
    x: number
    y: number
    width: number
    height: number
    offsetX: number
    offsetY: number
  } | null>(null)

  // Detect if device is using coarse pointer (touch)
  const [isCoarsePointer, setIsCoarsePointer] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
  })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const updatePointerType = () => {
      setIsCoarsePointer(
        window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
      )
    }

    const mediaQuery = window.matchMedia('(pointer: coarse)')
    mediaQuery.addEventListener('change', updatePointerType)
    return () => mediaQuery.removeEventListener('change', updatePointerType)
  }, [])

  // Handle external drag for "To Be Scheduled" chips
  useEffect(() => {
    if (!externalDragState.jobId) return

    let rafId: number | null = null

    const handlePointerMove = (e: PointerEvent) => {
      if (externalDragState.pointerId !== null && e.pointerId !== externalDragState.pointerId)
        return

      // Mark that pointer has moved
      if (!externalDragState.hasMoved) {
        setExternalDragState(prev => ({ ...prev, hasMoved: true }))
      }

      // Activate dragging on any movement
      if (!externalDragState.isDragging) {
        setExternalDragState(prev => {
          // Show ghost when dragging starts
          setExternalDragGhost(prev => (prev ? { ...prev, isVisible: true } : prev))
          return { ...prev, isDragging: true }
        })
      }

      // Update ghost position every frame for smooth movement
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      rafId = requestAnimationFrame(() => {
        setExternalDragGhost(prev => {
          if (!prev) return prev
          return { ...prev, x: e.clientX - prev.offsetX, y: e.clientY - prev.offsetY }
        })
      })
    }

    const handlePointerUpOrCancel = async (e: PointerEvent) => {
      if (externalDragState.pointerId !== null && e.pointerId !== externalDragState.pointerId)
        return

      if (externalDragState.isDragging) {
        // Find drop target under pointer
        const element = document.elementFromPoint(e.clientX, e.clientY)
        const dropZone = element?.closest('[data-drop-date]') as HTMLElement

        if (dropZone && externalDragState.jobId) {
          const dropDateStr = dropZone.getAttribute('data-drop-date')
          const dropHourStr = dropZone.getAttribute('data-drop-hour')

          if (dropDateStr) {
            const dropDate = new Date(dropDateStr)
            const dropHour = dropHourStr ? parseInt(dropHourStr, 10) : undefined

            handleUnscheduledDrop(
              externalDragState.jobId,
              dropDate,
              dropHour,
              externalDragState.bookingId ?? undefined
            )
          }
        }
      }

      // Defer clearing externalDragRef when we were dragging so the subsequent click event
      // still sees we were dragging (click fires after pointerup; if we clear now, onClick opens detail)
      const wasDragging = externalDragState.isDragging || externalDragState.hasMoved
      setExternalDragGhost(null)
      setExternalDragState({
        jobId: null,
        bookingId: null,
        pointerId: null,
        isDragging: false,
        hasMoved: false,
      })
      if (wasDragging) {
        setTimeout(() => {
          externalDragRef.current = false
        }, 0)
      } else {
        externalDragRef.current = false
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUpOrCancel)
    window.addEventListener('pointercancel', handlePointerUpOrCancel)

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUpOrCancel)
      window.removeEventListener('pointercancel', handlePointerUpOrCancel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalDragState])

  // Filter out archived jobs for the calendar view
  const activeJobs = useMemo(() => {
    return jobs.filter(job => !job.archivedAt)
  }, [jobs])

  // Split active jobs into scheduled and unscheduled
  const scheduledJobs = useMemo(() => {
    return activeJobs.filter(job => !job.toBeScheduled && job.startTime && job.endTime)
  }, [activeJobs])

  // Staged-monthly SERIES descriptors (the anchor rows tagged by jobs.getAll). These are NOT
  // displayed directly; they're expanded into one virtual chip per viewed month below.
  const stagedSeriesDescriptors = useMemo(
    () => activeJobs.filter(job => job.isStagedSeries),
    [activeJobs]
  )

  // Virtual per-month chips: for the currently viewed month M, a series shows a chip iff
  // M >= its start month AND that month has no scheduled (non-placeholder) occurrence yet.
  const stagedVirtualChips = useMemo<Job[]>(() => {
    const monthStart = startOfMonth(currentDate)
    const ym = format(monthStart, 'yyyy-MM')
    return stagedSeriesDescriptors
      .filter(desc => {
        if (!desc.recurrenceId) return false
        const seriesStart = desc.seriesStartMonth
          ? startOfMonth(parseISO(`${desc.seriesStartMonth}-01`))
          : startOfMonth(new Date(desc.createdAt))
        if (monthStart.getTime() < seriesStart.getTime()) return false
        // Any real (scheduled) occurrence of this series in month M hides the chip.
        const hasScheduledThisMonth = activeJobs.some(
          j =>
            !j.isStagedSeries &&
            j.recurrenceId === desc.recurrenceId &&
            !j.toBeScheduled &&
            !!j.startTime &&
            isSameMonth(parseISO(j.startTime), monthStart)
        )
        return !hasScheduledThisMonth
      })
      .map(desc => ({
        ...desc,
        id: `staged:${desc.recurrenceId}:${ym}`,
        jobId: desc.jobId ?? desc.id,
        anchorBookingId: desc.anchorBookingId ?? desc.bookingId,
        stagedTargetMonth: ym,
        // A virtual chip has NO month-specific bookingId — this keeps the calendar's
        // update-by-bookingId drop path from ever firing for it.
        bookingId: undefined,
        isStagedSeries: true,
        toBeScheduled: true,
        startTime: null,
        endTime: null,
      }))
  }, [stagedSeriesDescriptors, activeJobs, currentDate])

  const toBeScheduledJobs = useMemo(() => {
    const regular = activeJobs.filter(
      job => (job.toBeScheduled || !job.startTime || !job.endTime) && !job.isStagedSeries
    )
    return [...regular, ...stagedVirtualChips]
  }, [activeJobs, stagedVirtualChips])

  // Don't render the floating overlay while the Job modal is open.
  // (The overlay is fixed and can interfere with modal interactions on small screens.)
  const showFloatingToBeScheduled =
    toBeScheduledJobs.length > 0 && !inlineToBeScheduledInView && !showJobForm

  // Toggle between inline list and floating overlay based on whether the inline list is in view
  useEffect(() => {
    if (activeTab !== 'calendar' || toBeScheduledJobs.length === 0) {
      setInlineToBeScheduledInView(true)
      return
    }

    const el = toBeScheduledInlineRef.current
    if (!el) return

    // Fallback for environments without IntersectionObserver
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      const check = () => {
        const rect = el.getBoundingClientRect()
        const inView = rect.bottom > 0 && rect.top < window.innerHeight
        setInlineToBeScheduledInView(inView)
      }
      check()
      window.addEventListener('scroll', check, true)
      window.addEventListener('resize', check)
      return () => {
        window.removeEventListener('scroll', check, true)
        window.removeEventListener('resize', check)
      }
    }

    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0]
        setInlineToBeScheduledInView(Boolean(entry?.isIntersecting))
      },
      { threshold: 0.01 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [activeTab, toBeScheduledJobs.length])

  // Keep the floating overlay anchored to the top-left of the calendar pane (when active)
  useEffect(() => {
    if (!showFloatingToBeScheduled) return
    if (typeof window === 'undefined') return

    const update = () => {
      const rect = calendarPaneRef.current?.getBoundingClientRect()
      if (!rect) return

      const left = Math.max(12, rect.left + 12)
      const top = Math.max(12, rect.top + 12)
      const maxWidth = Math.max(240, Math.min(520, rect.width - 24))

      setFloatingToBeScheduledPos({ left, top, maxWidth })
    }

    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [showFloatingToBeScheduled, viewMode])

  // Set active tab from URL parameter on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'services' || tabParam === 'calendar' || tabParam === 'upcoming-bookings') {
      setActiveTab(tabParam as 'calendar' | 'upcoming-bookings' | 'services' | 'archived')
    }
  }, [searchParams])

  // Open job detail when arriving with jobId query parameter
  useEffect(() => {
    if (jobIdParam && jobs.length > 0 && !selectedJob) {
      const job = jobs.find(j => j.id === jobIdParam)
      if (job) {
        setSelectedJob(job)
        setShowJobDetail(true)
        // Clear the jobId param from URL
        const params = new URLSearchParams(searchParams)
        params.delete('jobId')
        setSearchParams(params, { replace: true })
      }
    }
  }, [jobIdParam, jobs, selectedJob, searchParams, setSearchParams, setSelectedJob])

  // Open create job modal when arriving with openCreateJob=1 (e.g. from job detail)
  useEffect(() => {
    if (openCreateJob) {
      // Parse assignedTo from JSON if present
      let assignedTo:
        | Array<{
            userId: string
            roleId?: string
            role: string
            price?: number | null
            payType?: 'job' | 'hourly'
            hourlyRate?: number | null
          }>
        | undefined
      const assignedToParam = searchParams.get('assignedTo')
      if (assignedToParam) {
        try {
          assignedTo = JSON.parse(decodeURIComponent(assignedToParam))
        } catch (e) {
          console.error('Failed to parse assignedTo:', e)
        }
      }

      setCreateJobDefaults({
        contactId: searchParams.get('contactId') || undefined,
        title: searchParams.get('title')
          ? decodeURIComponent(searchParams.get('title')!)
          : undefined,
        notes: searchParams.get('notes')
          ? decodeURIComponent(searchParams.get('notes')!)
          : undefined,
        location: searchParams.get('location')
          ? decodeURIComponent(searchParams.get('location')!)
          : undefined,
        description: searchParams.get('description')
          ? decodeURIComponent(searchParams.get('description')!)
          : undefined,
        price: searchParams.get('price') ? parseFloat(searchParams.get('price')!) : undefined,
        serviceId: searchParams.get('serviceId') || undefined,
        assignedTo,
      })
      // Persist linkJobId before URL params are cleared
      setLinkExistingJobId(linkJobId || undefined)
      setActiveTab('calendar')
      setShowJobForm(true)
      // Clear params from URL so refresh doesn't re-open modal (keep returnTo)
      const params = new URLSearchParams(searchParams)
      params.delete('openCreateJob')
      params.delete('contactId')
      params.delete('title')
      params.delete('notes')
      params.delete('location')
      params.delete('description')
      params.delete('price')
      params.delete('serviceId')
      params.delete('assignedTo')
      params.delete('linkJobId')
      setSearchParams(params, { replace: true })
    }
  }, [openCreateJob, searchParams, setSearchParams, linkJobId])

  // Clear deleted job IDs when switching away from archived tab
  useEffect(() => {
    if (activeTab !== 'archived') {
      setDeletedJobId(null)
      setDeletedRecurrenceId(null)
    }
  }, [activeTab])

  useEffect(() => {
    // Fetch jobs for a wider range to support multi-week/multi-month jobs
    // Fetch 2 months back and 4 months forward from current view
    const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
    const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
    fetchJobs(startDate, endDate)
    fetchServices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate])

  // Keyboard shortcut: CMD+N / CTRL+N to create new job or service based on active tab
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
        event.preventDefault()
        // Only trigger if no modals are open and no job/service is selected
        if (!showJobForm && !showServiceForm && !selectedJob && !selectedService) {
          if (activeTab === 'services' && user?.role !== 'employee') {
            setShowServiceForm(true)
          } else if (activeTab !== 'services') {
            // For 'calendar' and 'upcoming-bookings' tabs, create a job
            setShowJobForm(true)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showJobForm, showServiceForm, selectedJob, selectedService, activeTab, user?.role])

  const handleCreateJob = async (data: any) => {
    const isScheduledCreate = data.startTime && data.endTime && !data.toBeScheduled
    if (isScheduledCreate) {
      setPendingCreatePayload(data)
      setShowNotifyClientModal(true)
      return
    }
    try {
      await createJob(data)
      setShowJobForm(false)
      clearJobsError()
      if (returnTo && returnTo.startsWith('/app')) {
        navigate(returnTo)
      } else {
        setJobConfirmationMessage('Job created successfully')
        setShowJobConfirmation(true)
        setTimeout(() => setShowJobConfirmation(false), 3000)
      }
    } catch (error: any) {
      // Error will be displayed in the modal via jobsError
      // Keep the modal open so user can fix the issue
    }
  }

  const performCreateJob = async (payload: any, notifyClient: boolean) => {
    try {
      await createJob({ ...payload, notifyClient })
      setShowJobForm(false)
      setPendingCreatePayload(null)
      setShowNotifyClientModal(false)
      clearJobsError()
      if (returnTo && returnTo.startsWith('/app')) {
        navigate(returnTo)
      } else {
        setJobConfirmationMessage(notifyClient ? 'Sent via email and SMS' : 'Job created and appointment scheduled')
        setShowJobConfirmation(true)
        setTimeout(() => setShowJobConfirmation(false), 3000)
      }
    } catch (error: any) {
      // Error will be displayed in the modal via jobsError
      // Keep the modal open so user can fix the issue
    }
  }

  const performJobUpdate = async (payload: any) => {
    try {
      await updateJob(payload)
      // Force refetch when toggling to To Be Scheduled or when scheduling so UI updates (calendar vs list)
      const needsRefetch = payload.toBeScheduled === true || (payload.startTime && payload.endTime)
      if (needsRefetch) {
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
        await fetchJobs(startDate, endDate)
      }
      setEditingJob(null)
      setEditUpdateAll(false)
      setShowJobForm(false)
      setSelectedJob(null)
      setShowJobDetail(false)
      clearJobsError()
      const message = payload.notifyClient
        ? 'Sent via email and SMS'
        : payload.updateAll
          ? 'All future jobs updated successfully'
          : 'Job updated successfully'
      setJobConfirmationMessage(message)
      setShowJobConfirmation(true)
      setTimeout(() => setShowJobConfirmation(false), 3000)
    } catch (error: any) {
      // Error will be displayed in the modal via jobsError
      // Keep the modal open so user can fix the issue
    }
  }

  const handleUpdateJob = async (data: any) => {
    console.log('📝 SchedulingPage: handleUpdateJob called', {
      editUpdateAll,
      editingJobId: editingJob?.id,
      isIndependent: editingJob?.isIndependent,
      recurrenceId: editingJob?.recurrenceId,
      hasRecurrence: !!data.recurrence,
      recurrenceData: data.recurrence,
    })
    if (editingJob) {
      if (editingJob.isIndependent) {
        try {
          await updateIndependentBooking(editingJob.id, data)
          const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
          const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
          await fetchJobs(startDate, endDate)
          setEditingJob(null)
          setShowJobForm(false)
          setSelectedJob(null)
          setShowJobDetail(false)
          clearJobsError()
          setJobConfirmationMessage('Appointment updated successfully')
          setShowJobConfirmation(true)
          setTimeout(() => setShowJobConfirmation(false), 3000)
        } catch (error: any) {
          // Error displayed via jobsError
        }
        return
      }
      const updatePayload: any = {
        ...data,
        // A virtual staged chip's `id` is synthetic; target the real Job id.
        id: editingJob.jobId ?? editingJob.id,
        updateAll: editUpdateAll,
      }
      if (editingJob.isStagedSeries && editingJob.anchorBookingId) {
        // Editing a staged series targets the ANCHOR booking so a real scheduled occurrence
        // is never accidentally converted back to a placeholder.
        updatePayload.bookingId = editingJob.anchorBookingId
      } else if (editingJob.bookingId) {
        updatePayload.bookingId = editingJob.bookingId
      }
      const timesChanged =
        (data.startTime != null &&
          editingJob.startTime != null &&
          data.startTime !== editingJob.startTime) ||
        (data.endTime != null && editingJob.endTime != null && data.endTime !== editingJob.endTime)
      // Also show notification prompt when scheduling a to-be-scheduled job (adding times)
      const isSchedulingUnscheduled =
        (editingJob.toBeScheduled || !editingJob.startTime) &&
        data.startTime != null &&
        data.endTime != null
      if (timesChanged || isSchedulingUnscheduled) {
        setPendingUpdatePayload(updatePayload)
        setShowNotifyClientModal(true)
      } else {
        await performJobUpdate(updatePayload)
      }
    }
  }

  const handleEditJob = () => {
    if (selectedJob) {
      // Staged monthly series: edit the series directly (no per-occurrence "one vs all" prompt,
      // which would target real occurrences). editUpdateAll stays false.
      if (selectedJob.isStagedSeries) {
        setEditUpdateAll(false)
        setEditingJob(selectedJob)
        setShowJobForm(true)
        setShowJobDetail(false)
      } else if (selectedJob.recurrenceId) {
        // Check if this is a recurring job
        setShowEditRecurringModal(true)
      } else {
        // Non-recurring job - edit directly
        setEditingJob(selectedJob)
        setShowJobForm(true)
        setShowJobDetail(false)
      }
    }
  }

  const handleEditSingleJob = () => {
    setEditUpdateAll(false)
    setEditingJob(selectedJob)
    setShowJobForm(true)
    setShowJobDetail(false)
    setShowEditRecurringModal(false)
  }

  const handleEditAllJobs = () => {
    console.log('🔁 User selected: Edit All Future Jobs')
    setEditUpdateAll(true)
    setEditingJob(selectedJob)
    setShowJobForm(true)
    setShowJobDetail(false)
    setShowEditRecurringModal(false)
  }

  const handleDeleteJob = () => {
    if (selectedJob) {
      // Staged monthly series (a virtual chip): stop the whole series, don't open the generic
      // recurring-delete modal (which targets real occurrences).
      if (selectedJob.isStagedSeries) {
        setShowStopSeriesConfirm(true)
      } else if (selectedJob.recurrenceId) {
        // Real recurring occurrence
        setShowDeleteRecurringModal(true)
      } else {
        // If job has a booking, delete the booking. If no booking, offer to delete the job itself.
        setShowDeleteConfirm(true)
      }
    }
  }

  // Stop a staged monthly series: archives the anchor + recurrence so no future chips appear.
  // Already-scheduled appointments are preserved on the calendar.
  const handleStopSeries = async () => {
    if (!selectedJob) return
    setShowStopSeriesConfirm(false)
    const realJobId = selectedJob.jobId ?? selectedJob.id
    try {
      const { jobsService } = await import('@/lib/api/services')
      const payload: UpdateJobData = { id: realJobId, removeRecurrence: true }
      await jobsService.update(realJobId, payload)
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
      await fetchJobs(startDate, endDate)
      setSelectedJob(null)
      setShowJobDetail(false)
      clearJobsError()
      setJobConfirmationMessage('Monthly series stopped')
      setShowJobConfirmation(true)
      setTimeout(() => setShowJobConfirmation(false), 3000)
    } catch (err: unknown) {
      clearJobsError()
      setJobErrorMessage(getErrorMessage(err, 'Could not stop the monthly series.'))
      setShowJobError(true)
    }
  }

  const handleDeleteSingleJob = async () => {
    if (selectedJob) {
      try {
        if (selectedJob.bookingId) {
          // Job has a booking - delete the booking only (not the job itself)
          const { bookingsService } = await import('@/lib/api/services')
          await bookingsService.delete(selectedJob.bookingId)
          await fetchJobs()
        } else {
          // Job has no booking (rare path) - soft-archive the job itself
          const { jobsService } = await import('@/lib/api/services')
          await jobsService.delete(selectedJob.id)
          await fetchJobs()
        }
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowDeleteRecurringModal(false)
      } catch (error) {
        console.error('Error deleting:', error)
        throw error
      }
    }
  }

  const handleDeleteAllJobs = async () => {
    if (selectedJob) {
      try {
        if (!selectedJob.bookingId) {
          // No booking to delete
          setJobErrorMessage(
            'This job has no booking to delete. To delete jobs, go to the Jobs page.'
          )
          setShowJobError(true)
          setShowDeleteRecurringModal(false)
          return
        }
        console.log('Archiving all recurring bookings with recurrenceId:', selectedJob.recurrenceId)
        await deleteJob(selectedJob.id, true)
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowDeleteRecurringModal(false)
        // Refetch to update the calendar
        await fetchJobs()
      } catch (error) {
        console.error('Error archiving all recurring bookings:', error)
      }
    }
  }

  const handleRequestPermanentDelete = (job?: typeof selectedJob) => {
    const jobToDelete = job || selectedJob
    if (jobToDelete) {
      if (jobToDelete !== selectedJob) {
        setSelectedJob(jobToDelete)
      }
      if (jobToDelete.recurrenceId && (jobToDelete.occurrenceCount ?? 0) > 1) {
        setShowPermanentDeleteRecurringModal(true)
      } else {
        setShowPermanentDeleteConfirm(true)
      }
    }
  }

  const handlePermanentDeleteJob = async (job?: typeof selectedJob) => {
    const jobToDelete = job || selectedJob
    if (jobToDelete) {
      if (jobToDelete.bookingId) {
        // Job has a booking - permanently delete the booking only (not the job itself)
        try {
          console.log('Permanently deleting single booking:', jobToDelete.bookingId)
          const { bookingsService } = await import('@/lib/api/services')
          await bookingsService.permanentDelete(jobToDelete.bookingId)
          await fetchJobs()
          if (jobToDelete === selectedJob) {
            setSelectedJob(null)
            setShowJobDetail(false)
          }
          return
        } catch (error) {
          console.error('Error permanently deleting booking:', error)
          throw error
        }
      } else {
        // Job has no booking - cannot delete from scheduling page
        setJobErrorMessage(
          'This job has no booking to delete. To delete the job itself, go to the Jobs page.'
        )
        setShowJobError(true)
        return
      }
    }
  }

  const handleConfirmPermanentDelete = async () => {
    if (selectedJob) {
      try {
        if (selectedJob.bookingId) {
          // Job has a booking - permanently delete the booking only (not the job itself)
          const { bookingsService } = await import('@/lib/api/services')
          await bookingsService.permanentDelete(selectedJob.bookingId)
          await fetchJobs()
        } else {
          // Job has no booking - cannot delete from scheduling page
          setJobErrorMessage(
            'This job has no booking to delete. To delete the job itself, go to the Jobs page.'
          )
          setShowJobError(true)
          setShowPermanentDeleteConfirm(false)
          return
        }
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowPermanentDeleteConfirm(false)
      } catch (error) {
        console.error('Error permanently deleting:', error)
      }
    }
  }

  const handlePermanentDeleteSingleJob = async () => {
    if (selectedJob) {
      try {
        if (selectedJob.bookingId) {
          // Job has a booking - permanently delete the booking only (not the job itself)
          const { bookingsService } = await import('@/lib/api/services')
          await bookingsService.permanentDelete(selectedJob.bookingId)
          await fetchJobs()
        } else {
          // Job has no booking - cannot delete from scheduling page
          setJobErrorMessage(
            'This job has no booking to delete. To delete the job itself, go to the Jobs page.'
          )
          setShowJobError(true)
          setShowPermanentDeleteRecurringModal(false)
          return
        }
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowPermanentDeleteRecurringModal(false)
      } catch (error) {
        console.error('Error permanently deleting booking:', error)
      }
    }
  }

  const handlePermanentDeleteAllJobs = async () => {
    if (selectedJob) {
      try {
        // Not supported: permanently deleting Jobs from Scheduling.
        // Scheduling can only delete bookings.
        setJobErrorMessage(
          'To permanently delete jobs, use the Jobs page. Scheduling can only delete bookings.'
        )
        setShowJobError(true)
        setShowPermanentDeleteRecurringModal(false)
      } catch (error) {
        console.error('Error permanently deleting all jobs:', error)
      }
    }
  }

  const handleRestoreJob = async (job?: Job) => {
    const jobToRestore = job || selectedJob
    if (jobToRestore) {
      try {
        await restoreJob(jobToRestore.id)
        setSelectedJob(null)
        setShowJobDetail(false)
        // No need to refetch - store already updated the job (cleared archivedAt)
      } catch (error) {
        console.error('Error restoring job:', error)
      }
    }
  }

  const handleCreateService = async (data: any) => {
    try {
      await createService(data)
      setShowServiceForm(false)
      setServiceConfirmationMessage('Service Created Successfully')
      setShowServiceConfirmation(true)
      setTimeout(() => setShowServiceConfirmation(false), 3000)
    } catch (error) {
      // Error handled by store
    }
  }

  const handleUpdateService = async (data: any) => {
    if (selectedService) {
      try {
        await updateService({ ...data, id: selectedService.id })
        setShowServiceForm(false)
        setSelectedService(null)
        setServiceConfirmationMessage('Service Updated Successfully')
        setShowServiceConfirmation(true)
        setTimeout(() => setShowServiceConfirmation(false), 3000)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleDeleteService = async () => {
    if (selectedService) {
      try {
        await deleteService(selectedService.id)
        setShowServiceDetail(false)
        setSelectedService(null)
        setServiceConfirmationMessage('Service Deleted Successfully')
        setShowServiceConfirmation(true)
        setTimeout(() => setShowServiceConfirmation(false), 3000)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleOpenBookingLink = () => {
    // Check if there are any services set up
    if (services.length === 0) {
      setShowNoServicesModal(true)
      return
    }

    // Copy unified tenant booking link to clipboard
    const tenantId = user?.tenantId || localStorage.getItem('tenant_id') || ''
    const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    const unifiedLink = `${baseUrl}/book?tenant=${tenantId}`
    navigator.clipboard.writeText(unifiedLink)
    setButtonLinkCopied(true)
    setTimeout(() => setButtonLinkCopied(false), 2000)
  }

  const handleGetBookingLink = async () => {
    // Show unified tenant booking link instead of individual service link
    // This is used in the service detail modal to show the copy screen
    const tenantId = user?.tenantId || localStorage.getItem('tenant_id') || ''
    const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    const unifiedLink = `${baseUrl}/book?tenant=${tenantId}`
    setBookingLink(unifiedLink)
    setShowLinkModal(true)
  }

  const handleConfirmJob = async () => {
    if (selectedJob) {
      try {
        await confirmJob(selectedJob.id)
        setSelectedJob(null)
        setShowJobDetail(false)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleDeclineJob = async () => {
    if (selectedJob) {
      try {
        await declineJob(selectedJob.id, declineReason)
        setShowDeclineModal(false)
        setDeclineReason('')
        setSelectedJob(null)
        setShowJobDetail(false)
      } catch (error) {
        // Error handled by store
      }
    }
  }

  const handleScheduleFollowup = () => {
    if (selectedJob && selectedJob.startTime) {
      setFollowupDefaults({
        contactId: selectedJob.contactId,
        title: `Follow-up: ${selectedJob.title}`,
        notes: `Follow-up job for original job on ${format(new Date(selectedJob.startTime), 'MMM d, yyyy')}`,
        location: selectedJob.location || undefined,
        serviceId: selectedJob.serviceId || undefined,
        description: selectedJob.description || undefined,
        price: selectedJob.price || undefined,
      })
      setShowFollowupModal(true)
    }
  }

  const handleScheduleJob = () => {
    if (selectedJob) {
      setEditingJob(selectedJob)
      setShowJobDetail(false)
      setShowJobForm(true)
    }
  }

  const canUserEditJob = (job: { assignedTo?: any; createdById?: string | null }) => {
    if (!user) return true
    if (user.role === 'admin' || user.role === 'owner') return true
    if (user.canEditJobs === false) return false
    if (user.canEditAssignedJobsOnly !== false) {
      if (job.createdById === user.id) return true
      try {
        const raw = job.assignedTo
        const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(arr)) return arr.some((a: any) => a.userId === user.id)
      } catch {}
      return false
    }
    return true
  }

  // Schedule ONE occurrence of a staged monthly series into the dropped date/time. Creates a
  // new booking via the dedicated backend path (no rolling, anchor untouched) then refetches.
  const scheduleStagedOccurrence = async (
    chip: Job,
    targetDate: Date,
    targetHour?: number
  ) => {
    if (!canUserEditJob(chip)) {
      setJobErrorMessage('You can only edit jobs you are assigned to')
      setShowJobError(true)
      return
    }
    let durationMinutes = 60
    if (chip.serviceId) {
      const service = services.find(s => s.id === chip.serviceId)
      if (service) durationMinutes = service.duration
    }
    const startTime = new Date(targetDate)
    startTime.setHours(targetHour !== undefined ? targetHour : 9, 0, 0, 0)
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)
    const realJobId = chip.jobId ?? chip.id
    try {
      const { jobsService } = await import('@/lib/api/services')
      const payload: UpdateJobData = {
        id: realJobId,
        scheduleStagedOccurrence: true,
        recurrenceId: chip.recurrenceId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        serviceId: chip.serviceId,
      }
      await jobsService.update(realJobId, payload)
      const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
      await fetchJobs(startDate, endDate)
      clearJobsError()
      setJobConfirmationMessage('Appointment scheduled')
      setShowJobConfirmation(true)
      setTimeout(() => setShowJobConfirmation(false), 3000)
    } catch (err: unknown) {
      clearJobsError()
      setJobErrorMessage(
        getErrorMessage(
          err,
          'Could not schedule this appointment. Ask an admin if you need permission changes.'
        )
      )
      setShowJobError(true)
    }
  }

  const handleUnscheduledDrop = (
    jobId: string,
    targetDate: Date,
    targetHour?: number,
    bookingId?: string
  ) => {
    // Virtual staged chip: schedule a new occurrence for the dropped month/time (never the
    // update-by-bookingId path — the chip has no month-specific booking).
    const stagedChip = jobId.startsWith('staged:')
      ? stagedVirtualChips.find(c => c.id === jobId)
      : undefined
    if (stagedChip) {
      void scheduleStagedOccurrence(stagedChip, targetDate, targetHour)
      return
    }

    const job = bookingId
      ? jobs.find(j => j.id === jobId && j.bookingId === bookingId)
      : jobs.find(j => j.id === jobId)
    if (!job) return

    if (!canUserEditJob(job)) {
      setJobErrorMessage('You can only edit jobs you are assigned to')
      setShowJobError(true)
      return
    }

    // Determine duration (in minutes)
    let durationMinutes = 60 // default
    if (job.serviceId) {
      const service = services.find(s => s.id === job.serviceId)
      if (service) {
        durationMinutes = service.duration
      }
    }

    // Compute startTime
    let startTime: Date
    if (targetHour !== undefined) {
      // Day/week view - use the specific hour
      startTime = new Date(targetDate)
      startTime.setHours(targetHour, 0, 0, 0)
    } else {
      // Month view - default to 9 AM
      startTime = new Date(targetDate)
      startTime.setHours(9, 0, 0, 0)
    }

    // Compute endTime
    const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000)

    // Independent without contact: update immediately, no need to ask about notification
    const hasContact = !!(job.contactId && String(job.contactId).trim())
    if (job.isIndependent && !hasContact) {
      updateIndependentBooking(jobId, {
        toBeScheduled: false,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      })
        .then(() => {
          const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
          const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
          return fetchJobs(startDate, endDate)
        })
        .catch((err: unknown) => {
          clearJobsError()
          setJobErrorMessage(
            getErrorMessage(err, 'Could not schedule this appointment. Ask an admin if you need permission changes.')
          )
          setShowJobError(true)
        })
      return
    }

    // Build payload and show notification prompt before scheduling
    const updatePayload: {
      id: string
      toBeScheduled: boolean
      startTime: string
      endTime: string
      bookingId?: string
      isIndependent?: boolean
    } = {
      id: jobId,
      toBeScheduled: false,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    }
    if (bookingId) updatePayload.bookingId = bookingId
    if (job.isIndependent) updatePayload.isIndependent = true
    setPendingUpdatePayload(updatePayload)
    setShowNotifyClientModal(true)
  }

  const error = jobsError || servicesError

  // Get the job being dragged for the ghost overlay
  const draggedJob = externalDragState.jobId
    ? externalDragState.jobId.startsWith('staged:')
      ? stagedVirtualChips.find(c => c.id === externalDragState.jobId)
      : externalDragState.bookingId
        ? jobs.find(
            j => j.id === externalDragState.jobId && j.bookingId === externalDragState.bookingId
          )
        : jobs.find(j => j.id === externalDragState.jobId)
    : null

  return (
    <div className="h-full flex flex-col min-w-0 gap-6">
      {/* Drag ghost overlay for "To Be Scheduled" chips */}
      {externalDragGhost?.isVisible && draggedJob && (
        <div
          className="fixed pointer-events-none z-[9999] rounded-lg bg-warning-soft text-warning shadow-pop opacity-95 ring-1 ring-inset ring-warning/30"
          style={{
            left: 0,
            top: 0,
            width: externalDragGhost.width,
            height: externalDragGhost.height,
            transform: `translate3d(${externalDragGhost.x}px, ${externalDragGhost.y}px, 0) scale(1.03)`,
            willChange: 'transform',
          }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-2 h-full">
            <ClockIcon className="h-4 w-4 flex-shrink-0" />
            <span className="font-medium truncate max-w-[200px]">{draggedJob.title}</span>
            <span className="font-mono tabular-nums text-xs opacity-70">({draggedJob.contactName})</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Scheduling</h1>
          <p className="text-sm text-ink-muted">Manage your calendar, jobs, and services</p>
        </div>
        <div className="flex items-center gap-2">
          {(activeTab === 'calendar' || activeTab === 'upcoming-bookings') && (
            <>
              {user?.canScheduleAppointments !== false && (
                <AppButton
                  onClick={() => setShowJobForm(true)}
                  className="w-full sm:w-auto"
                  title="Keyboard shortcut: Ctrl+N or ⌘N"
                >
                  Schedule Job
                </AppButton>
              )}
              {activeTab === 'calendar' && (
                <AppButton
                  onClick={handleOpenBookingLink}
                  variant="subtle"
                  className="w-full sm:w-auto"
                >
                  {buttonLinkCopied ? (
                    <span className="flex items-center gap-1.5">
                      <CheckIcon className="h-4 w-4" />
                      <span>Copied!</span>
                    </span>
                  ) : (
                    'Copy Booking Link'
                  )}
                </AppButton>
              )}
            </>
          )}
          {activeTab === 'services' && user?.role !== 'employee' && (
            <>
              <AppButton
                onClick={() => setShowServiceForm(true)}
                className="w-full sm:w-auto"
                title="Keyboard shortcut: Ctrl+N or ⌘N"
              >
                Create Service
              </AppButton>
              <AppButton
                onClick={handleOpenBookingLink}
                variant="subtle"
                className="w-full sm:w-auto"
              >
                {buttonLinkCopied ? (
                  <span className="flex items-center gap-1.5">
                    <CheckIcon className="h-4 w-4" />
                    <span>Copied!</span>
                  </span>
                ) : (
                  'Copy Booking Link'
                )}
              </AppButton>
            </>
          )}
        </div>
      </div>

      {/* Error Display - hidden while a form modal is open (the form shows its own error) */}
      {error && !showServiceForm && !showJobForm && (
        <div className="flex-shrink-0">
          <Alert
            tone="danger"
            icon={<AlertIcon className="h-4 w-4" />}
            onDismiss={() => {
              clearJobsError()
              clearServicesError()
            }}
          >
            {error}
          </Alert>
        </div>
      )}

      {/* Job Confirmation Display */}
      {showJobConfirmation && (
        <div className="flex-shrink-0">
          <Alert
            tone="success"
            icon={<CheckIcon className="h-4 w-4" />}
            onDismiss={() => setShowJobConfirmation(false)}
          >
            {jobConfirmationMessage}
          </Alert>
        </div>
      )}

      {/* Job Error Display */}
      {showJobError && (
        <div className="flex-shrink-0">
          <Alert
            tone="danger"
            icon={<AlertIcon className="h-4 w-4" />}
            onDismiss={() => setShowJobError(false)}
          >
            {jobErrorMessage}
          </Alert>
        </div>
      )}

      {/* Service Confirmation Display */}
      {showServiceConfirmation && (
        <div className="flex-shrink-0">
          <Alert
            tone="success"
            icon={<CheckIcon className="h-4 w-4" />}
            onDismiss={() => setShowServiceConfirmation(false)}
          >
            {serviceConfirmationMessage}
          </Alert>
        </div>
      )}

      {/* Tabs */}
      <div
        className="flex-shrink-0 min-w-0 -mx-4 md:-mx-6 px-4 md:px-6 overflow-hidden"
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      >
        <Tabs
          value={activeTab}
          onChange={value => {
            setActiveTab(value as 'calendar' | 'upcoming-bookings' | 'services' | 'archived')
            const params = new URLSearchParams(searchParams)
            params.set('tab', value)
            setSearchParams(params, { replace: true })
          }}
          tabs={[
            { value: 'calendar', label: 'Calendar' },
            {
              value: 'upcoming-bookings',
              label: (
                <>
                  <span className="sm:hidden">Bookings</span>
                  <span className="hidden sm:inline">Upcoming Bookings</span>
                </>
              ),
            },
            { value: 'services', label: 'Services' },
            { value: 'archived', label: 'Archive' },
          ]}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeTab === 'upcoming-bookings' && (
          <div className="h-full overflow-y-auto p-6">
            <JobList
              showCreatedBy={isTeamAccount}
              onJobClick={job => {
                setSelectedJob(job)
                setShowJobDetail(true)
              }}
            />
          </div>
        )}

        {activeTab === 'calendar' && (
          <div className="h-full flex flex-col min-w-0">
            {/* To Be Scheduled List (inline at top when visible) */}
            {toBeScheduledJobs.length > 0 && (
              <div ref={toBeScheduledInlineRef} className="border-b border-line p-4">
                <h3 className="text-sm font-semibold text-ink mb-3">
                  To Be Scheduled{' '}
                  <span className="font-mono tabular-nums text-ink-muted">
                    ({toBeScheduledJobs.length})
                  </span>
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {toBeScheduledJobs.map(job => {
                    const isDragging =
                      externalDragState.jobId === job.id &&
                      (externalDragState.bookingId === job.bookingId || !job.bookingId) &&
                      externalDragState.isDragging
                    return (
                      <div
                        key={job.bookingId ?? job.id}
                        onPointerDown={e => {
                          // Use pointer-based drag for ALL devices (mouse + touch)
                          e.stopPropagation()
                          e.currentTarget.setPointerCapture(e.pointerId)
                          externalDragRef.current = true

                          // Initialize drag ghost
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          setExternalDragGhost({
                            isVisible: false,
                            x: rect.left,
                            y: rect.top,
                            width: rect.width,
                            height: rect.height,
                            offsetX: e.clientX - rect.left,
                            offsetY: e.clientY - rect.top,
                          })

                          setExternalDragState({
                            jobId: job.id,
                            bookingId: job.bookingId ?? null,
                            pointerId: e.pointerId,
                            isDragging: false,
                            hasMoved: false,
                          })
                        }}
                        onClick={() => {
                          // Prevent click entirely if we're dragging or have started a drag
                          if (
                            externalDragRef.current ||
                            externalDragState.isDragging ||
                            externalDragState.hasMoved
                          ) {
                            return
                          }
                          setSelectedJob(job)
                          setShowJobDetail(true)
                        }}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-soft text-warning ring-1 ring-inset ring-warning/30 text-sm cursor-move hover:opacity-80 transition-all touch-none"
                        style={{
                          opacity: isDragging ? 0 : undefined,
                          pointerEvents: isDragging ? 'none' : undefined,
                        }}
                        title="Drag to calendar to schedule"
                      >
                        <ClockIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="font-medium truncate max-w-[200px]">{job.title}</span>
                        <span className="text-xs opacity-70">({job.contactName})</span>
                        {stagedMonthlyLabel(job) && (
                          <span className="ml-0.5 inline-flex items-center rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-warning/30">
                            {stagedMonthlyLabel(job)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Calendar */}
            <div ref={calendarPaneRef} className="flex-1 min-h-0 relative">
              {/* Floating "To Be Scheduled" overlay (always visible) */}
              {showFloatingToBeScheduled && (
                <div
                  className="fixed z-50 pointer-events-auto"
                  style={{
                    top: floatingToBeScheduledPos.top,
                    left: floatingToBeScheduledPos.left,
                    maxWidth: floatingToBeScheduledPos.maxWidth,
                  }}
                >
                  <div className="rounded-xl bg-surface/95 backdrop-blur-md shadow-pop ring-1 ring-line">
                    <button
                      type="button"
                      onClick={() => setToBeScheduledOverlayOpen(v => !v)}
                      className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                      aria-expanded={toBeScheduledOverlayOpen}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning-soft text-warning flex-shrink-0">
                          <ClockIcon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-semibold text-ink truncate">
                          To Be Scheduled
                        </span>
                        <span className="font-mono tabular-nums text-xs text-ink-muted flex-shrink-0">
                          ({toBeScheduledJobs.length})
                        </span>
                      </div>
                      <span className="text-sm text-ink-muted flex-shrink-0">
                        {toBeScheduledOverlayOpen ? 'Hide' : 'Show'}
                      </span>
                    </button>

                    {toBeScheduledOverlayOpen && (
                      <div className="px-3 pb-3">
                        <div className="flex gap-2 flex-wrap max-h-40 overflow-auto pr-1">
                          {toBeScheduledJobs.map(job => {
                            const isDragging =
                              externalDragState.jobId === job.id &&
                              (externalDragState.bookingId === job.bookingId || !job.bookingId) &&
                              externalDragState.isDragging
                            return (
                              <div
                                key={job.bookingId ?? job.id}
                                onPointerDown={e => {
                                  // Use pointer-based drag for ALL devices (mouse + touch)
                                  e.stopPropagation()
                                  e.currentTarget.setPointerCapture(e.pointerId)
                                  externalDragRef.current = true

                                  // Initialize drag ghost
                                  const rect = (
                                    e.currentTarget as HTMLElement
                                  ).getBoundingClientRect()
                                  setExternalDragGhost({
                                    isVisible: false,
                                    x: rect.left,
                                    y: rect.top,
                                    width: rect.width,
                                    height: rect.height,
                                    offsetX: e.clientX - rect.left,
                                    offsetY: e.clientY - rect.top,
                                  })

                                  setExternalDragState({
                                    jobId: job.id,
                                    bookingId: job.bookingId ?? null,
                                    pointerId: e.pointerId,
                                    isDragging: false,
                                    hasMoved: false,
                                  })
                                }}
                                onClick={() => {
                                  // Prevent click entirely if we're dragging or have started a drag
                                  if (
                                    externalDragRef.current ||
                                    externalDragState.isDragging ||
                                    externalDragState.hasMoved
                                  ) {
                                    return
                                  }
                                  setSelectedJob(job)
                                  setShowJobDetail(true)
                                }}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-soft text-warning ring-1 ring-inset ring-warning/30 text-sm cursor-move hover:opacity-80 transition-all touch-none"
                                style={{
                                  opacity: isDragging ? 0 : undefined,
                                  pointerEvents: isDragging ? 'none' : undefined,
                                }}
                                title="Drag to calendar to schedule"
                              >
                                <span className="font-medium truncate max-w-[220px]">
                                  {job.title}
                                </span>
                                <span className="text-xs opacity-70">({job.contactName})</span>
                                {stagedMonthlyLabel(job) && (
                                  <span className="ml-0.5 inline-flex items-center rounded-full bg-warning/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset ring-warning/30">
                                    {stagedMonthlyLabel(job)}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Calendar
                jobs={scheduledJobs}
                viewMode={viewMode}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                onViewModeChange={setViewMode}
                onJobClick={job => {
                  setSelectedJob(job)
                  setShowJobDetail(true)
                }}
                onDateClick={date => {
                  setCurrentDate(date)
                  setViewMode('day')
                }}
                onUnscheduledDrop={handleUnscheduledDrop}
                onUpdateSuccess={(message) => {
                  setJobConfirmationMessage(message)
                  setShowJobConfirmation(true)
                  setTimeout(() => setShowJobConfirmation(false), 3000)
                }}
                onUpdateError={(message) => {
                  setJobErrorMessage(message)
                  setShowJobError(true)
                }}
                user={user}
              />
            </div>
          </div>
        )}

        {activeTab === 'archived' && (
          <div className="h-full overflow-hidden p-6">
            <ArchivedJobsPage
              onJobRestore={handleRestoreJob}
              onJobSelect={job => {
                setSelectedJob(job)
                setShowJobDetail(true)
              }}
              onPermanentDelete={job => {
                handleRequestPermanentDelete(job)
              }}
              deletedJobId={deletedJobId}
              deletedRecurrenceId={deletedRecurrenceId}
            />
          </div>
        )}

        {activeTab === 'services' && (
          <div className="h-full overflow-y-auto">
            <ServiceList
              onServiceClick={id => {
                const service = services.find(s => s.id === id)
                if (service) {
                  setSelectedService(service)
                  setShowServiceDetail(true)
                }
              }}
              onCreateClick={user?.role !== 'employee' ? () => setShowServiceForm(true) : undefined}
            />
          </div>
        )}
      </div>

      {/* Job Form Modal */}
      <AppModal
        isOpen={showJobForm}
        onClose={() => {
          setShowJobForm(false)
          setEditingJob(null)
          setCreateJobDefaults({}) // Clear defaults when closing
          setLinkExistingJobId(undefined)
          clearJobsError()
        }}
        title={
          editingJob?.isIndependent
            ? 'Edit Appointment'
            : editingJob?.toBeScheduled
              ? 'Schedule Job'
              : editingJob
                ? 'Edit Job'
                : 'Schedule Job'
        }
        size="xl"
      >
        <JobForm
          key={
            editingJob?.id ||
            `new-${createJobDefaults.contactId || 'default'}-${linkExistingJobId || 'none'}`
          } // Force remount when switching between edit/new or when defaults change
          job={editingJob || undefined}
          onSubmit={
            editingJob
              ? handleUpdateJob
              : async (data, existingJobId, isIndependent) => {
                  if (isIndependent) {
                    try {
                      await createIndependentBooking(data)
                      setShowJobForm(false)
                      clearJobsError()
                      setJobConfirmationMessage('Appointment scheduled')
                      setShowJobConfirmation(true)
                      setTimeout(() => setShowJobConfirmation(false), 3000)
                    } catch (error: any) {
                      // Error will be displayed in the modal via jobsError
                    }
                  } else if (existingJobId) {
                    // Update existing job instead of creating new one
                    try {
                      await updateJob({ id: existingJobId, ...data })
                      setShowJobForm(false)
                      clearJobsError()
                      setJobConfirmationMessage('Appointment scheduled for linked job')
                      setShowJobConfirmation(true)
                      setTimeout(() => setShowJobConfirmation(false), 3000)
                    } catch (error: any) {
                      // Error will be displayed in the modal via jobsError
                      // Keep the modal open so user can fix the issue
                    }
                  } else {
                    await handleCreateJob(data)
                  }
                }
          }
          onCancel={() => {
            setShowJobForm(false)
            setEditingJob(null)
            setCreateJobDefaults({}) // Clear defaults when canceling
            setLinkExistingJobId(undefined)
            clearJobsError()
          }}
          isLoading={jobsLoading}
          error={jobsError}
          schedulingUnscheduledJob={editingJob?.toBeScheduled}
          defaultContactId={!editingJob ? createJobDefaults.contactId : undefined}
          defaultTitle={!editingJob ? createJobDefaults.title : undefined}
          defaultNotes={!editingJob ? createJobDefaults.notes : undefined}
          defaultLocation={!editingJob ? createJobDefaults.location : undefined}
          defaultDescription={!editingJob ? createJobDefaults.description : undefined}
          defaultPrice={!editingJob ? createJobDefaults.price : undefined}
          defaultServiceId={!editingJob ? createJobDefaults.serviceId : undefined}
          defaultAssignedTo={!editingJob ? createJobDefaults.assignedTo : undefined}
          allowLinkExistingJob={!editingJob && activeTab === 'calendar'} // Allow linking when creating new job from calendar
          existingJobId={!editingJob ? linkExistingJobId : undefined} // Pre-select job when scheduling from job detail
          // Don't use simplified form for Schedule Job button - show all fields
        />
      </AppModal>

      <NotifyClientModal
        isOpen={showNotifyClientModal}
        message={
          pendingCreatePayload
            ? 'Would you like to notify the client about this appointment?'
            : 'Would you like to notify the client about this schedule update?'
        }
        onClose={() => {
          if (notifyHandledRef.current) return
          notifyHandledRef.current = true
          if (pendingCreatePayload) {
            performCreateJob(pendingCreatePayload, false)
          } else if (pendingUpdatePayload) {
            const { isIndependent, ...rest } = pendingUpdatePayload
            if (isIndependent) {
              updateIndependentBooking(rest.id, { startTime: rest.startTime, endTime: rest.endTime, notifyClient: false }).then(() => {
                const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
                const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
                fetchJobs(startDate, endDate)
                setJobConfirmationMessage('Appointment updated successfully')
                setShowJobConfirmation(true)
                setTimeout(() => setShowJobConfirmation(false), 3000)
              }).catch((err: unknown) => {
                clearJobsError()
                setJobErrorMessage(
                  getErrorMessage(err, 'Could not update this appointment. Ask an admin if you need permission changes.')
                )
                setShowJobError(true)
              })
            } else {
              performJobUpdate({ ...rest, notifyClient: false })
            }
          } else if (pendingUpdatePayload) {
            const { isIndependent, ...rest } = pendingUpdatePayload
            if (isIndependent) {
              updateIndependentBooking(rest.id, { startTime: rest.startTime, endTime: rest.endTime, notifyClient: true }).then(() => {
                const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
                const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
                fetchJobs(startDate, endDate)
                setJobConfirmationMessage('Sent via email and SMS')
                setShowJobConfirmation(true)
                setTimeout(() => setShowJobConfirmation(false), 3000)
              }).catch((err: unknown) => {
                clearJobsError()
                setJobErrorMessage(
                  getErrorMessage(err, 'Could not update this appointment. Ask an admin if you need permission changes.')
                )
                setShowJobError(true)
              })
            } else {
              performJobUpdate({ ...rest, notifyClient: false })
            }
          }
          setShowNotifyClientModal(false)
          setPendingCreatePayload(null)
          setPendingUpdatePayload(null)
        }}
        onNotify={notify => {
          if (notifyHandledRef.current) return
          notifyHandledRef.current = true
          if (pendingCreatePayload) {
            performCreateJob(pendingCreatePayload, notify)
          } else if (pendingUpdatePayload) {
            const { isIndependent, ...rest } = pendingUpdatePayload
            if (isIndependent) {
              updateIndependentBooking(rest.id, { startTime: rest.startTime, endTime: rest.endTime, notifyClient: notify }).then(() => {
                const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1)
                const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 5, 0)
                fetchJobs(startDate, endDate)
                setJobConfirmationMessage('Appointment updated successfully')
                setShowJobConfirmation(true)
                setTimeout(() => setShowJobConfirmation(false), 3000)
              }).catch((err: unknown) => {
                clearJobsError()
                setJobErrorMessage(
                  getErrorMessage(err, 'Could not update this appointment. Ask an admin if you need permission changes.')
                )
                setShowJobError(true)
              })
            } else {
              performJobUpdate({ ...rest, notifyClient: notify })
            }
          }
          setShowNotifyClientModal(false)
          setPendingCreatePayload(null)
          setPendingUpdatePayload(null)
        }}
      />

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          isOpen={showJobDetail}
          showCreatedBy={isTeamAccount}
          onClose={() => {
            setSelectedJob(null)
            setShowJobDetail(false)
          }}
          onEdit={canUserEditJob(selectedJob) ? handleEditJob : undefined}
          onDelete={canUserEditJob(selectedJob) ? handleDeleteJob : undefined}
          onPermanentDelete={canUserEditJob(selectedJob) ? () => handleRequestPermanentDelete() : undefined}
          onRestore={!selectedJob.isIndependent && canUserEditJob(selectedJob) ? handleRestoreJob : undefined}
          onConfirm={handleConfirmJob}
          onDecline={() => setShowDeclineModal(true)}
          onScheduleFollowup={handleScheduleFollowup}
          onScheduleJob={handleScheduleJob}
        />
      )}

      {/* Follow-up Job Modal */}
      <ScheduleJobModal
        isOpen={showFollowupModal}
        onClose={() => {
          setShowFollowupModal(false)
          setFollowupDefaults({})
        }}
        defaultContactId={followupDefaults.contactId}
        defaultTitle={followupDefaults.title}
        defaultNotes={followupDefaults.notes}
        defaultLocation={followupDefaults.location}
        defaultServiceId={followupDefaults.serviceId}
        defaultDescription={followupDefaults.description}
        defaultPrice={followupDefaults.price}
        sourceContext="job-followup"
        allowLinkExistingJob={true} // Allow linking to existing jobs for follow-ups
        existingJobId={selectedJob?.id} // Auto-select the current job when scheduling from it
        onSuccess={(_, options) => {
          const message =
            options?.notifySent
              ? 'Sent via email and SMS'
              : options?.action === 'independent'
                ? 'Appointment scheduled'
                : options?.action === 'linked'
                  ? 'Appointment scheduled for linked job'
                  : options?.action === 'new'
                    ? 'Job created and appointment scheduled'
                    : null
          if (message) {
            setJobConfirmationMessage(message)
            setShowJobConfirmation(true)
            setTimeout(() => setShowJobConfirmation(false), 3000)
          }
          setSelectedJob(null)
          setShowJobDetail(false)
        }}
      />

      {/* Decline Job Modal */}
      <AppModal
        isOpen={showDeclineModal}
        onClose={() => {
          setShowDeclineModal(false)
          setDeclineReason('')
        }}
        title="Decline Booking"
        size="md"
        footer={
          <>
            <AppButton
              variant="ghost"
              onClick={() => {
                setShowDeclineModal(false)
                setDeclineReason('')
              }}
            >
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleDeclineJob}>
              Decline Booking
            </AppButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Are you sure you want to decline this booking? The client will be notified via email.
          </p>
          <TextAreaField
            label="Reason (Optional)"
            value={declineReason}
            onChange={e => setDeclineReason(e.target.value)}
            rows={3}
            placeholder="Let the client know why you can't accommodate this booking..."
          />
        </div>
      </AppModal>

      {/* Service Detail Modal */}
      {selectedService && (
        <ServiceDetail
          service={selectedService}
          isOpen={showServiceDetail}
          onClose={() => {
            setShowServiceDetail(false)
            setSelectedService(null)
          }}
          onEdit={
            user?.role !== 'employee'
              ? () => {
                  setShowServiceDetail(false)
                  setShowServiceForm(true)
                }
              : undefined
          }
          onDelete={user?.role !== 'employee' ? handleDeleteService : undefined}
          onGetLink={handleGetBookingLink}
        />
      )}

      {/* Service Form Modal */}
      <AppModal
        isOpen={showServiceForm}
        onClose={() => {
          setShowServiceForm(false)
          setSelectedService(null)
          clearServicesError()
        }}
        title={selectedService ? 'Edit Service' : 'Create New Service'}
        size="xl"
      >
        <ServiceForm
          service={selectedService || undefined}
          onSubmit={selectedService ? handleUpdateService : handleCreateService}
          onCancel={() => {
            setShowServiceForm(false)
            setSelectedService(null)
            clearServicesError()
          }}
          isLoading={servicesLoading}
          error={servicesError}
        />
      </AppModal>

      {/* Delete Recurring Job Modal */}
      {selectedJob && (
        <DeleteRecurringJobModal
          isOpen={showDeleteRecurringModal}
          onClose={() => setShowDeleteRecurringModal(false)}
          onDeleteOne={handleDeleteSingleJob}
          onDeleteAll={handleDeleteAllJobs}
          jobTitle={selectedJob.title}
          occurrenceCount={selectedJob.occurrenceCount}
        />
      )}

      {/* Edit Recurring Job Modal */}
      {selectedJob && (
        <EditRecurringJobModal
          isOpen={showEditRecurringModal}
          onClose={() => setShowEditRecurringModal(false)}
          onEditOne={handleEditSingleJob}
          onEditAll={handleEditAllJobs}
          jobTitle={selectedJob.title}
          occurrenceCount={selectedJob.occurrenceCount}
        />
      )}

      {/* Permanent Delete Confirmation Dialog */}
      {selectedJob && (
        <AppModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          title={selectedJob?.bookingId ? 'Delete appointment?' : 'Archive job?'}
          size="sm"
          footer={
            <>
              <AppButton variant="ghost" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </AppButton>
              <AppButton
                variant="danger"
                onClick={async () => {
                  setShowDeleteConfirm(false)
                  try {
                    await handleDeleteSingleJob()
                  } catch (error) {
                    console.error('Failed to delete booking:', error)
                    // Error is already logged, user will see it via the store error state
                  }
                }}
              >
                {selectedJob?.bookingId ? 'Delete appointment' : 'Archive job'}
              </AppButton>
            </>
          }
        >
          <div className="space-y-3">
            {selectedJob?.bookingId ? (
              <>
                <p className="text-ink">
                  Are you sure you want to delete this appointment from the calendar?
                </p>
                <div className="rounded-lg bg-info-soft p-3">
                  <p className="text-sm mb-2 text-ink-muted">
                    <strong className="text-ink">Important:</strong> This only removes the
                    appointment, not the job itself.
                  </p>
                  <p className="text-sm text-ink-muted">
                    The job "{selectedJob?.title}" will remain on your Jobs page and can be
                    scheduled again later.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-ink">This job has no appointments. Archive the job?</p>
                <div className="rounded-lg bg-info-soft p-3">
                  <p className="text-sm text-ink-muted">
                    "{selectedJob?.title}" will move to the Archive tab on the Jobs page, where it
                    can be restored later.
                  </p>
                </div>
              </>
            )}
          </div>
        </AppModal>
      )}

      {/* Stop Monthly Series Confirmation (staged series) */}
      {selectedJob && (
        <AppModal
          isOpen={showStopSeriesConfirm}
          onClose={() => setShowStopSeriesConfirm(false)}
          title="Stop monthly series?"
          size="sm"
          footer={
            <>
              <AppButton variant="ghost" onClick={() => setShowStopSeriesConfirm(false)}>
                Cancel
              </AppButton>
              <AppButton variant="danger" onClick={handleStopSeries}>
                Stop series
              </AppButton>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-ink">This stops the monthly reminder from appearing.</p>
            <div className="rounded-lg bg-info-soft p-3">
              <p className="text-sm text-ink-muted">
                Appointments you've already scheduled stay on the calendar.
              </p>
            </div>
          </div>
        </AppModal>
      )}

      {/* Permanent Delete Confirmation */}
      {selectedJob && (
        <AppModal
          isOpen={showPermanentDeleteConfirm}
          onClose={() => setShowPermanentDeleteConfirm(false)}
          title="Permanently delete appointment?"
          size="sm"
          footer={
            <>
              <AppButton variant="ghost" onClick={() => setShowPermanentDeleteConfirm(false)}>
                Cancel
              </AppButton>
              <AppButton variant="danger" onClick={handleConfirmPermanentDelete}>
                Delete Permanently
              </AppButton>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-ink">
              Are you sure you want to <strong className="text-danger">PERMANENTLY</strong> delete
              this appointment?
            </p>
            <div className="rounded-lg bg-danger-soft p-3">
              <p className="text-sm font-semibold mb-1 text-danger">
                This action cannot be undone!
              </p>
              <p className="text-sm text-ink-muted">
                The appointment will be removed from the calendar and database.
              </p>
            </div>
            <div className="rounded-lg bg-info-soft p-3">
              <p className="text-sm text-ink-muted">
                The job "{selectedJob.title}" itself stays on your Jobs page. To delete the job,
                use the Jobs page.
              </p>
            </div>
          </div>
        </AppModal>
      )}

      {/* Permanent Delete Recurring Job Modal */}
      {selectedJob && (
        <PermanentDeleteRecurringJobModal
          isOpen={showPermanentDeleteRecurringModal}
          onClose={() => setShowPermanentDeleteRecurringModal(false)}
          onDeleteOne={handlePermanentDeleteSingleJob}
          onDeleteAll={handlePermanentDeleteAllJobs}
          jobTitle={selectedJob.title}
          occurrenceCount={selectedJob.occurrenceCount}
          isArchived={!!selectedJob.archivedAt}
        />
      )}

      {/* Booking Link Modal */}
      <AppModal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false)
          setBookingLink('')
        }}
        title="Booking Link"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Share this link with clients so they can view all your services and book appointments:
          </p>
          <div className="flex items-center gap-2">
            <TextField type="text" value={bookingLink} readOnly className="flex-1" />
            <AppButton
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(bookingLink)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              }}
              className="relative min-w-[80px]"
            >
              {linkCopied ? (
                <span className="flex items-center gap-1.5">
                  <CheckIcon className="h-4 w-4" />
                  <span>Copied</span>
                </span>
              ) : (
                'Copy'
              )}
            </AppButton>
          </div>
          <p className="text-xs text-ink-subtle">
            Clients can select a time and book without logging in.
          </p>
        </div>
      </AppModal>

      {/* No Services Modal */}
      <AppModal
        isOpen={showNoServicesModal}
        onClose={() => setShowNoServicesModal(false)}
        title=""
        size="md"
      >
        <div className="space-y-6 py-2">
          {/* Icon and Title */}
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warning-soft text-warning flex items-center justify-center">
              <AlertIcon className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-ink">No Services Set Up</h2>
            <p className="text-sm text-ink-muted">
              Oops! You haven't set up any services. Set up service now.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <AppButton
              variant="ghost"
              onClick={() => setShowNoServicesModal(false)}
              fullWidth
            >
              Cancel
            </AppButton>
            <AppButton
              onClick={() => {
                setShowNoServicesModal(false)
                setActiveTab('services')
                setShowServiceForm(true)
              }}
              fullWidth
            >
              Set Up Service Now
            </AppButton>
          </div>
        </div>
      </AppModal>
    </div>
  )
}

export default SchedulingPage
