import { useState, useMemo, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { cn, getMapsHref } from '@/lib/utils'
import { useAuthStore } from '@/features/auth'
import { services } from '@/lib/api/services'
import type { JobLog, JobAssignment } from '../types/jobLog'
import { getRecurringTag } from '../utils/recurringPattern'
import JobLogForm from './JobLogForm'
import TimeTracker from './TimeTracker'
import PhotoCapture from './PhotoCapture'
import JobLogNotes from './JobLogNotes'
import ConvertQuoteToInvoiceModal from '@/features/quotes/components/ConvertQuoteToInvoiceModal'
import QuoteDetail from '@/features/quotes/components/QuoteDetail'
import InvoiceDetail from '@/features/invoices/components/InvoiceDetail'
import { useJobLogStore } from '../store/jobLogStore'
import { useInvoiceStore } from '@/features/invoices/store/invoiceStore'
import { useQuoteStore } from '@/features/quotes/store/quoteStore'
import {
  Alert,
  AlertIcon,
  AppButton,
  AppModal,
  ChevronLeftIcon,
  CheckIcon,
  PlayIcon,
  StopIcon,
  SelectField,
  StatusBadge,
  StatusSelect,
  TagChip,
  linkCls,
} from './jobLogsUi'
import { JOB_STATUS, JOB_STATUS_OPTIONS, type JobLogStatus } from './jobLogStatus'

const TIMER_STORAGE_PREFIX = 'joblog-active-timer'
const getTimerStorageKey = (userId: string | undefined): string | null =>
  userId ? `${TIMER_STORAGE_PREFIX}-${userId}` : null

interface JobLogDetailProps {
  jobLog: JobLog
  onBack: () => void
  onEdit: () => void
  /** Calendar-style soft archive (booking or job removal when unscheduled) */
  onArchiveRequest: () => void
  /** Permanent removal (booking when present, else full job delete) */
  onPermanentDeleteRequest: () => void
  isEditing: boolean
  onCancelEdit: () => void
  onSaveEdit: (data: {
    title: string
    description?: string
    location?: string
    notes?: string
    jobId?: string
    contactId?: string
    assignedTo?: JobAssignment[]
    status?: string
  }) => Promise<void>
  onStatusChange?: (status: 'active' | 'completed' | 'inactive') => Promise<void>
  isLoading?: boolean
  onTogglePin?: () => void | Promise<void>
  pinSaving?: boolean
  onQuoteSent?: (message: string) => void
  onInvoiceSent?: (message: string) => void
}

type Tab = 'clock' | 'photos' | 'notes'

const resolveStatus = (status?: string): JobLogStatus => {
  if (status === 'archived') return 'inactive'
  if (status === 'completed' || status === 'inactive') return status
  return 'active'
}

const JobLogDetail = ({
  jobLog,
  onBack,
  onEdit,
  onArchiveRequest,
  onPermanentDeleteRequest,
  isEditing,
  onCancelEdit,
  onSaveEdit,
  onStatusChange,
  isLoading,
  onTogglePin,
  pinSaving,
  onQuoteSent,
  onInvoiceSent,
}: JobLogDetailProps) => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { createTimeEntry, getJobLogById } = useJobLogStore()
  const { convertQuoteToInvoice, setSelectedInvoice } = useInvoiceStore()
  const { deleteQuote } = useQuoteStore()
  const [showConvertModal, setShowConvertModal] = useState(false)
  const [quoteForConvert, setQuoteForConvert] = useState<
    import('@/features/quotes/types/quote').Quote | null
  >(null)
  const [quoteForDetail, setQuoteForDetail] = useState<
    import('@/features/quotes/types/quote').Quote | null
  >(null)
  const [invoiceForDetail, setInvoiceForDetail] = useState<
    import('@/features/invoices/types/invoice').Invoice | null
  >(null)
  const [isConverting, setIsConverting] = useState(false)

  const linkedQuoteId =
    jobLog.quoteId ??
    (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.quoteId : null)
  const linkedInvoiceId =
    jobLog.invoiceId ??
    (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.invoiceId : null)
  const [activeTab, setActiveTab] = useState<Tab>('notes')
  const [showMenu, setShowMenu] = useState(false)
  const [showDeleteMenu, setShowDeleteMenu] = useState(false)
  const isAdminOrOwner = user?.role === 'admin' || user?.role === 'owner'
  const canAccessQuotes = user?.role !== 'employee'
  const canEditJobs =
    user?.role === 'admin' ||
    user?.role === 'owner' ||
    user?.canCreateJobs ||
    user?.canScheduleAppointments

  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([])
  const [teamMembersLoading, setTeamMembersLoading] = useState(false)
  const [jobRoles, setJobRoles] = useState<
    Array<{ id: string; title: string; permissions?: { canClockInFor?: string } }>
  >([])
  const [showClockInSelector, setShowClockInSelector] = useState(false)
  const [selectedClockInUserId, setSelectedClockInUserId] = useState<string | null>(
    user?.id || null
  )

  const timerStorageKey = getTimerStorageKey(user?.id)

  // Timer state management
  const [isTimerRunning, setIsTimerRunning] = useState(() => {
    if (!timerStorageKey) return false
    try {
      const stored = localStorage.getItem(timerStorageKey)
      if (!stored) return false
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLog.id && !!startTime
    } catch {
      return false
    }
  })
  const [timerStart, setTimerStart] = useState<Date | null>(() => {
    if (!timerStorageKey) return null
    try {
      const stored = localStorage.getItem(timerStorageKey)
      if (!stored) return null
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLog.id && startTime ? new Date(startTime) : null
    } catch {
      return null
    }
  })
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [clockOutError, setClockOutError] = useState<string | null>(null)
  const [conflictingTimer, setConflictingTimer] = useState<{
    jobLogId: string
    jobLogTitle: string
    startTime: string
    storedUserId?: string
    next: { type: 'single'; userId?: string }
  } | null>(null)
  const [conflictError, setConflictError] = useState<string | null>(null)

  const extractErrorMessage = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data
      ?.message ||
    (e as { message?: string })?.message ||
    fallback

  const detectConflictingTimer = () => {
    if (!timerStorageKey) return null
    try {
      const stored = localStorage.getItem(timerStorageKey)
      if (!stored) return null
      const parsed = JSON.parse(stored)
      if (!parsed?.jobLogId || parsed.jobLogId === jobLog.id || !parsed.startTime) return null
      return {
        jobLogId: parsed.jobLogId as string,
        jobLogTitle: (parsed.jobLogTitle as string | undefined) || 'another job',
        startTime: parsed.startTime as string,
        storedUserId: (parsed.userId as string | null | undefined) ?? undefined,
      }
    } catch {
      return null
    }
  }

  const fetchConflictTitleIfMissing = (info: ReturnType<typeof detectConflictingTimer>) => {
    if (!info || info.jobLogTitle !== 'another job') return
    services.jobLogs
      .getById(info.jobLogId)
      .then(jl => {
        const title = (jl as { title?: string } | null)?.title
        if (!title) return
        setConflictingTimer(prev =>
          prev && prev.jobLogId === info.jobLogId ? { ...prev, jobLogTitle: title } : prev
        )
      })
      .catch(() => {
        /* keep the generic label */
      })
  }

  // Timer tick effect
  const tick = useCallback(() => {
    if (timerStart) {
      setElapsedSeconds(Math.floor((Date.now() - timerStart.getTime()) / 1000))
    }
  }, [timerStart])

  useEffect(() => {
    if (!isTimerRunning || !timerStart) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [isTimerRunning, timerStart, tick])

  const formatElapsed = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const startSingleTimerLocal = (userId?: string) => {
    const targetUserId = userId || user?.id
    const start = new Date()
    setTimerStart(start)
    setIsTimerRunning(true)
    if (!timerStorageKey) return
    try {
      localStorage.setItem(
        timerStorageKey,
        JSON.stringify({
          jobLogId: jobLog.id,
          jobLogTitle: jobLog.title,
          startTime: start.toISOString(),
          userId: targetUserId,
        })
      )
    } catch {
      // ignore
    }
  }

  const handleStartTimer = (userId?: string) => {
    setClockOutError(null)
    // Don't overwrite if timer is already running for THIS job - preserve the existing userId
    if (isTimerRunning) {
      return
    }
    // If a timer is running on a DIFFERENT job, prompt the user before overwriting
    // localStorage (otherwise the prior session's start time is lost and the entry
    // is never saved — the root cause behind missing-entry reports).
    const conflict = detectConflictingTimer()
    if (conflict) {
      setConflictError(null)
      setConflictingTimer({ ...conflict, next: { type: 'single', userId } })
      fetchConflictTitleIfMissing(conflict)
      return
    }
    startSingleTimerLocal(userId)
  }

  useEffect(() => {
    const role = user?.role
    // Employees generally can't list all users; don't try to load for them
    if (!role || role === 'employee') return

    const loadTeamMembers = async () => {
      setTeamMembersLoading(true)
      try {
        const usersData = await services.users.getAll()
        setTeamMembers(
          (usersData || []).map((m: { id: string; name: string; email?: string }) => ({
            id: m.id,
            name: m.name || m.email || 'Unknown',
          }))
        )
      } catch {
        // ignore (we can still start timer for self)
      } finally {
        setTeamMembersLoading(false)
      }
    }

    loadTeamMembers()
  }, [user?.role])

  // Load job roles for permission check (employees need this to know if they can clock in for others)
  useEffect(() => {
    const loadJobRoles = async () => {
      try {
        const roles = await services.jobRoles.getAll()
        setJobRoles(roles || [])
      } catch {
        // ignore
      }
    }
    loadJobRoles()
  }, [])

  // Parse assignments early so it can be used in other hooks
  const parsedAssignments = useMemo((): JobAssignment[] => {
    if (!jobLog.assignedTo) return []
    if (Array.isArray(jobLog.assignedTo)) {
      if (
        jobLog.assignedTo.length > 0 &&
        typeof jobLog.assignedTo[0] === 'object' &&
        'userId' in jobLog.assignedTo[0]
      ) {
        return jobLog.assignedTo as JobAssignment[]
      }
      return (jobLog.assignedTo as string[]).map(id => ({
        userId: id,
        role: 'Team Member',
        price: null,
        payType: 'job' as const,
        hourlyRate: null,
      }))
    }
    return [
      {
        userId: jobLog.assignedTo as string,
        role: 'Team Member',
        price: null,
        payType: 'job' as const,
        hourlyRate: null,
      },
    ]
  }, [jobLog.assignedTo])

  const currentUserClockInFor = useMemo((): 'self' | 'assigned' | 'everyone' => {
    const currentUserId = user?.id
    if (!currentUserId) return 'self'

    // Admins/owners always have full clock-in permissions regardless of role assignment
    if (isAdminOrOwner) return 'everyone'

    const currentAssignment = parsedAssignments.find(a => a.userId === currentUserId)
    if (!currentAssignment) return 'self'

    // Prefer matching by roleId; fall back to matching by role title for legacy jobs.
    const normalizeRoleTitle = (s: string) => s.trim().toLowerCase()
    const matchedRole =
      (currentAssignment.roleId && jobRoles.find(r => r.id === currentAssignment.roleId)) ||
      (currentAssignment.role &&
        jobRoles.find(
          r => normalizeRoleTitle(r.title) === normalizeRoleTitle(currentAssignment.role)
        )) ||
      null

    // If roles haven't loaded yet but the user has a non-default role title, allow UI; backend enforces real permissions.
    if (!matchedRole) {
      return currentAssignment.role && currentAssignment.role !== 'Team Member'
        ? 'assigned'
        : 'self'
    }

    const canClockInFor = matchedRole.permissions?.canClockInFor || 'self'
    return canClockInFor === 'everyone'
      ? 'everyone'
      : canClockInFor === 'assigned'
        ? 'assigned'
        : 'self'
  }, [parsedAssignments, user?.id, jobRoles, isAdminOrOwner])

  const canClockInForOthers = currentUserClockInFor !== 'self'

  const availableUsersToClockIn = useMemo(() => {
    const currentUserId = user?.id
    if (!currentUserId) return []
    const assignedIds = new Set(parsedAssignments.map(a => a.userId))
    const assignedUsers = jobLog.assignedToUsers || []

    // Self-only: only allow self
    if (currentUserClockInFor === 'self') {
      const self = assignedUsers.find(u => u.id === currentUserId) ||
        teamMembers.find(u => u.id === currentUserId) || {
          id: currentUserId,
          name: user?.name || 'You',
        }
      return [self]
    }

    // Everyone: even with 'everyone' permission, only show assigned team members
    if (currentUserClockInFor === 'everyone') {
      if (assignedUsers.length > 0) {
        return assignedUsers.filter(u => assignedIds.has(u.id))
      }
      // Fallback: filter teamMembers to only assigned users
      return teamMembers.filter(m => assignedIds.has(m.id))
    }

    // Assigned: show assigned users only
    if (assignedUsers.length > 0) {
      return assignedUsers.filter(u => assignedIds.has(u.id))
    }
    return teamMembers.filter(m => assignedIds.has(m.id))
  }, [
    teamMembers,
    parsedAssignments,
    user?.id,
    user?.name,
    jobLog.assignedToUsers,
    currentUserClockInFor,
  ])

  const handleHeaderStartJobClick = () => {
    // Make sure the user lands on the Clock tab where the rest of the time tools live
    setActiveTab('clock')

    // Show the selector only when the user can clock in OTHERS and there's
    // more than one person to choose from. Otherwise just start for self.
    if (canClockInForOthers && (teamMembersLoading || availableUsersToClockIn.length > 1)) {
      setSelectedClockInUserId(user?.id || null)
      setShowClockInSelector(true)
      return
    }

    handleStartTimer()
  }

  const doStartJobForSelected = async () => {
    const targetUserId =
      selectedClockInUserId && selectedClockInUserId.length > 0 ? selectedClockInUserId : user?.id

    if (targetUserId) {
      startSingleTimerLocal(targetUserId)
      setSelectedClockInUserId(targetUserId)
    } else {
      startSingleTimerLocal(user?.id)
      setSelectedClockInUserId(user?.id || null)
    }

    setShowClockInSelector(false)
    // Don't reset selectedClockInUserId here - keep it until timer stops
  }

  const handleStartJobForSelected = async () => {
    setClockOutError(null)
    if (isTimerRunning) {
      // Already running for this job; selector shouldn't be reachable but be defensive
      setShowClockInSelector(false)
      return
    }
    const conflict = detectConflictingTimer()
    if (conflict) {
      setShowClockInSelector(false)
      setConflictError(null)
      const nextUserId =
        selectedClockInUserId && selectedClockInUserId.length > 0
          ? selectedClockInUserId
          : user?.id
      setConflictingTimer({ ...conflict, next: { type: 'single', userId: nextUserId } })
      fetchConflictTitleIfMissing(conflict)
      return
    }
    await doStartJobForSelected()
  }

  const handleConfirmConflict = async () => {
    if (!conflictingTimer) return
    setConflictError(null)
    try {
      if (conflictingTimer.storedUserId) {
        await createTimeEntry({
          jobLogId: conflictingTimer.jobLogId,
          startTime: conflictingTimer.startTime,
          endTime: new Date().toISOString(),
          userId: conflictingTimer.storedUserId,
        })
      }
      // If no stored user: nothing actionable to save (defensive). Fall through and clear.
    } catch (e) {
      console.error('Failed to save prior timer before starting new one:', e)
      setConflictError(
        extractErrorMessage(
          e,
          'Failed to save the previous timer. The new timer was not started.'
        )
      )
      return
    }
    const next = conflictingTimer.next
    setConflictingTimer(null)
    if (timerStorageKey) {
      try {
        localStorage.removeItem(timerStorageKey)
      } catch {
        // ignore
      }
    }
    startSingleTimerLocal(next.userId)
  }

  const handleCancelConflict = () => {
    setConflictingTimer(null)
    setConflictError(null)
  }

  const handleStopTimer = async () => {
    setClockOutError(null)
    let startTime: string
    let storedUserId: string | undefined
    try {
      const stored = timerStorageKey ? localStorage.getItem(timerStorageKey) : null
      if (stored) {
        const parsed = JSON.parse(stored)
        const { jobLogId: storedId, startTime: storedStart, userId: storedUser } = parsed
        if (storedId === jobLog.id && storedStart) {
          startTime = storedStart
          storedUserId = storedUser
        } else if (timerStart) {
          startTime = timerStart.toISOString()
        } else {
          setClockOutError(
            'No active timer found for this job. The timer may have been started on a different job or device.'
          )
          return
        }
      } else if (timerStart) {
        startTime = timerStart.toISOString()
      } else {
        setClockOutError('No active timer found. Nothing to save.')
        return
      }
    } catch {
      if (!timerStart) {
        setClockOutError('Could not read timer state. Nothing to save.')
        return
      }
      startTime = timerStart.toISOString()
    }
    const end = new Date()
    const targetUserId = storedUserId || selectedClockInUserId || user?.id

    try {
      if (targetUserId) {
        await createTimeEntry({
          jobLogId: jobLog.id,
          startTime,
          endTime: end.toISOString(),
          userId: targetUserId,
        })
      } else {
        console.warn('handleStopTimer - No valid userId to create time entry for')
      }
      // Success: clear timer state and localStorage
      setIsTimerRunning(false)
      setTimerStart(null)
      setElapsedSeconds(0)
      setSelectedClockInUserId(user?.id || null)
      if (timerStorageKey) {
        try {
          localStorage.removeItem(timerStorageKey)
        } catch {
          // ignore
        }
      }
    } catch (e) {
      // Failure: keep timer state and localStorage intact so the user can retry.
      // Previously this was a try/finally that wiped state on error, silently losing entries.
      console.error('Clock-out save failed:', e)
      setClockOutError(
        extractErrorMessage(
          e,
          'Failed to save time entry. Your timer is still running — please try again.'
        )
      )
    }
  }

  const handleDiscardTimer = () => {
    setIsTimerRunning(false)
    setTimerStart(null)
    setElapsedSeconds(0)
    setSelectedClockInUserId(user?.id || null)
    setClockOutError(null)
    if (timerStorageKey) {
      try {
        localStorage.removeItem(timerStorageKey)
      } catch {
        // ignore
      }
    }
  }

  const handleMarkCompleted = async () => {
    if (onStatusChange) {
      await onStatusChange('completed')
    }
  }

  const isCompleted = jobLog.status === 'completed' || String(jobLog.status) === 'archived'

  const handleViewQuote = async () => {
    setShowMenu(false)
    if (!linkedQuoteId) return
    try {
      const quote = await services.quotes.getById(linkedQuoteId)
      setQuoteForDetail(quote)
    } catch {
      // Fall back to create if fetch fails
      handleCreateQuote()
    }
  }

  const handleViewInvoice = async () => {
    setShowMenu(false)
    if (!linkedInvoiceId) return
    try {
      const invoice = await services.invoices.getById(linkedInvoiceId)
      setInvoiceForDetail(invoice)
    } catch {
      // Fall back to create invoice if fetch fails
      navigateToCreateInvoice()
    }
  }

  const handleCreateQuote = () => {
    setShowMenu(false)
    const params = new URLSearchParams()
    params.set('returnTo', '/app/job-logs/' + jobLog.id)
    params.set('openCreateQuote', '1')
    params.set('jobId', jobLog.id)
    if (jobLog.contactId) params.set('contactId', jobLog.contactId)
    if (jobLog.title) params.set('title', encodeURIComponent(jobLog.title))
    if (jobLog.notes) params.set('notes', encodeURIComponent(jobLog.notes))
    const price =
      jobLog.price ??
      jobLog.job?.price ??
      (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.price : null)
    if (price != null) params.set('price', String(price))
    navigate('/app/quotes?' + params.toString())
  }

  const handleConvertToInvoice = async () => {
    setShowMenu(false)
    // When job has linked invoice, show invoice detail instead
    if (linkedInvoiceId) {
      await handleViewInvoice()
      return
    }
    const quoteId =
      jobLog.quoteId ??
      (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.quoteId : null)
    if (quoteId) {
      try {
        const quote = await services.quotes.getById(quoteId)
        setQuoteForConvert(quote)
        setShowConvertModal(true)
      } catch {
        // Quote not found - fall through to create new invoice
        navigateToCreateInvoice()
      }
    } else {
      navigateToCreateInvoice()
    }
  }

  const navigateToCreateInvoice = () => {
    const params = new URLSearchParams()
    const linkableJobId = jobLog.jobId || jobLog.job?.id || jobLog.id
    params.set('returnTo', '/app/job-logs/' + jobLog.id)
    params.set('openCreateInvoice', '1')
    if (linkableJobId) params.set('jobId', linkableJobId)
    if (jobLog.contactId) params.set('contactId', jobLog.contactId)
    if (jobLog.title) params.set('title', encodeURIComponent(jobLog.title))
    if (jobLog.notes) params.set('notes', encodeURIComponent(jobLog.notes))
    const price =
      jobLog.price ??
      jobLog.job?.price ??
      (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.price : null)
    if (price != null) params.set('price', String(price))
    navigate('/app/invoices?' + params.toString())
  }

  const handleConvertQuoteToInvoice = async (options: {
    paymentTerms: string
    dueDate: string
  }) => {
    if (!quoteForConvert) return
    setIsConverting(true)
    try {
      const invoice = await convertQuoteToInvoice(quoteForConvert, options)
      const linkableJobId = jobLog.jobId || jobLog.job?.id || jobLog.id
      if (linkableJobId) {
        await services.jobs.update(linkableJobId, { invoiceId: invoice.id })
      }
      await deleteQuote(quoteForConvert.id)
      setShowConvertModal(false)
      setQuoteForConvert(null)
      setSelectedInvoice(invoice)
      navigate('/app/invoices')
      getJobLogById(jobLog.id)
    } catch {
      // Error handled by store
    } finally {
      setIsConverting(false)
    }
  }

  const handleScheduleAppointment = () => {
    setShowMenu(false)
    const params = new URLSearchParams()
    params.set('tab', 'calendar')
    params.set('returnTo', '/app/job-logs/' + jobLog.id)
    params.set('openCreateJob', '1')
    // Pass the job ID so it can be pre-selected when linking to existing job
    const linkableJobId = jobLog.jobId || jobLog.job?.id || jobLog.id
    if (linkableJobId) params.set('linkJobId', linkableJobId)
    if (jobLog.contactId) params.set('contactId', jobLog.contactId)
    if (jobLog.title) params.set('title', encodeURIComponent(jobLog.title))
    if (jobLog.notes) params.set('notes', encodeURIComponent(jobLog.notes))
    if (jobLog.location) params.set('location', encodeURIComponent(jobLog.location))
    if (jobLog.description) params.set('description', encodeURIComponent(jobLog.description))
    if (jobLog.price != null) params.set('price', jobLog.price.toString())
    if (jobLog.serviceId) params.set('serviceId', jobLog.serviceId)
    // Pass assignedTo as JSON
    if (jobLog.assignedTo) {
      const assignedToArray = Array.isArray(jobLog.assignedTo)
        ? jobLog.assignedTo
        : typeof jobLog.assignedTo === 'string'
          ? [
              {
                userId: jobLog.assignedTo,
                role: 'Team Member',
                price: null,
                payType: 'job' as const,
                hourlyRate: null,
              },
            ]
          : []
      // Normalize to ensure it's in the correct format
      const normalized = assignedToArray.map((item: JobAssignment | string) => {
        if (typeof item === 'object' && item !== null && 'userId' in item) {
          return {
            userId: item.userId,
            roleId: item.roleId || undefined,
            role: item.role || 'Team Member',
            price: item.price != null ? item.price : null,
            payType: item.payType || 'job',
            hourlyRate: item.hourlyRate != null ? item.hourlyRate : null,
          }
        }
        return {
          userId: item,
          role: 'Team Member',
          price: null,
          payType: 'job' as const,
          hourlyRate: null,
        }
      })
      if (normalized.length > 0) {
        params.set('assignedTo', encodeURIComponent(JSON.stringify(normalized)))
      }
    }
    navigate('/app/scheduling?' + params.toString())
  }

  if (isEditing) {
    return (
      <div className="mx-auto max-w-[95vw] sm:max-w-[90vw] md:max-w-6xl lg:max-w-7xl">
        <div className="rounded-xl bg-surface p-6 shadow-card">
          <h3 className="mb-4 text-lg font-semibold tracking-tight text-ink">Edit job</h3>
          <JobLogForm
            jobLog={jobLog}
            onSubmit={onSaveEdit}
            onCancel={onCancelEdit}
            isLoading={isLoading}
          />
        </div>
      </div>
    )
  }

  const hasOverview = jobLog.location || jobLog.contact
  const canSeePrices = isAdminOrOwner || (user?.canSeeJobPrices ?? true)
  const primaryPrice = canSeePrices
    ? (jobLog.price ??
      jobLog.job?.price ??
      (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.price : null) ??
      null)
    : null
  const primaryServiceName =
    jobLog.serviceName ??
    jobLog.job?.serviceName ??
    (jobLog.bookings && jobLog.bookings.length > 0 ? jobLog.bookings[0]?.service?.name : null) ??
    null
  const primaryStartTime = jobLog.startTime ?? jobLog.job?.startTime ?? null
  const primaryEndTime = jobLog.endTime ?? jobLog.job?.endTime ?? null

  return (
    <div className="space-y-6 w-full min-w-0">
      {/* Top bar: back left, menu right on mobile */}
      <div className="flex items-center justify-between gap-2 sm:justify-start">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ChevronLeftIcon className="h-4 w-4 shrink-0" />
          Jobs
        </button>
        {/* Mobile: three-dot menu in top right */}
        <div className="relative ml-auto sm:hidden">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="rounded-lg p-2 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Actions"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 12m-2 0a2 2 0 1 1 4 0a2 2 0 1 1-4 0M12 12m-2 0a2 2 0 1 1 4 0a2 2 0 1 1-4 0M18 12m-2 0a2 2 0 1 1 4 0a2 2 0 1 1-4 0" />
            </svg>
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line">
                {canAccessQuotes && (
                  <>
                    <button
                      onClick={linkedQuoteId ? handleViewQuote : handleCreateQuote}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                    >
                      {linkedQuoteId ? 'View quote' : 'Create quote'}
                    </button>
                    <button
                      onClick={linkedInvoiceId ? handleViewInvoice : handleConvertToInvoice}
                      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                    >
                      {linkedInvoiceId ? 'View invoice' : 'Convert to invoice'}
                    </button>
                  </>
                )}
                <button
                  onClick={handleScheduleAppointment}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                >
                  Schedule job
                </button>
                {canEditJobs && (
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onEdit()
                    }}
                    className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onArchiveRequest()
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                >
                  Archive
                </button>
                <button
                  onClick={() => {
                    setShowMenu(false)
                    onPermanentDeleteRequest()
                  }}
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  Delete permanently
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Header content - title, status, assigned to, and desktop buttons */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-start gap-x-3 gap-y-0">
            <h1 className="min-w-0 break-words text-2xl font-bold leading-tight tracking-tight text-ink">
              {jobLog.title}
            </h1>
            {onTogglePin ? (
              <button
                type="button"
                onClick={() => void onTogglePin()}
                disabled={pinSaving || isLoading}
                title={jobLog.pinnedAt ? 'Unpin from dashboard' : 'Pin to dashboard'}
                aria-label={jobLog.pinnedAt ? 'Unpin from dashboard' : 'Pin to dashboard'}
                className={cn(
                  'mt-0 inline-flex shrink-0 rounded-md p-0.5 transition-opacity hover:opacity-90 disabled:opacity-50 sm:mt-0.5',
                  !jobLog.pinnedAt && 'opacity-85'
                )}
              >
                <img
                  src={jobLog.pinnedAt ? '/tack-filled.png' : '/tack.png'}
                  alt=""
                  width={24}
                  height={24}
                  className="pointer-events-none h-6 w-6 rotate-45 object-contain"
                  draggable={false}
                />
              </button>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {onStatusChange ? (
              <StatusSelect
                value={resolveStatus(jobLog.status)}
                options={JOB_STATUS_OPTIONS}
                onChange={async v => {
                  await onStatusChange(v as 'active' | 'completed' | 'inactive')
                }}
                isLoading={isLoading}
              />
            ) : (
              (() => {
                const s = JOB_STATUS[resolveStatus(jobLog.status)]
                return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
              })()
            )}
            <span className="shrink-0 font-mono text-sm tabular-nums text-ink-subtle">
              {format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
            </span>
          </div>
          {jobLog.assignedToName && (
            <div className="flex flex-col gap-2 mt-2">
              {jobLog.assignedToName &&
                (() => {
                  const getTotalEarnedForUser = (
                    userId: string,
                    assignmentHourlyRate: number | null | undefined
                  ): number | null => {
                    const entries = (jobLog.timeEntries ?? []).filter(te => te.userId === userId)
                    if (entries.length === 0) return null
                    let total = 0
                    for (const te of entries) {
                      const rate = te.hourlyRate ?? assignmentHourlyRate
                      if (rate == null || isNaN(rate)) continue
                      const start = new Date(te.startTime).getTime()
                      const end = new Date(te.endTime).getTime()
                      const breakMin = (te.breakMinutes ?? 0) * 60 * 1000
                      const hours = (end - start - breakMin) / 3600000
                      total += hours * rate
                    }
                    return total > 0 ? total : null
                  }

                  const assignments = parsedAssignments
                  const currentUserId = user?.id
                  const canSeePrices = isAdminOrOwner || (user?.canSeeJobPrices ?? true)

                  // If we have assignments with roles, show them with pricing
                  if (assignments.length > 0 && assignments[0].role) {
                    return (
                      <div>
                        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                          Assigned to
                        </span>
                        <div className="grid w-max max-w-md grid-cols-1 gap-2">
                          {assignments.map((assignment, index) => {
                            // Find name by matching userId (more reliable than index-based matching)
                            const assignedUser = jobLog.assignedToUsers?.find(
                              u => u.id === assignment.userId
                            )
                            const displayName =
                              assignedUser?.name ||
                              (() => {
                                // Fallback to index-based matching if assignedToUsers not available
                                const nameParts = jobLog.assignedToName?.split(',') || []
                                return nameParts[index]?.trim() || 'Unassigned'
                              })()
                            // Employees can always see their own assignment pay (hourly or job), even if canSeeJobPrices is false
                            const canSeePrice = isAdminOrOwner
                              ? canSeePrices
                              : assignment.userId === currentUserId
                            const payType = assignment.payType || 'job'
                            const price = canSeePrice ? assignment.price : undefined
                            const hourlyRate = canSeePrice ? assignment.hourlyRate : undefined
                            const totalEarned =
                              payType === 'hourly'
                                ? getTotalEarnedForUser(assignment.userId, hourlyRate ?? null)
                                : null

                            const hasJobPrice =
                              payType === 'job' && price !== null && price !== undefined
                            const hasHourlyRate =
                              payType === 'hourly' &&
                              hourlyRate !== null &&
                              hourlyRate !== undefined
                            const hasPayInfo = hasJobPrice || hasHourlyRate
                            return (
                              <div
                                key={assignment.userId || index}
                                className={cn(
                                  'flex w-full items-center rounded-xl border border-line bg-surface-2',
                                  hasPayInfo ? 'flex-row gap-3 px-3 py-2' : 'px-3 py-1.5'
                                )}
                              >
                                <div className="min-w-0 flex-shrink">
                                  <span className="font-medium text-ink">{displayName}</span>
                                  {assignment.role && assignment.role !== 'Team Member' && (
                                    <span className="ml-2 text-ink-muted">({assignment.role})</span>
                                  )}
                                </div>
                                {hasPayInfo && (
                                  <div className="flex flex-shrink-0 flex-col items-end gap-0.5">
                                    {hasJobPrice && (
                                      <span className="font-mono font-semibold tabular-nums text-accent-strong">
                                        $
                                        {price!.toLocaleString('en-US', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}
                                        /job
                                      </span>
                                    )}
                                    {hasHourlyRate && (
                                      <>
                                        <span className="font-mono font-semibold tabular-nums text-accent-strong">
                                          $
                                          {hourlyRate!.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })}
                                          /hr
                                        </span>
                                        {totalEarned != null && (
                                          <span className="font-mono text-xs tabular-nums text-ink-subtle">
                                            Earned: $
                                            {totalEarned.toLocaleString('en-US', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  // Fallback to simple name display for old format
                  return (
                    <div>
                      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                        Assigned to
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {jobLog.assignedToName.split(',').map((name, index) => (
                          <TagChip key={index}>{name.trim()}</TagChip>
                        ))}
                      </div>
                    </div>
                  )
                })()}
            </div>
          )}
        </div>

        {/* Mobile: Timer and Job Completed buttons - after header */}
        <div className="flex items-center gap-2 pt-2 sm:hidden">
          {!isTimerRunning ? (
            <>
              <AppButton onClick={handleHeaderStartJobClick} size="sm">
                <PlayIcon className="h-4 w-4" />
                Start job
              </AppButton>
              {!isCompleted && onStatusChange && (
                <AppButton
                  variant="subtle"
                  onClick={handleMarkCompleted}
                  size="sm"
                  disabled={isLoading}
                >
                  <CheckIcon className="h-4 w-4" />
                  Job complete
                </AppButton>
              )}
            </>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                <span className="font-mono text-lg tabular-nums text-ink">
                  {formatElapsed(elapsedSeconds)}
                </span>
              </div>
              <AppButton variant="danger" onClick={handleStopTimer} size="sm" className="shrink-0">
                <StopIcon className="h-4 w-4" />
                Stop timer
              </AppButton>
            </div>
          )}
        </div>

        {/* Desktop: inline buttons */}
        <div className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
          <div className="flex flex-wrap gap-2">
            {canAccessQuotes && (
              <>
                <AppButton
                  variant="subtle"
                  size="sm"
                  onClick={linkedQuoteId ? handleViewQuote : handleCreateQuote}
                >
                  {linkedQuoteId ? 'View quote' : 'Create quote'}
                </AppButton>
                <AppButton
                  variant="subtle"
                  size="sm"
                  onClick={linkedInvoiceId ? handleViewInvoice : handleConvertToInvoice}
                >
                  {linkedInvoiceId ? 'View invoice' : 'Convert to invoice'}
                </AppButton>
              </>
            )}
            <AppButton variant="subtle" size="sm" onClick={handleScheduleAppointment}>
              Schedule job
            </AppButton>
            {canEditJobs && (
              <AppButton variant="subtle" size="sm" onClick={onEdit}>
                Edit
              </AppButton>
            )}
            <div className="relative">
              <AppButton
                variant="dangerGhost"
                size="sm"
                onClick={() => setShowDeleteMenu(!showDeleteMenu)}
              >
                Delete
                <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </AppButton>
              {showDeleteMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowDeleteMenu(false)} />
                  <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteMenu(false)
                        onArchiveRequest()
                      }}
                      className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                    >
                      <svg
                        className="mt-0.5 h-5 w-5 flex-shrink-0 text-ink-subtle transition-colors group-hover:text-ink"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 8h14M5 8a2 2 0 110-4m14 4a2 2 0 100-4m-9 4v12m4-12v12"
                        />
                      </svg>
                      <div>
                        <div className="font-medium">Archive</div>
                        <div className="mt-0.5 text-xs text-ink-subtle">Can be restored later</div>
                      </div>
                    </button>
                    <div className="my-1 border-t border-line" />
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteMenu(false)
                        onPermanentDeleteRequest()
                      }}
                      className="group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
                    >
                      <svg
                        className="mt-0.5 h-5 w-5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                      <div>
                        <div className="font-medium">Delete permanently</div>
                        <div className="mt-0.5 text-xs text-danger/70">Cannot be undone</div>
                      </div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Desktop: Timer and Job Completed buttons - separate row, aligned right */}
          <div className="flex items-center gap-2">
            {!isTimerRunning ? (
              <>
                <AppButton onClick={handleHeaderStartJobClick} size="sm">
                  <PlayIcon className="h-4 w-4" />
                  Start job
                </AppButton>
                {!isCompleted && onStatusChange && (
                  <AppButton
                    variant="subtle"
                    onClick={handleMarkCompleted}
                    size="sm"
                    disabled={isLoading}
                  >
                    <CheckIcon className="h-4 w-4" />
                    Job complete
                  </AppButton>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-1.5">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" />
                  <span className="font-mono text-lg tabular-nums text-ink">
                    {formatElapsed(elapsedSeconds)}
                  </span>
                </div>
                <AppButton variant="danger" onClick={handleStopTimer} size="sm">
                  <StopIcon className="h-4 w-4" />
                  Stop timer
                </AppButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Bookings */}
      {jobLog.bookings &&
        jobLog.bookings.length > 0 &&
        (() => {
          const sortedBookings = jobLog.bookings
            .filter(b => b.status !== 'cancelled')
            .sort((a, b) => {
              const aTime = a.startTime ? new Date(a.startTime).getTime() : 0
              const bTime = b.startTime ? new Date(b.startTime).getTime() : 0
              return aTime - bTime
            })

          // Get the next upcoming booking
          const nextBooking =
            sortedBookings.find(b => {
              if (b.toBeScheduled) return false
              if (!b.startTime) return false
              const bookingDate = new Date(b.startTime)
              return bookingDate >= new Date()
            }) || sortedBookings[0]

          if (!nextBooking) return null

          // Check if bookings follow a recurring pattern
          const recurringTag = getRecurringTag(sortedBookings)

          return (
            <div className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Upcoming bookings
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {nextBooking.toBeScheduled ? (
                        <span className="text-sm text-ink-muted">To be scheduled</span>
                      ) : nextBooking.startTime && nextBooking.endTime ? (
                        <span className="font-mono text-sm tabular-nums text-ink">
                          {format(new Date(nextBooking.startTime), 'MMM d, yyyy • h:mm a')} –{' '}
                          {format(new Date(nextBooking.endTime), 'h:mm a')}
                        </span>
                      ) : (
                        <span className="text-sm text-ink-muted">No time set</span>
                      )}
                      {recurringTag && <TagChip>{recurringTag}</TagChip>}
                    </div>
                    {nextBooking.service?.name && (
                      <p className="mt-0.5 text-xs text-ink-subtle">{nextBooking.service.name}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {canSeePrices &&
                      nextBooking.price != null &&
                      nextBooking.price !== undefined && (
                        <span className="font-mono text-sm font-semibold tabular-nums text-accent-strong">
                          $
                          {nextBooking.price.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

      {/* Overview: contact, location, and price */}
      {(hasOverview ||
        !!jobLog.description ||
        primaryPrice != null ||
        !!primaryServiceName ||
        (!!primaryStartTime && !!primaryEndTime)) && (
        <dl className="space-y-3 border-t border-line pt-6">
          {jobLog.description && (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Description
              </dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {jobLog.description}
              </dd>
            </div>
          )}
          {primaryServiceName && (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Service
              </dt>
              <dd className="mt-1 text-sm text-ink">{primaryServiceName}</dd>
            </div>
          )}
          {primaryStartTime && primaryEndTime && (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Scheduled
              </dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-ink">
                {(() => {
                  const start = new Date(primaryStartTime)
                  const end = new Date(primaryEndTime)
                  const isMultiDay = end.getTime() - start.getTime() >= 24 * 60 * 60 * 1000

                  if (isMultiDay) {
                    // Multi-day job: show date range
                    return `${format(start, 'MMM d, yyyy')} – ${format(end, 'MMM d, yyyy')}`
                  } else {
                    // Same day: show date with times
                    return `${format(start, 'MMM d, yyyy • h:mm a')} – ${format(end, 'h:mm a')}`
                  }
                })()}
              </dd>
            </div>
          )}
          {jobLog.location && (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Location
              </dt>
              <dd className="mt-1 text-sm text-ink">
                <a
                  href={getMapsHref(jobLog.location)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkCls}
                >
                  {jobLog.location}
                </a>
              </dd>
            </div>
          )}
          {jobLog.contact && (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Contact
              </dt>
              <dd className="mt-1 text-sm text-ink">
                {jobLog.contact.name}
                {jobLog.contact.email && (
                  <span className="text-ink-muted"> · {jobLog.contact.email}</span>
                )}
                {jobLog.contact.phone?.trim() && (
                  <span className="text-ink-muted">
                    {' '}
                    ·{' '}
                    <a
                      href={`tel:${jobLog.contact.phone.replace(/\s/g, '')}`}
                      className={cn(linkCls, 'font-mono tabular-nums')}
                    >
                      {jobLog.contact.phone.trim()}
                    </a>
                  </span>
                )}
              </dd>
            </div>
          )}
          {primaryPrice != null && (
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                Price
              </dt>
              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-accent-strong">
                $
                {primaryPrice.toLocaleString('en-US', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          )}
        </dl>
      )}

      {/* Tabbed tools: Notes | Clock | Photos */}
      <div className="pt-4">
        <div className="mb-4 flex items-center gap-1 border-b border-line">
          {(['notes', 'clock', 'photos'] as const).map(tab => {
            const active = activeTab === tab
            const labels: Record<Tab, string> = { notes: 'Notes', clock: 'Clock', photos: 'Photos' }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  '-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none',
                  active
                    ? 'border-accent-strong text-accent-strong'
                    : 'border-transparent text-ink-muted hover:text-ink'
                )}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        {activeTab === 'clock' && (
          <>
            {clockOutError && (
              <div className="mb-3">
                <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1">{clockOutError}</span>
                    {isTimerRunning && (
                      <button
                        type="button"
                        onClick={handleDiscardTimer}
                        className="font-medium underline hover:no-underline"
                      >
                        Discard timer
                      </button>
                    )}
                  </div>
                </Alert>
              </div>
            )}
            <TimeTracker
              jobLogId={jobLog.id}
              jobLogTitle={jobLog.title}
              timeEntries={jobLog.timeEntries ?? []}
              isAdmin={user?.role === 'admin' || user?.role === 'owner'}
              currentUserId={user?.id}
              assignedTo={parsedAssignments}
              assignedToUsers={jobLog.assignedToUsers}
              clockInFor={currentUserClockInFor}
              externalTimerState={{
                isRunning: isTimerRunning,
                start: timerStart,
                elapsed: elapsedSeconds,
                onStart: handleStartTimer,
                onStop: handleStopTimer,
              }}
            />
          </>
        )}

        {activeTab === 'photos' && (
          <PhotoCapture jobLogId={jobLog.id} photos={jobLog.photos ?? []} />
        )}

        {activeTab === 'notes' && (
          <JobLogNotes jobLogId={jobLog.id} initialNotes={jobLog.notes ?? ''} />
        )}
      </div>

      <AppModal
        isOpen={conflictingTimer !== null}
        onClose={handleCancelConflict}
        title="Switch to a new job?"
        size="sm"
        footer={
          <>
            <AppButton variant="ghost" onClick={handleCancelConflict}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onClick={handleConfirmConflict}>
              Save &amp; switch
            </AppButton>
          </>
        }
      >
        {conflictingTimer &&
          (() => {
            const sec = Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(conflictingTimer.startTime).getTime()) / 1000
              )
            )
            const formatDuration = (s: number) => {
              if (s < 60) return null // "just now" handled inline
              const m = Math.floor(s / 60)
              if (m < 60) return m === 1 ? '1 minute' : `${m} minutes`
              const h = Math.floor(m / 60)
              const rem = m % 60
              if (h < 24) {
                if (rem === 0) return h === 1 ? '1 hour' : `${h} hours`
                return `${h}h ${rem}m`
              }
              const d = Math.floor(h / 24)
              return d === 1 ? '1 day' : `${d} days`
            }
            const duration = formatDuration(sec)
            const priorTitle = conflictingTimer.jobLogTitle
            return (
              <div className="space-y-3 break-words text-sm leading-relaxed text-ink-muted">
                <p>
                  You're still clocked in on{' '}
                  <span className="break-words font-semibold text-ink">{priorTitle}</span>
                  {duration ? (
                    <>
                      {' '}— started <span className="font-semibold text-ink">{duration}</span> ago.
                    </>
                  ) : (
                    <> — you just started.</>
                  )}
                </p>
                <p>
                  Save that time entry and start tracking{' '}
                  <span className="break-words font-semibold text-ink">{jobLog.title}</span>?
                </p>
                <p className="text-xs text-ink-subtle">
                  Cancel to keep your current clock running and stay on {priorTitle}.
                </p>
                {conflictError && (
                  <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                    {conflictError}
                  </Alert>
                )}
              </div>
            )
          })()}
      </AppModal>

      <AppModal
        isOpen={showClockInSelector}
        onClose={() => {
          setShowClockInSelector(false)
          if (!isTimerRunning) {
            setSelectedClockInUserId(user?.id || null)
          }
        }}
        title="Clock in for"
        size="sm"
        footer={
          <>
            <AppButton
              variant="ghost"
              onClick={() => {
                setShowClockInSelector(false)
                setSelectedClockInUserId(user?.id || null)
              }}
            >
              Cancel
            </AppButton>
            <AppButton
              onClick={handleStartJobForSelected}
              disabled={teamMembersLoading || !selectedClockInUserId}
            >
              Start job
            </AppButton>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">Select which team member to clock in:</p>
          {teamMembersLoading ? (
            <p className="text-sm text-ink-subtle">Loading team members...</p>
          ) : (
            <SelectField
              value={selectedClockInUserId || ''}
              onChange={e => setSelectedClockInUserId(e.target.value || null)}
              options={availableUsersToClockIn.map(m => {
                const assignment = parsedAssignments.find(a => a.userId === m.id)
                const roleTitle = assignment?.role || 'not assigned'
                const isYou = m.id === user?.id
                return {
                  value: m.id,
                  label: isYou ? `${m.name} (You) - ${roleTitle}` : `${m.name} - ${roleTitle}`,
                }
              })}
            />
          )}
        </div>
      </AppModal>

      {quoteForConvert && (
        <ConvertQuoteToInvoiceModal
          quote={quoteForConvert}
          isOpen={showConvertModal}
          onClose={() => {
            setShowConvertModal(false)
            setQuoteForConvert(null)
          }}
          onConvert={handleConvertQuoteToInvoice}
          isLoading={isConverting}
        />
      )}

      {quoteForDetail && (
        <QuoteDetail
          quote={quoteForDetail}
          isOpen={!!quoteForDetail}
          onClose={() => {
            setQuoteForDetail(null)
            getJobLogById(jobLog.id)
          }}
          onQuoteSent={onQuoteSent}
        />
      )}

      {invoiceForDetail && (
        <InvoiceDetail
          invoice={invoiceForDetail}
          isOpen={!!invoiceForDetail}
          onClose={() => {
            setInvoiceForDetail(null)
            getJobLogById(jobLog.id)
          }}
          onInvoiceSent={onInvoiceSent}
        />
      )}
    </div>
  )
}

export default JobLogDetail
