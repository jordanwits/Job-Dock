import { useState, useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useJobStore } from '../store/jobStore'
import { useServiceStore } from '../store/serviceStore'
import { useAuthStore } from '@/features/auth'
import Calendar from '../components/Calendar'
import JobList from '../components/JobList'
import JobForm from '../components/JobForm'
import JobDetail from '../components/JobDetail'
import ServiceList from '../components/ServiceList'
import ServiceForm from '../components/ServiceForm'
import ServiceDetail from '../components/ServiceDetail'
import ScheduleJobModal from '../components/ScheduleJobModal'
import DeleteRecurringJobModal from '../components/DeleteRecurringJobModal'
import EditRecurringJobModal from '../components/EditRecurringJobModal'
import PermanentDeleteRecurringJobModal from '../components/PermanentDeleteRecurringJobModal'
import ArchivedJobsPage from '../components/ArchivedJobsPage'
import { Button, Modal, Card, ConfirmationDialog } from '@/components/ui'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addWeeks } from 'date-fns'

const SchedulingPage = () => {
  const { user } = useAuthStore()
  const [searchParams] = useSearchParams()

  const {
    jobs,
    selectedJob,
    isLoading: jobsLoading,
    error: jobsError,
    viewMode,
    currentDate,
    createJob,
    updateJob,
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
  const [showServiceForm, setShowServiceForm] = useState(false)
  const [showServiceDetail, setShowServiceDetail] = useState(false)
  const [bookingLink, setBookingLink] = useState<string>('')
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')

  // Initialize activeTab from URL query parameter or default to 'calendar'
  const tabParam = searchParams.get('tab')
  const initialTab =
    tabParam === 'jobs' || tabParam === 'services' || tabParam === 'calendar'
      ? tabParam
      : 'calendar'
  const [activeTab, setActiveTab] = useState<'calendar' | 'jobs' | 'services' | 'archived'>(
    initialTab as 'calendar' | 'jobs' | 'services' | 'archived'
  )

  const [linkCopied, setLinkCopied] = useState(false)
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
  const [showJobConfirmation, setShowJobConfirmation] = useState(false)
  const [jobConfirmationMessage, setJobConfirmationMessage] = useState('')

  // Conflict handling removed - double booking now allowed
  const [showJobError, setShowJobError] = useState(false)
  const [jobErrorMessage, setJobErrorMessage] = useState('')
  const [showServiceConfirmation, setShowServiceConfirmation] = useState(false)
  const [serviceConfirmationMessage, setServiceConfirmationMessage] = useState('')
  const [showArchivedJobs, setShowArchivedJobs] = useState(false)
  const [showPermanentDeleteConfirm, setShowPermanentDeleteConfirm] = useState(false)
  const [showPermanentDeleteRecurringModal, setShowPermanentDeleteRecurringModal] = useState(false)
  const [deletedJobId, setDeletedJobId] = useState<string | null>(null)
  const [deletedRecurrenceId, setDeletedRecurrenceId] = useState<string | null>(null)
  const [showJobDetail, setShowJobDetail] = useState(false)

  // External drag state for "To Be Scheduled" chips
  const [externalDragState, setExternalDragState] = useState<{
    jobId: string | null
    pointerId: number | null
    isDragging: boolean
    hasMoved: boolean
  }>({
    jobId: null,
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

            // Call the existing handleUnscheduledDrop function
            await handleUnscheduledDrop(externalDragState.jobId, dropDate, dropHour)
          }
        }
      }

      // Clear drag state
      externalDragRef.current = false
      setExternalDragGhost(null)
      setExternalDragState({
        jobId: null,
        pointerId: null,
        isDragging: false,
        hasMoved: false,
      })
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

  const toBeScheduledJobs = useMemo(() => {
    return activeJobs.filter(job => job.toBeScheduled || !job.startTime || !job.endTime)
  }, [activeJobs])

  // Set active tab from URL parameter on mount
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'jobs' || tabParam === 'services' || tabParam === 'calendar') {
      setActiveTab(tabParam)
    }
  }, [searchParams])

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
          if (activeTab === 'services') {
            setShowServiceForm(true)
          } else {
            // For both 'calendar' and 'jobs' tabs, create a job
            setShowJobForm(true)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showJobForm, showServiceForm, selectedJob, selectedService, activeTab])

  const handleCreateJob = async (data: any) => {
    try {
      await createJob(data)
      setShowJobForm(false)
      clearJobsError()
      setJobConfirmationMessage('Job created successfully')
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
      recurrenceId: editingJob?.recurrenceId,
      hasRecurrence: !!data.recurrence,
      recurrenceData: data.recurrence,
    })
    try {
      if (editingJob) {
        const updatePayload = { ...data, id: editingJob.id, updateAll: editUpdateAll }
        console.log('📤 Sending update payload:', updatePayload)
        await updateJob(updatePayload)
        setEditingJob(null)
        setEditUpdateAll(false)
        setShowJobForm(false)
        setSelectedJob(null)
        setShowJobDetail(false)
        clearJobsError()
        const message = editUpdateAll
          ? 'All future jobs updated successfully'
          : 'Job updated successfully'
        setJobConfirmationMessage(message)
        setShowJobConfirmation(true)
        setTimeout(() => setShowJobConfirmation(false), 3000)
      }
    } catch (error: any) {
      // Error will be displayed in the modal via jobsError
      // Keep the modal open so user can fix the issue
    }
  }

  const handleEditJob = () => {
    if (selectedJob) {
      // Check if this is a recurring job
      if (selectedJob.recurrenceId) {
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
      // Check if this is a recurring job
      if (selectedJob.recurrenceId) {
        setShowDeleteRecurringModal(true)
      } else {
        // Non-recurring job - delete directly
        handleDeleteSingleJob()
      }
    }
  }

  const handleDeleteSingleJob = async () => {
    if (selectedJob) {
      try {
        console.log('Archiving single job:', selectedJob.id)
        await deleteJob(selectedJob.id, false)
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowDeleteRecurringModal(false)
        // No need to refetch - store already updated the job with archivedAt
      } catch (error) {
        console.error('Error archiving single job:', error)
        // Error handled by store
      }
    }
  }

  const handleDeleteAllJobs = async () => {
    if (selectedJob) {
      try {
        console.log('Archiving all jobs with recurrenceId:', selectedJob.recurrenceId)
        await deleteJob(selectedJob.id, true)
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowDeleteRecurringModal(false)
        // No need to refetch - store already updated the jobs with archivedAt
      } catch (error) {
        console.error('Error archiving all jobs:', error)
        // Error handled by store
      }
    }
  }

  const handlePermanentDeleteJob = (job?: typeof selectedJob) => {
    const jobToDelete = job || selectedJob
    if (jobToDelete) {
      // Set as selected for the confirmation modal to use
      if (job) {
        setSelectedJob(job)
      }
      // Check if this is a recurring job
      if (jobToDelete.recurrenceId) {
        setShowPermanentDeleteRecurringModal(true)
      } else {
        setShowPermanentDeleteConfirm(true)
      }
    }
  }

  const handleConfirmPermanentDelete = async () => {
    if (selectedJob) {
      try {
        const jobId = selectedJob.id
        await permanentDeleteJob(jobId, false)
        setDeletedJobId(jobId) // Notify ArchivedJobsPage
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowPermanentDeleteConfirm(false)
        // No need to refetch - store already removed the job from the array
      } catch (error) {
        console.error('Error permanently deleting job:', error)
      }
    }
  }

  const handlePermanentDeleteSingleJob = async () => {
    if (selectedJob) {
      try {
        const jobId = selectedJob.id
        await permanentDeleteJob(jobId, false)
        setDeletedJobId(jobId) // Notify ArchivedJobsPage
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowPermanentDeleteRecurringModal(false)
        // No need to refetch - store already removed the job from the array
      } catch (error) {
        console.error('Error permanently deleting single job:', error)
      }
    }
  }

  const handlePermanentDeleteAllJobs = async () => {
    if (selectedJob) {
      try {
        const recurrenceId = selectedJob.recurrenceId
        await permanentDeleteJob(selectedJob.id, true)
        if (recurrenceId) {
          setDeletedRecurrenceId(recurrenceId) // Notify ArchivedJobsPage to remove all jobs with this recurrenceId
        }
        setSelectedJob(null)
        setShowJobDetail(false)
        setShowPermanentDeleteRecurringModal(false)
        // No need to refetch - store already removed the job from the array
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
    // Open unified tenant booking link directly in a new tab
    const tenantId = user?.tenantId || localStorage.getItem('tenant_id') || ''
    const baseUrl = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin
    const unifiedLink = `${baseUrl}/book?tenant=${tenantId}`
    window.open(unifiedLink, '_blank')
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

  const handleUnscheduledDrop = async (jobId: string, targetDate: Date, targetHour?: number) => {
    try {
      const job = jobs.find(j => j.id === jobId)
      if (!job) return

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

      // Update the job
      await updateJob({
        id: jobId,
        toBeScheduled: false,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      })

      setJobConfirmationMessage('Job scheduled successfully')
      setShowJobConfirmation(true)
      setTimeout(() => setShowJobConfirmation(false), 3000)
    } catch (error) {
      console.error('Failed to schedule job:', error)
    }
  }

  const error = jobsError || servicesError

  // Get the job being dragged for the ghost overlay
  const draggedJob = externalDragState.jobId
    ? jobs.find(j => j.id === externalDragState.jobId)
    : null

  return (
    <div className="h-full flex flex-col min-w-0 gap-6">
      {/* Drag ghost overlay for "To Be Scheduled" chips */}
      {externalDragGhost?.isVisible && draggedJob && (
        <div
          className="fixed pointer-events-none z-[9999] rounded-lg border border-amber-500/30 shadow-2xl opacity-95 bg-amber-500/10"
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
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium truncate max-w-[200px] text-amber-400">
              {draggedJob.title}
            </span>
            <span className="text-xs text-amber-400/60">({draggedJob.contactName})</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-primary-light tracking-tight">
            <span className="text-primary-gold">Scheduling</span>
          </h1>
          <p className="text-sm md:text-base text-primary-light/60">
            Manage your calendar, jobs, and services
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'calendar' && (
            <>
              <Button
                onClick={() => setShowJobForm(true)}
                className="w-full sm:w-auto"
                title="Keyboard shortcut: Ctrl+N or ⌘N"
              >
                Schedule Job
              </Button>
              <Button
                onClick={handleOpenBookingLink}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Booking Link
              </Button>
            </>
          )}
          {activeTab === 'services' && (
            <>
              <Button
                onClick={() => setShowServiceForm(true)}
                className="w-full sm:w-auto"
                title="Keyboard shortcut: Ctrl+N or ⌘N"
              >
                Create Service
              </Button>
              <Button
                onClick={handleOpenBookingLink}
                variant="secondary"
                className="w-full sm:w-auto"
              >
                Booking Link
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearJobsError()
                clearServicesError()
              }}
            >
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Job Confirmation Display */}
      {showJobConfirmation && (
        <Card className="bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-400">✓ {jobConfirmationMessage}</p>
            <Button variant="ghost" size="sm" onClick={() => setShowJobConfirmation(false)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Job Error Display */}
      {showJobError && (
        <Card className="bg-red-500/10 border-red-500/30 ring-1 ring-red-500/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-400">✗ {jobErrorMessage}</p>
            <Button variant="ghost" size="sm" onClick={() => setShowJobError(false)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Service Confirmation Display */}
      {showServiceConfirmation && (
        <Card className="bg-green-500/10 border-green-500/30 ring-1 ring-green-500/20 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-green-400">✓ {serviceConfirmationMessage}</p>
            <Button variant="ghost" size="sm" onClick={() => setShowServiceConfirmation(false)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {/* Tabs - horizontal scroll when needed, vertical locked. Negative margin extends into container padding for more room. */}
      <div 
        className="flex items-center gap-1 md:gap-2 border-b border-white/10 overflow-x-auto overflow-y-hidden flex-shrink-0 min-w-0 -mx-4 md:-mx-6 px-4 md:px-6"
        style={{ touchAction: 'pan-x', overscrollBehaviorY: 'none' }}
      >
        <button
          onClick={() => setActiveTab('calendar')}
          className={`
            px-2 sm:px-3 md:px-4 py-2 font-medium transition-all whitespace-nowrap text-sm md:text-base flex-shrink-0
            ${
              activeTab === 'calendar'
                ? 'text-primary-gold border-b-2 border-primary-gold -mb-[1px]'
                : 'text-primary-light/60 hover:text-primary-light/90'
            }
          `}
        >
          Calendar
        </button>
        <button
          onClick={() => setActiveTab('jobs')}
          className={`
            px-2 sm:px-3 md:px-4 py-2 font-medium transition-all whitespace-nowrap text-sm md:text-base flex-shrink-0
            ${
              activeTab === 'jobs'
                ? 'text-primary-gold border-b-2 border-primary-gold -mb-[1px]'
                : 'text-primary-light/60 hover:text-primary-light/90'
            }
          `}
        >
          Upcoming Jobs
        </button>
        <button
          onClick={() => setActiveTab('services')}
          className={`
            px-2 sm:px-3 md:px-4 py-2 font-medium transition-all whitespace-nowrap text-sm md:text-base flex-shrink-0
            ${
              activeTab === 'services'
                ? 'text-primary-gold border-b-2 border-primary-gold -mb-[1px]'
                : 'text-primary-light/60 hover:text-primary-light/90'
            }
          `}
        >
          Services
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`
            px-2 sm:px-3 md:px-4 py-2 font-medium transition-all whitespace-nowrap text-sm md:text-base flex-shrink-0
            ${
              activeTab === 'archived'
                ? 'text-primary-gold border-b-2 border-primary-gold -mb-[1px]'
                : 'text-primary-light/60 hover:text-primary-light/90'
            }
          `}
        >
          Archive
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {activeTab === 'calendar' && (
          <div className="h-full flex flex-col min-w-0">
            {/* To Be Scheduled List */}
            {toBeScheduledJobs.length > 0 && (
              <div className="border-b border-white/10 bg-primary-dark-secondary/50 p-4">
                <h3 className="text-sm font-semibold text-primary-gold mb-3">
                  To Be Scheduled ({toBeScheduledJobs.length})
                </h3>
                <div className="flex gap-2 flex-wrap">
                  {toBeScheduledJobs.map(job => {
                    const isDragging =
                      externalDragState.jobId === job.id && externalDragState.isDragging
                    return (
                      <div
                        key={job.id}
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
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 ring-1 ring-amber-500/10 text-amber-400 text-sm cursor-move hover:bg-amber-500/20 hover:ring-amber-500/20 transition-all touch-none"
                        style={{
                          opacity: isDragging ? 0 : undefined,
                          pointerEvents: isDragging ? 'none' : undefined,
                        }}
                        title="Drag to calendar to schedule"
                      >
                        <svg
                          className="w-4 h-4 flex-shrink-0"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span className="font-medium truncate max-w-[200px]">{job.title}</span>
                        <span className="text-xs text-amber-400/60">({job.contactName})</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Calendar */}
            <div className="flex-1 min-h-0">
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
              />
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="h-full overflow-y-auto">
            <JobList />
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
                handlePermanentDeleteJob(job)
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
              onCreateClick={() => setShowServiceForm(true)}
            />
          </div>
        )}
      </div>

      {/* Job Form Modal */}
      <Modal
        isOpen={showJobForm}
        onClose={() => {
          setShowJobForm(false)
          setEditingJob(null)
          clearJobsError()
        }}
        title={
          editingJob?.toBeScheduled ? 'Schedule Job' : editingJob ? 'Edit Job' : 'Schedule New Job'
        }
        size="xl"
      >
        <JobForm
          job={editingJob || undefined}
          onSubmit={editingJob ? handleUpdateJob : handleCreateJob}
          onCancel={() => {
            setShowJobForm(false)
            setEditingJob(null)
            clearJobsError()
          }}
          isLoading={jobsLoading}
          error={jobsError}
          schedulingUnscheduledJob={editingJob?.toBeScheduled}
        />
      </Modal>

      {/* Job Detail Modal */}
      {selectedJob && (
        <JobDetail
          job={selectedJob}
          isOpen={showJobDetail}
          onClose={() => {
            setSelectedJob(null)
            setShowJobDetail(false)
          }}
          onEdit={handleEditJob}
          onDelete={handleDeleteJob}
          onPermanentDelete={() => handlePermanentDeleteJob()}
          onRestore={handleRestoreJob}
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
        onSuccess={() => {
          setSelectedJob(null)
          setShowJobDetail(false)
        }}
      />

      {/* Decline Job Modal */}
      <Modal
        isOpen={showDeclineModal}
        onClose={() => {
          setShowDeclineModal(false)
          setDeclineReason('')
        }}
        title="Decline Booking"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-primary-light/70">
            Are you sure you want to decline this booking? The client will be notified via email.
          </p>
          <div>
            <label className="block text-sm font-medium text-primary-light mb-2">
              Reason (Optional)
            </label>
            <textarea
              value={declineReason}
              onChange={e => setDeclineReason(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold"
              placeholder="Let the client know why you can't accommodate this booking..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                setShowDeclineModal(false)
                setDeclineReason('')
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleDeclineJob} className="bg-red-600 hover:bg-red-700 text-white">
              Decline Booking
            </Button>
          </div>
        </div>
      </Modal>

      {/* Service Detail Modal */}
      {selectedService && (
        <ServiceDetail
          service={selectedService}
          isOpen={showServiceDetail}
          onClose={() => {
            setShowServiceDetail(false)
            setSelectedService(null)
          }}
          onEdit={() => {
            setShowServiceDetail(false)
            setShowServiceForm(true)
          }}
          onDelete={handleDeleteService}
          onGetLink={handleGetBookingLink}
        />
      )}

      {/* Service Form Modal */}
      <Modal
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
        />
      </Modal>

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
        <ConfirmationDialog
          isOpen={showPermanentDeleteConfirm}
          onClose={() => setShowPermanentDeleteConfirm(false)}
          onConfirm={handleConfirmPermanentDelete}
          title="⚠️ Permanently Delete Job?"
          message={
            <div className="space-y-3">
              <p className="text-primary-light">
                Are you sure you want to <strong className="text-red-400">PERMANENTLY</strong>{' '}
                delete this job?
              </p>
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-sm text-red-400 font-semibold mb-1">
                  ⚠️ This action cannot be undone!
                </p>
                <p className="text-sm text-primary-light/70">
                  The job will be removed from the database
                  {selectedJob.archivedAt ? ' and S3 archive' : ''}.
                </p>
              </div>
              <div className="bg-primary-blue/10 border border-primary-blue rounded-lg p-3">
                <p className="text-sm text-primary-light/70">
                  <strong className="text-primary-light">Job:</strong> {selectedJob.title}
                </p>
              </div>
            </div>
          }
          confirmText="Delete Permanently"
          confirmVariant="danger"
        />
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
      <Modal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false)
          setBookingLink('')
        }}
        title="Booking Link"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-primary-light/70">
            Share this link with clients so they can view all your services and book appointments:
          </p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={bookingLink}
              readOnly
              className="flex-1 rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light"
            />
            <Button
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
                  <svg
                    className="w-4 h-4 animate-scale-in"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  <span>Copied</span>
                </span>
              ) : (
                'Copy'
              )}
            </Button>
          </div>
          <p className="text-xs text-primary-light/60">
            Clients can select a time and book without logging in.
          </p>
        </div>
      </Modal>
    </div>
  )
}

export default SchedulingPage
