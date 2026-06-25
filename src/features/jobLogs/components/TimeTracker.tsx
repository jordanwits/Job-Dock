import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import {
  AppButton,
  AppModal,
  Alert,
  AlertIcon,
  DateField,
  SelectField,
  PencilIcon,
  PlayIcon,
  StopIcon,
  TrashIcon,
} from './jobLogsUi'
import type { TimeEntry, JobAssignment } from '../types/jobLog'
import { useJobLogStore } from '../store/jobLogStore'
import { useAuthStore } from '@/features/auth'
import { services } from '@/lib/api/services'

interface TimeTrackerProps {
  jobLogId: string
  jobLogTitle: string
  timeEntries: TimeEntry[]
  isAdmin?: boolean
  currentUserId?: string
  assignedTo?: JobAssignment[]
  assignedToUsers?: Array<{ id: string; name: string }>
  clockInFor?: 'self' | 'assigned' | 'everyone'
  externalTimerState?: {
    isRunning: boolean
    start: Date | null
    elapsed: number
    onStart: (userId?: string) => void
    onStop: () => Promise<void>
  }
}

const TIMER_STORAGE_PREFIX = 'joblog-active-timer'
const getTimerStorageKey = (userId: string | undefined): string | null =>
  userId ? `${TIMER_STORAGE_PREFIX}-${userId}` : null

function TimeNumberInput({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (v: string) => void
  label?: string
}) {
  const to12h = (h24: number) => (h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24)
  const [hourStr, setHourStr] = useState(() => {
    const [h] = (value || ':').split(':')
    const h24 = parseInt(h, 10)
    if (isNaN(h24)) return ''
    return String(to12h(h24))
  })
  const [minStr, setMinStr] = useState(() => {
    const [, m] = (value || ':').split(':')
    if (!m) return ''
    const parsed = parseInt(m, 10)
    return isNaN(parsed) ? '' : String(parsed)
  })
  const [isPM, setIsPM] = useState(() => {
    const [h] = (value || ':').split(':')
    const h24 = parseInt(h, 10) || 0
    return h24 >= 12
  })

  useEffect(() => {
    const [h, m] = (value || ':').split(':')
    const h24 = parseInt(h, 10)
    if (!isNaN(h24)) {
      setHourStr(String(to12h(h24)))
      setIsPM(h24 >= 12)
    } else {
      setHourStr(h || '')
    }
    // Parse minute value for internal state (without leading zero for easy typing)
    if (!m) {
      setMinStr('')
    } else {
      const parsed = parseInt(m, 10)
      setMinStr(isNaN(parsed) ? '' : String(Math.min(59, parsed)))
    }
  }, [value])

  const emit = (h: string, min: string, pm: boolean) => {
    const hour12 = parseInt(h, 10)
    const hasHour = h !== '' && !isNaN(hour12)
    const hasMin = min !== ''
    const minute = Math.min(59, parseInt(min, 10) || 0)
    if (hasHour && hasMin) {
      const h24 = pm ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12
      onChange(`${h24}`.padStart(2, '0') + ':' + `${minute}`.padStart(2, '0'))
    } else {
      onChange(`${h}:${min}`)
    }
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(-2)
    setHourStr(raw)
    emit(raw, minStr, isPM)
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(-2)
    const num = parseInt(raw, 10)
    if (!isNaN(num) && num > 59) raw = '59'
    setMinStr(raw)
    emit(hourStr, raw, isPM)
  }

  const toggleAMPM = () => {
    setIsPM(prev => !prev)
    emit(hourStr, minStr, !isPM)
  }

  const base =
    'bg-transparent font-mono tabular-nums text-ink focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
  const inputSize = 'h-9 w-7 min-w-0 px-0 py-1 text-base sm:text-sm text-center'
  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-xs font-medium text-ink-subtle">{label}</span>}
      <div className="flex items-center gap-0">
        <input
          type="text"
          inputMode="numeric"
          value={hourStr}
          onChange={handleHourChange}
          className={cn(base, inputSize)}
          placeholder="hr"
          aria-label={label ? `${label} hour` : undefined}
        />
        <span className="shrink-0 text-ink-subtle">:</span>
        <input
          type="text"
          inputMode="numeric"
          value={
            minStr && !isNaN(parseInt(minStr, 10))
              ? String(parseInt(minStr, 10)).padStart(2, '0')
              : minStr
          }
          onChange={handleMinuteChange}
          className={cn(base, inputSize)}
          placeholder="min"
          aria-label={label ? `${label} minute` : undefined}
        />
        <button
          type="button"
          onClick={toggleAMPM}
          className={cn(
            'h-9 w-7 min-w-0 shrink-0 self-end bg-transparent px-0.5 py-1 text-xs font-medium focus:outline-none focus:ring-0',
            isPM ? 'text-accent-strong' : 'text-ink-subtle'
          )}
          aria-label={label ? `${label} AM/PM` : undefined}
        >
          {isPM ? 'PM' : 'AM'}
        </button>
      </div>
    </div>
  )
}

const TimeTracker = ({
  jobLogId,
  jobLogTitle,
  timeEntries,
  isAdmin,
  currentUserId,
  assignedTo,
  assignedToUsers,
  clockInFor,
  externalTimerState,
}: TimeTrackerProps) => {
  const { createTimeEntry, updateTimeEntry, deleteTimeEntry } = useJobLogStore()
  const { user } = useAuthStore()
  const effectiveIsAdmin = isAdmin ?? (user?.role === 'admin' || user?.role === 'owner')
  const effectiveCurrentUserId = currentUserId ?? user?.id
  const effectiveClockInFor = clockInFor ?? 'self'

  const timerStorageKey = getTimerStorageKey(user?.id)

  // Internal timer state (only used if externalTimerState is not provided)
  const [internalIsTimerRunning, setInternalIsTimerRunning] = useState(() => {
    if (externalTimerState || !timerStorageKey) return false
    try {
      const stored = localStorage.getItem(timerStorageKey)
      if (!stored) return false
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLogId && !!startTime
    } catch {
      return false
    }
  })
  const [internalTimerStart, setInternalTimerStart] = useState<Date | null>(() => {
    if (externalTimerState || !timerStorageKey) return null
    try {
      const stored = localStorage.getItem(timerStorageKey)
      if (!stored) return null
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLogId && startTime ? new Date(startTime) : null
    } catch {
      return null
    }
  })
  const [internalElapsedSeconds, setInternalElapsedSeconds] = useState(0)
  const [clockOutError, setClockOutError] = useState<string | null>(null)
  const [conflictingTimer, setConflictingTimer] = useState<{
    jobLogId: string
    jobLogTitle: string
    startTime: string
    storedUserId?: string
    newUserId?: string
  } | null>(null)
  const [conflictError, setConflictError] = useState<string | null>(null)

  // Use external timer state if provided, otherwise use internal state
  const isTimerRunning = externalTimerState ? externalTimerState.isRunning : internalIsTimerRunning
  const timerStart = externalTimerState ? externalTimerState.start : internalTimerStart
  const elapsedSeconds = externalTimerState ? externalTimerState.elapsed : internalElapsedSeconds

  // Filter entries based on permissions
  const filteredEntries = useMemo(() => {
    if (effectiveIsAdmin) {
      // Admins see all entries
      return timeEntries
    }
    if (!effectiveCurrentUserId || !assignedTo) {
      // Fallback: only own entries
      return timeEntries.filter(te => te.userId === effectiveCurrentUserId)
    }

    // If user has clock-in permissions, they can see assigned users' entries
    if (effectiveClockInFor === 'everyone') {
      // Can see all entries (though backend may restrict)
      return timeEntries
    }
    if (effectiveClockInFor === 'assigned') {
      // Can see entries for assigned users only
      const assignedUserIds = new Set(assignedTo.map(a => a.userId))
      return timeEntries.filter(te => {
        if (!te.userId) return false
        return assignedUserIds.has(te.userId)
      })
    }

    // Self-only: only show their own entries
    return timeEntries.filter(te => te.userId === effectiveCurrentUserId)
  }, [timeEntries, effectiveIsAdmin, effectiveCurrentUserId, assignedTo, effectiveClockInFor])

  // Permission helpers (backend enforces permissions, these are for UX)
  const canEditEntry = useCallback(
    (entry: TimeEntry): boolean => {
      if (effectiveIsAdmin) return true
      if (!effectiveCurrentUserId) return false
      // Employees can edit their own entries
      return entry.userId === effectiveCurrentUserId
    },
    [effectiveIsAdmin, effectiveCurrentUserId]
  )

  const canClockFor = useCallback(
    (targetUserId?: string): boolean => {
      if (!effectiveCurrentUserId || !targetUserId) return false
      // Employees can clock in for themselves
      if (targetUserId === effectiveCurrentUserId) return true
      if (effectiveClockInFor === 'self') return false
      if (effectiveClockInFor === 'everyone') return true
      // assigned
      return !!assignedTo?.some(a => a.userId === targetUserId)
    },
    [effectiveCurrentUserId, assignedTo, effectiveClockInFor]
  )

  // Group entries by user for admin view and employees with team permissions
  const entriesByUser = useMemo(() => {
    // Group for admins or employees who can see team entries
    const shouldGroup = effectiveIsAdmin || effectiveClockInFor !== 'self'
    if (!shouldGroup) return null
    const grouped = new Map<string, { userId: string; userName: string; entries: TimeEntry[] }>()
    filteredEntries.forEach(entry => {
      const key = entry.userId || 'unknown'
      const userName = entry.userName || 'Unknown'
      if (!grouped.has(key)) {
        grouped.set(key, { userId: key, userName, entries: [] })
      }
      grouped.get(key)!.entries.push(entry)
    })

    // Sort: current user first, then leads, then others
    return Array.from(grouped.values()).sort((a, b) => {
      // Current user always first
      if (a.userId === effectiveCurrentUserId) return -1
      if (b.userId === effectiveCurrentUserId) return 1

      // Then check for leads
      const aAssignment = assignedTo?.find(ass => ass.userId === a.userId)
      const bAssignment = assignedTo?.find(ass => ass.userId === b.userId)
      const aIsLead = aAssignment?.role?.toLowerCase().includes('lead') ?? false
      const bIsLead = bAssignment?.role?.toLowerCase().includes('lead') ?? false

      if (aIsLead && !bIsLead) return -1
      if (!aIsLead && bIsLead) return 1

      // Otherwise maintain original order (by name)
      return a.userName.localeCompare(b.userName)
    })
  }, [filteredEntries, effectiveIsAdmin, effectiveClockInFor, effectiveCurrentUserId, assignedTo])
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null)
  const [inlineNotes, setInlineNotes] = useState('')
  const [inlineTimeEditId, setInlineTimeEditId] = useState<string | null>(null)
  const [inlineEditDate, setInlineEditDate] = useState('')
  const [inlineStartTime, setInlineStartTime] = useState('')
  const [inlineEndTime, setInlineEndTime] = useState('')
  const [timeEditError, setTimeEditError] = useState<string | null>(null)
  const [inlineDurationEditId, setInlineDurationEditId] = useState<string | null>(null)
  const [inlineDuration, setInlineDuration] = useState('')
  const [durationError, setDurationError] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [descriptionModalId, setDescriptionModalId] = useState<string | null>(null)
  const [descriptionModalEditing, setDescriptionModalEditing] = useState(false)
  const [timeEntryDetailId, setTimeEntryDetailId] = useState<string | null>(null)
  const [detailModalDate, setDetailModalDate] = useState('')
  const [detailModalStart, setDetailModalStart] = useState('')
  const [detailModalEnd, setDetailModalEnd] = useState('')
  const [detailModalNotes, setDetailModalNotes] = useState('')
  const [detailModalError, setDetailModalError] = useState<string | null>(null)
  const [detailModalSaving, setDetailModalSaving] = useState(false)
  const [modalEditNotes, setModalEditNotes] = useState('')
  const [showManualEntryModal, setShowManualEntryModal] = useState(false)
  const [manualEntryDate, setManualEntryDate] = useState('')
  const [manualEntryStart, setManualEntryStart] = useState('')
  const [manualEntryEnd, setManualEntryEnd] = useState('')
  const [manualEntryNotes, setManualEntryNotes] = useState('')
  const [manualEntryUserId, setManualEntryUserId] = useState<string | null>(null)
  const [manualEntryError, setManualEntryError] = useState<string | null>(null)
  const [manualEntrySaving, setManualEntrySaving] = useState(false)
  const [showUserSelector, setShowUserSelector] = useState(false)
  const [selectedClockInUserId, setSelectedClockInUserId] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string }>>([])
  const [teamMembersLoading, setTeamMembersLoading] = useState<boolean>(effectiveIsAdmin)
  const durationInputRef = useRef<HTMLInputElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const modalTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Load team members for user selection
  useEffect(() => {
    // Admins can always load all team members (for manual entry and clock-in)
    // Employees cannot list all users; rely on `assignedToUsers` passed from job-log payload instead.
    if (!effectiveIsAdmin) {
      setTeamMembersLoading(false)
      return
    }
    // For admins, always load team members (regardless of clockInFor permission)
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
      } catch (error) {
        console.error('Failed to load team members:', error)
      } finally {
        setTeamMembersLoading(false)
      }
    }
    loadTeamMembers()
  }, [effectiveIsAdmin])

  // Get available users to clock in for based on permissions
  const availableUsersToClockIn = useMemo(() => {
    if (!effectiveCurrentUserId) return []

    // Admins can always see all team members (for manual entry and clock-in)
    if (effectiveIsAdmin) {
      // If team members are loaded, use them; otherwise use assigned users as fallback
      if (teamMembers.length > 0) {
        return teamMembers.map(u => ({ id: u.id, name: u.name || u.id }))
      }
      // Fallback: use assigned users if team members not loaded yet
      if (assignedTo && assignedToUsers) {
        const assignedUserIds = new Set(assignedTo.map(a => a.userId))
        const assignedUsers = assignedToUsers.filter(u => assignedUserIds.has(u.id))
        return assignedUsers.map(u => ({ id: u.id, name: u.name || u.id }))
      }
      // Last resort: just current user
      return [{ id: effectiveCurrentUserId, name: user?.name || 'You' }]
    }

    // Non-admins: use role-based permissions
    if (!assignedTo) return []

    const assignedUserIds = new Set(assignedTo.map(a => a.userId))
    const assignedUsers = (assignedToUsers || []).filter(u => assignedUserIds.has(u.id))

    if (effectiveClockInFor === 'self') {
      const self = assignedUsers.find(u => u.id === effectiveCurrentUserId) ||
        teamMembers.find(u => u.id === effectiveCurrentUserId) || {
          id: effectiveCurrentUserId,
          name: user?.name || 'You',
        }
      return [self]
    }

    if (effectiveClockInFor === 'everyone') {
      // Even with 'everyone' permission, only show assigned team members
      if (assignedUsers.length > 0) {
        return assignedUsers.map(u => ({ id: u.id, name: u.name || u.id }))
      }
      // Fallback: filter teamMembers to only assigned users
      return teamMembers.filter(m => assignedUserIds.has(m.id))
    }

    // assigned
    return assignedUsers.map(u => ({ id: u.id, name: u.name || u.id }))
  }, [
    effectiveCurrentUserId,
    assignedTo,
    assignedToUsers,
    teamMembers,
    user?.name,
    effectiveClockInFor,
    effectiveIsAdmin,
  ])

  // Check if user can clock in for others
  const canClockInForOthers = useMemo(() => {
    // Admins can always clock in for others
    if (effectiveIsAdmin) return true
    if (!effectiveCurrentUserId || !assignedTo) return false
    return effectiveClockInFor !== 'self'
  }, [effectiveCurrentUserId, assignedTo, effectiveClockInFor, effectiveIsAdmin])

  useEffect(() => {
    if (descriptionModalEditing) {
      requestAnimationFrame(() => {
        const el = modalTextareaRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(el.value.length, el.value.length)
        }
      })
    }
  }, [descriptionModalEditing])

  const tick = useCallback(() => {
    if (externalTimerState) return // External timer handles its own updates
    if (internalTimerStart) {
      setInternalElapsedSeconds(Math.floor((Date.now() - internalTimerStart.getTime()) / 1000))
    }
  }, [internalTimerStart, externalTimerState])

  useEffect(() => {
    if (externalTimerState) return // External timer handles its own updates
    if (!internalIsTimerRunning || !internalTimerStart) return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [internalIsTimerRunning, internalTimerStart, tick, externalTimerState])

  const formatElapsed = (sec: number) => {
    const h = Math.floor(sec / 3600)
    const m = Math.floor((sec % 3600) / 60)
    const s = sec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const formatDuration = (te: TimeEntry) => {
    const start = new Date(te.startTime).getTime()
    const end = new Date(te.endTime).getTime()
    const breakMin = (te.breakMinutes ?? 0) * 60 * 1000
    const totalSec = Math.round((end - start - breakMin) / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const parseDurationToSeconds = (str: string): number | null => {
    const s = str.trim()
    if (!s) return null
    const parts = s.split(':').map(p => parseInt(p.trim(), 10))
    if (parts.some(n => isNaN(n))) return null
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]
    }
    if (parts.length === 2) {
      // HH:MM (e.g. "1:30" = 1h 30m) not MM:SS
      return parts[0] * 3600 + parts[1] * 60
    }
    if (parts.length === 1) {
      // Single number: treat as minutes (e.g. "90" = 90 min)
      return parts[0] * 60
    }
    return null
  }

  const extractErrorMessage = (e: unknown, fallback: string) =>
    (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data
      ?.message ||
    (e as { message?: string })?.message ||
    fallback

  const startLocalTimer = (userId?: string) => {
    const targetUserId = userId || effectiveCurrentUserId
    const start = new Date()
    setInternalTimerStart(start)
    setInternalIsTimerRunning(true)
    setSelectedClockInUserId(targetUserId || null)
    if (!timerStorageKey) return
    try {
      localStorage.setItem(
        timerStorageKey,
        JSON.stringify({
          jobLogId,
          jobLogTitle, // stored so a future conflict prompt can name this job
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
    const targetUserId = userId || effectiveCurrentUserId
    if (externalTimerState) {
      externalTimerState.onStart(targetUserId)
      return
    }
    // If a timer is already running on a different job, prompt the user before
    // overwriting it — otherwise the prior session's start time is lost and the
    // entry is never saved (the root cause behind a class of missing-entry reports).
    try {
      const stored = timerStorageKey ? localStorage.getItem(timerStorageKey) : null
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.jobLogId && parsed.jobLogId !== jobLogId && parsed.startTime) {
          const storedTitle: string | undefined = parsed.jobLogTitle
          setConflictError(null)
          setConflictingTimer({
            jobLogId: parsed.jobLogId,
            jobLogTitle: storedTitle || 'another job',
            startTime: parsed.startTime,
            storedUserId: parsed.userId,
            newUserId: targetUserId,
          })
          // Best-effort title fetch for older sessions that didn't persist the title.
          if (!storedTitle) {
            services.jobLogs
              .getById(parsed.jobLogId)
              .then(jl => {
                const title = (jl as { title?: string } | null)?.title
                if (!title) return
                setConflictingTimer(prev =>
                  prev && prev.jobLogId === parsed.jobLogId
                    ? { ...prev, jobLogTitle: title }
                    : prev
                )
              })
              .catch(() => {
                /* keep the generic label */
              })
          }
          return
        }
      }
    } catch {
      // localStorage unreadable — fall through and start normally
    }
    startLocalTimer(targetUserId)
  }

  const handleConfirmConflict = async () => {
    if (!conflictingTimer) return
    setConflictError(null)
    try {
      await createTimeEntry({
        jobLogId: conflictingTimer.jobLogId,
        startTime: conflictingTimer.startTime,
        endTime: new Date().toISOString(),
        userId: conflictingTimer.storedUserId,
      })
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
    const newUserId = conflictingTimer.newUserId
    setConflictingTimer(null)
    if (timerStorageKey) {
      try {
        localStorage.removeItem(timerStorageKey)
      } catch {
        // ignore
      }
    }
    startLocalTimer(newUserId)
  }

  const handleCancelConflict = () => {
    setConflictingTimer(null)
    setConflictError(null)
  }

  const handleStartTimerClick = () => {
    // If user can clock in for others and there are multiple options, show selector
    // (Same condition as manual entry for consistency)
    if (canClockInForOthers) {
      if (teamMembersLoading) {
        // If still loading, wait a bit then check again
        // Use a longer timeout and check teamMembers directly since availableUsersToClockIn is memoized
        setTimeout(() => {
          // Re-check: if admin, check teamMembers.length; otherwise check availableUsersToClockIn
          const shouldShow = effectiveIsAdmin
            ? teamMembers.length > 1
            : availableUsersToClockIn.length > 1

          if (shouldShow) {
            setShowUserSelector(true)
          } else {
            handleStartTimer()
          }
        }, 500)
      } else if (availableUsersToClockIn.length > 1) {
        setShowUserSelector(true)
      } else {
        // No multiple users available, just start for current user
        handleStartTimer()
      }
    } else {
      // Otherwise, just start for current user
      handleStartTimer()
    }
  }

  const handleStopTimer = async () => {
    setClockOutError(null)
    if (externalTimerState) {
      try {
        await externalTimerState.onStop()
      } catch (e) {
        console.error('Clock-out failed:', e)
        setClockOutError(
          extractErrorMessage(
            e,
            'Failed to save time entry. Your timer is still running — please try again.'
          )
        )
      }
      return
    }
    // Use localStorage as source of truth for start time (survives navigation/refresh)
    let startTime: string
    let storedUserId: string | undefined
    try {
      const stored = timerStorageKey ? localStorage.getItem(timerStorageKey) : null
      if (stored) {
        const parsed = JSON.parse(stored)
        const { jobLogId: storedId, startTime: storedStart, userId: storedUser } = parsed
        if (storedId === jobLogId && storedStart) {
          startTime = storedStart
          storedUserId = storedUser
        } else if (internalTimerStart) {
          startTime = internalTimerStart.toISOString()
        } else {
          setClockOutError(
            'No active timer found for this job. The timer may have been started on a different job or device.'
          )
          return
        }
      } else if (internalTimerStart) {
        startTime = internalTimerStart.toISOString()
      } else {
        setClockOutError('No active timer found. Nothing to save.')
        return
      }
    } catch {
      if (!internalTimerStart) {
        setClockOutError('Could not read timer state. Nothing to save.')
        return
      }
      startTime = internalTimerStart.toISOString()
    }
    const end = new Date()
    const targetUserId = storedUserId || selectedClockInUserId || effectiveCurrentUserId
    try {
      await createTimeEntry({
        jobLogId,
        startTime,
        endTime: end.toISOString(),
        userId: targetUserId, // Pass userId for backend validation
      })
      // Success: clear timer state and localStorage
      setInternalIsTimerRunning(false)
      setInternalTimerStart(null)
      setInternalElapsedSeconds(0)
      setSelectedClockInUserId(null)
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
    setInternalIsTimerRunning(false)
    setInternalTimerStart(null)
    setInternalElapsedSeconds(0)
    setSelectedClockInUserId(null)
    setClockOutError(null)
    if (timerStorageKey) {
      try {
        localStorage.removeItem(timerStorageKey)
      } catch {
        // ignore
      }
    }
  }

  const openManualEntryModal = () => {
    const now = new Date()
    const start = new Date(now)
    start.setHours(now.getHours() - 1, now.getMinutes(), 0, 0)
    setManualEntryDate(format(now, 'yyyy-MM-dd'))
    setManualEntryStart(format(start, 'HH:mm'))
    setManualEntryEnd(format(now, 'HH:mm'))
    setManualEntryNotes('')
    setManualEntryUserId(null)
    setManualEntryError(null)
    setShowManualEntryModal(true)
  }

  const closeManualEntryModal = () => {
    setShowManualEntryModal(false)
    setManualEntryError(null)
  }

  const handleManualEntrySubmit = async () => {
    setManualEntryError(null)
    if (!manualEntryDate || !manualEntryStart || !manualEntryEnd) {
      setManualEntryError('Please fill in date, start time, and end time.')
      return
    }
    const [startH, startM] = manualEntryStart.split(':').map(Number)
    const [endH, endM] = manualEntryEnd.split(':').map(Number)
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {
      setManualEntryError('Invalid time format. Use 12-hour format (e.g. 9:30) with AM/PM.')
      return
    }
    const startDate = new Date(`${manualEntryDate}T${manualEntryStart}:00`)
    const endDate = new Date(`${manualEntryDate}T${manualEntryEnd}:00`)
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setManualEntryError('Invalid date or time.')
      return
    }
    if (endDate <= startDate) {
      setManualEntryError('End time must be after start time.')
      return
    }
    const targetUserId = manualEntryUserId || effectiveCurrentUserId
    setManualEntrySaving(true)
    try {
      await createTimeEntry({
        jobLogId,
        startTime: startDate.toISOString(),
        endTime: endDate.toISOString(),
        notes: manualEntryNotes.trim() || undefined,
        userId: targetUserId,
      })
      closeManualEntryModal()
    } catch (e) {
      console.error(e)
      setManualEntryError(
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
          (e as { message?: string })?.message ||
          'Failed to add time entry'
      )
    } finally {
      setManualEntrySaving(false)
    }
  }

  const handleDeleteClick = (id: string) => {
    setDeleteId(id)
  }

  const handleConfirmDelete = async () => {
    if (!deleteId) return
    try {
      await deleteTimeEntry(deleteId, jobLogId)
      setDeleteId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleInlineNotesSave = async (te: TimeEntry) => {
    if (inlineEditId !== te.id) return
    try {
      await updateTimeEntry(te.id, { notes: inlineNotes || undefined }, jobLogId)
      setInlineEditId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleInlineTimeSave = async (te: TimeEntry) => {
    if (inlineTimeEditId !== te.id) return
    setTimeEditError(null)
    if (!inlineEditDate) {
      setTimeEditError('Please select a date.')
      return
    }
    const baseDate = new Date(inlineEditDate + 'T12:00:00')
    if (isNaN(baseDate.getTime())) {
      setTimeEditError('Invalid date.')
      return
    }
    const newStart = parseTimeToDate(inlineStartTime, baseDate)
    const newEnd = parseTimeToDate(inlineEndTime, baseDate)
    if (!newStart) {
      setTimeEditError('Invalid start time. Use 12-hour format (e.g. 9:30) with AM/PM.')
      return
    }
    if (!newEnd) {
      setTimeEditError('Invalid end time. Use 12-hour format (e.g. 5:45) with AM/PM.')
      return
    }
    if (newEnd <= newStart) {
      setTimeEditError('End time must be after start time.')
      return
    }
    try {
      await updateTimeEntry(
        te.id,
        {
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        },
        jobLogId
      )
      setInlineTimeEditId(null)
    } catch (e) {
      console.error(e)
    }
  }

  const beginTimeEdit = (te: TimeEntry) => {
    setInlineTimeEditId(te.id)
    setTimeEditError(null)
    const start = new Date(te.startTime)
    const end = new Date(te.endTime)
    setInlineEditDate(format(start, 'yyyy-MM-dd'))
    setInlineStartTime(format(start, 'HH:mm'))
    setInlineEndTime(format(end, 'HH:mm'))
  }

  const parseTimeToDate = (timeStr: string, baseDate: Date): Date | null => {
    const [h, m] = timeStr.split(':').map(Number)
    if (isNaN(h) || isNaN(m)) return null
    if (h < 0 || h > 23 || m < 0 || m > 59) return null
    const d = new Date(baseDate)
    d.setHours(h, m, 0, 0)
    return d
  }

  const beginDurationEdit = (te: TimeEntry) => {
    setInlineDurationEditId(te.id)
    setDurationError(null)
    setInlineDuration(formatDuration(te))
  }

  const handleInlineDurationSave = async (te: TimeEntry) => {
    if (inlineDurationEditId !== te.id) return
    setDurationError(null)
    const totalSec = parseDurationToSeconds(inlineDuration)
    if (totalSec === null || totalSec < 0) {
      setDurationError('Invalid duration. Use HH:MM:SS (e.g. 1:30:00) or HH:MM or minutes.')
      return
    }
    const start = new Date(te.startTime).getTime()
    const breakMs = (te.breakMinutes ?? 0) * 60 * 1000
    const newEnd = new Date(start + totalSec * 1000 + breakMs)
    try {
      await updateTimeEntry(
        te.id,
        {
          endTime: newEnd.toISOString(),
        },
        jobLogId
      )
      setInlineDurationEditId(null)
    } catch (e) {
      console.error(e)
    }
  }

  // Calculate totals
  const calculateTotalSeconds = (entries: TimeEntry[]) => {
    return entries.reduce((sum, te) => {
      const start = new Date(te.startTime).getTime()
      const end = new Date(te.endTime).getTime()
      const breakMin = (te.breakMinutes ?? 0) * 60 * 1000
      return sum + (end - start - breakMin) / 1000
    }, 0)
  }

  const formatTotal = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.round(seconds % 60)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const totalSeconds = calculateTotalSeconds(filteredEntries)
  const totalFormatted = formatTotal(totalSeconds)

  const detailEntry = timeEntryDetailId
    ? filteredEntries.find(t => t.id === timeEntryDetailId) ?? null
    : null

  const resolveEntryUserName = (te: TimeEntry) =>
    te.userName ||
    assignedToUsers?.find(u => u.id === te.userId)?.name ||
    (te.userId === effectiveCurrentUserId ? user?.name || 'You' : undefined) ||
    (te.userId ? 'Team member' : 'Unknown')

  const entryDurationLabel = (te: TimeEntry) => {
    const start = new Date(te.startTime).getTime()
    const end = new Date(te.endTime).getTime()
    const breakMin = (te.breakMinutes ?? 0) * 60 * 1000
    if (end - start - breakMin <= 0) return 'In progress'
    return formatDuration(te)
  }

  useEffect(() => {
    if (timeEntryDetailId && !detailEntry) setTimeEntryDetailId(null)
  }, [timeEntryDetailId, detailEntry])

  useEffect(() => {
    if (!detailEntry) return
    const start = new Date(detailEntry.startTime)
    const end = new Date(detailEntry.endTime)
    setDetailModalDate(format(start, 'yyyy-MM-dd'))
    setDetailModalStart(format(start, 'HH:mm'))
    setDetailModalEnd(format(end, 'HH:mm'))
    setDetailModalNotes(detailEntry.notes ?? '')
    setDetailModalError(null)
  }, [detailEntry?.id, detailEntry?.startTime, detailEntry?.endTime, detailEntry?.notes])

  const handleDetailModalSave = async () => {
    if (!detailEntry || !canEditEntry(detailEntry)) return
    setDetailModalError(null)
    if (!detailModalDate) {
      setDetailModalError('Please select a date.')
      return
    }
    const baseDate = new Date(detailModalDate + 'T12:00:00')
    if (isNaN(baseDate.getTime())) {
      setDetailModalError('Invalid date.')
      return
    }
    const newStart = parseTimeToDate(detailModalStart, baseDate)
    const newEnd = parseTimeToDate(detailModalEnd, baseDate)
    if (!newStart) {
      setDetailModalError('Invalid start time.')
      return
    }
    if (!newEnd) {
      setDetailModalError('Invalid end time.')
      return
    }
    if (newEnd <= newStart) {
      setDetailModalError('End time must be after start time.')
      return
    }
    setDetailModalSaving(true)
    try {
      await updateTimeEntry(
        detailEntry.id,
        {
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
          notes: detailModalNotes.trim() || undefined,
        },
        jobLogId
      )
      setTimeEntryDetailId(null)
    } catch (e) {
      console.error(e)
      setDetailModalError(
        (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data
          ?.message ||
          (e as { message?: string })?.message ||
          'Could not save changes'
      )
    } finally {
      setDetailModalSaving(false)
    }
  }

  // Helper function to render a single time entry row
  const renderTimeEntryRow = (te: TimeEntry, index: number) => (
    <div
      key={te.id}
      onClick={() => {
        if (inlineTimeEditId === te.id) return
        setTimeEntryDetailId(te.id)
      }}
      className={cn(
        'flex gap-2 sm:gap-3 py-2 px-3 rounded-lg border border-line bg-surface-2 transition-colors hover:bg-surface-hover',
        inlineTimeEditId === te.id
          ? 'flex-col sm:flex-row sm:flex-nowrap sm:items-center'
          : 'flex-nowrap items-center overflow-x-auto',
        inlineTimeEditId !== te.id && 'cursor-pointer'
      )}
    >
      {/* Index + Job title + Team member (admin) + Notes */}
      <div className="flex items-center gap-2 min-w-0 flex-1 w-full sm:w-auto">
        <div className="w-8 h-8 flex items-center justify-center rounded border border-line bg-surface font-mono text-xs font-medium tabular-nums text-ink-muted shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
          {(effectiveIsAdmin || effectiveClockInFor !== 'self') && te.userName && (
            <>
              <span className="text-sm font-medium shrink-0 text-ink-muted">{te.userName}</span>
              <span className="shrink-0 hidden sm:inline text-ink-subtle">–</span>
            </>
          )}
          <span className="font-semibold text-base truncate text-ink">{jobLogTitle}</span>
          <span className="shrink-0 hidden sm:inline text-ink-subtle">–</span>
          {inlineEditId === te.id ? (
            canEditEntry(te) ? (
              <input
                type="text"
                value={inlineNotes}
                onChange={e => setInlineNotes(e.target.value)}
                onClick={e => e.stopPropagation()}
                onBlur={() => handleInlineNotesSave(te)}
                onKeyDown={e => e.key === 'Enter' && handleInlineNotesSave(te)}
                placeholder="Add description"
                className="flex-1 min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-0"
                autoFocus
              />
            ) : (
              <span className="flex-1 min-w-0 text-sm truncate text-ink-muted">
                {te.notes || ''}
              </span>
            )
            ) : (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                if (!canEditEntry(te)) return
                if (isMobile) {
                  setDescriptionModalId(te.id)
                } else {
                  setInlineEditId(te.id)
                  setInlineNotes(te.notes ?? '')
                }
              }}
              disabled={!canEditEntry(te)}
              className={cn(
                'flex-1 min-w-0 text-left text-sm truncate text-ink-muted hover:text-ink',
                !canEditEntry(te) && 'cursor-default opacity-60'
              )}
            >
              {te.notes || <span className="text-ink-subtle">Add description</span>}
            </button>
          )}
        </div>
      </div>

      {/* Time range + Duration + Menu */}
      <div
        className={cn(
          'flex gap-2 shrink-0',
          inlineTimeEditId === te.id
            ? 'flex-col sm:flex-row sm:items-center sm:flex-nowrap'
            : 'flex-nowrap items-center'
        )}
      >
        {/* Time range */}
        <div className={cn('shrink-0', inlineTimeEditId === te.id && 'w-full sm:w-auto')}>
          {inlineTimeEditId === te.id ? (
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-2 w-full min-w-0 p-2 sm:p-0 rounded-lg border border-line bg-surface-2 sm:rounded-none sm:border-0 sm:bg-transparent"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-row items-start gap-2 flex-wrap">
                <div className="min-w-[280px]">
                  <DateField
                    label="Date"
                    value={inlineEditDate}
                    onChange={date => setInlineEditDate(date ?? '')}
                    placeholder="Select date"
                  />
                </div>
                <div className="flex flex-col gap-0.5 items-start">
                  <span className="text-xs font-medium text-ink-subtle">Start</span>
                  <TimeNumberInput value={inlineStartTime} onChange={setInlineStartTime} />
                </div>
                <span className="self-end pb-1 text-ink-subtle">–</span>
                <div className="flex flex-col gap-0.5 items-start">
                  <span className="text-xs font-medium text-ink-subtle">End</span>
                  <TimeNumberInput value={inlineEndTime} onChange={setInlineEndTime} />
                </div>
              </div>
              {timeEditError && <p className="text-sm text-danger">{timeEditError}</p>}
              <div className="flex gap-2 sm:gap-1 border-t border-line pt-0.5 sm:border-0 sm:pt-0">
                <AppButton
                  type="button"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => handleInlineTimeSave(te)}
                >
                  Save
                </AppButton>
                <AppButton
                  type="button"
                  variant="subtle"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  onClick={() => {
                    setInlineTimeEditId(null)
                    setTimeEditError(null)
                  }}
                >
                  Cancel
                </AppButton>
              </div>
            </div>
          ) : canEditEntry(te) ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                beginTimeEdit(te)
              }}
              className="hidden sm:inline-block font-mono text-sm tabular-nums text-ink-muted hover:text-ink hover:underline"
            >
              {format(new Date(te.startTime), 'MMM d')} • {format(new Date(te.startTime), 'h:mma')}{' '}
              – {format(new Date(te.endTime), 'h:mma')}
            </button>
          ) : (
            <span className="hidden sm:inline-block font-mono text-sm tabular-nums text-ink-muted">
              {format(new Date(te.startTime), 'MMM d')} • {format(new Date(te.startTime), 'h:mma')}{' '}
              – {format(new Date(te.endTime), 'h:mma')}
            </span>
          )}
        </div>

        {/* Date on mobile (time range hidden) */}
        <span className="text-xs shrink-0 sm:hidden font-mono tabular-nums text-ink-subtle">
          {format(new Date(te.startTime), 'MMM d')}
        </span>

        {/* Duration */}
        <div
          className="w-24 shrink-0 text-right flex flex-col items-end gap-0.5"
          onClick={inlineDurationEditId === te.id ? e => e.stopPropagation() : undefined}
        >
          {inlineDurationEditId === te.id ? (
            <>
              <input
                ref={durationInputRef}
                type="text"
                inputMode="numeric"
                value={inlineDuration}
                onChange={e => setInlineDuration(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    handleInlineDurationSave(te)
                    return
                  }
                  if (e.key === 'Escape') {
                    setInlineDurationEditId(null)
                    setDurationError(null)
                    return
                  }
                }}
                onBlur={() => handleInlineDurationSave(te)}
                placeholder="00:00:00"
                className="w-full bg-transparent px-2 py-1 text-right font-mono text-sm font-medium tabular-nums text-ink focus:outline-none focus:ring-0"
                autoFocus
              />
              {durationError && (
                <p className="text-xs text-danger text-right max-w-[140px]">{durationError}</p>
              )}
            </>
          ) : canEditEntry(te) ? (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                beginDurationEdit(te)
              }}
              className="w-full text-right font-mono text-sm font-medium tabular-nums text-ink hover:text-accent-strong hover:underline"
            >
              {formatDuration(te)}
            </button>
          ) : (
            <span className="w-full text-right font-mono text-sm font-medium tabular-nums text-ink">
              {formatDuration(te)}
            </span>
          )}
        </div>

        {/* Kebab menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              menuButtonRef.current = e.currentTarget
              setOpenMenuId(openMenuId === te.id ? null : te.id)
            }}
            className="p-1 rounded text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
            aria-label="More options"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          {openMenuId === te.id &&
            createPortal(
              <>
                <div
                  className="fixed inset-0 z-[100]"
                  onClick={e => {
                    e.stopPropagation()
                    setOpenMenuId(null)
                  }}
                  aria-hidden
                />
                <div
                  className="fixed z-[101] min-w-[140px] rounded-xl bg-surface p-1.5 shadow-pop ring-1 ring-line"
                  onClick={e => e.stopPropagation()}
                  style={
                    menuButtonRef.current
                      ? (() => {
                          const rect = menuButtonRef.current.getBoundingClientRect()
                          const menuHeight = 90
                          const spaceBelow = window.innerHeight - rect.bottom
                          const spaceAbove = rect.top

                          // If not enough space below but more space above, position above
                          if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
                            return {
                              bottom: window.innerHeight - rect.top + 4,
                              right: window.innerWidth - rect.right,
                            }
                          }

                          // Otherwise position below
                          return {
                            top: rect.bottom + 4,
                            right: window.innerWidth - rect.right,
                          }
                        })()
                      : undefined
                  }
                >
                  {canEditEntry(te) && (
                    <>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          setTimeEntryDetailId(te.id)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-surface-2"
                      >
                        <PencilIcon className="h-4 w-4" />
                        Edit times
                      </button>
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation()
                          setOpenMenuId(null)
                          handleDeleteClick(te.id)
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
                      >
                        <TrashIcon className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </>,
              document.body
            )}
        </div>
      </div>
    </div>
  )

  let detailModalDurationPreview: string | null = null
  if (detailEntry && detailModalDate) {
    const baseDate = new Date(detailModalDate + 'T12:00:00')
    if (!isNaN(baseDate.getTime())) {
      const newStart = parseTimeToDate(detailModalStart, baseDate)
      const newEnd = parseTimeToDate(detailModalEnd, baseDate)
      if (newStart && newEnd && newEnd > newStart) {
        detailModalDurationPreview = formatDuration({
          ...detailEntry,
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        })
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Header: Today | Total */}
      <div className="flex items-center justify-between border-b border-line pb-3">
        <span className="text-sm font-medium text-ink-muted">
          {effectiveIsAdmin
            ? 'All Time Entries'
            : effectiveClockInFor === 'self'
              ? 'My Time Entries'
              : 'Team Time Entries'}
        </span>
        <div className="flex items-center gap-2">
          {filteredEntries.length > 0 && (
            <span className="text-sm text-ink-muted">
              {effectiveIsAdmin ? 'Overall Total' : 'Total'}:{' '}
              <span className="font-mono font-medium tabular-nums text-ink">{totalFormatted}</span>
            </span>
          )}
          <AppButton variant="subtle" size="sm" onClick={openManualEntryModal}>
            Add entry
          </AppButton>
        </div>
      </div>

      {/* Timer */}
      <div className="flex flex-nowrap items-center gap-4">
        {!isTimerRunning ? (
          <AppButton onClick={handleStartTimerClick} size="sm">
            <PlayIcon className="h-4 w-4" />
            Start Job
          </AppButton>
        ) : (
          <div className="flex items-center gap-4">
            {selectedClockInUserId && selectedClockInUserId !== effectiveCurrentUserId && (
              <span className="text-sm text-ink-muted">
                For: {teamMembers.find(u => u.id === selectedClockInUserId)?.name || 'Unknown'}
              </span>
            )}
            <span className="text-2xl font-mono tabular-nums text-accent-strong">
              {formatElapsed(elapsedSeconds)}
            </span>
            <AppButton onClick={handleStopTimer} variant="danger" size="sm">
              <StopIcon className="h-4 w-4" />
              Stop
            </AppButton>
          </div>
        )}
      </div>

      {clockOutError && (
        <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
          <div className="flex flex-wrap items-start gap-2">
            <span className="flex-1">{clockOutError}</span>
            {isTimerRunning && (
              <button
                type="button"
                onClick={handleDiscardTimer}
                className="underline hover:no-underline"
              >
                Discard timer
              </button>
            )}
          </div>
        </Alert>
      )}

      {/* Time entries list */}
      {entriesByUser && entriesByUser.length > 0 ? (
        // Grouped view: by team member (for admins and employees with team permissions)
        <div className="space-y-4">
          {entriesByUser.map((group, groupIndex) => {
            const memberTotalSeconds = calculateTotalSeconds(group.entries)
            const memberTotalFormatted = formatTotal(memberTotalSeconds)
            const userId = group.userId
            const assignment = userId ? assignedTo?.find(a => a.userId === userId) : undefined
            const payType = assignment?.payType || 'job'
            const fallbackRate = assignment?.hourlyRate
            const earned = (() => {
              if (payType !== 'hourly') return null
              let total = 0
              for (const te of group.entries) {
                const rate = te.hourlyRate ?? fallbackRate
                if (rate == null || isNaN(rate)) continue
                const start = new Date(te.startTime).getTime()
                const end = new Date(te.endTime).getTime()
                const breakMin = (te.breakMinutes ?? 0) * 60 * 1000
                const hours = (end - start - breakMin) / 3600000
                total += hours * rate
              }
              return total > 0 ? total : null
            })()
            return (
              <div key={groupIndex} className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-line pb-2">
                  <span className="text-sm font-semibold text-ink">{group.userName}</span>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm text-ink-muted">
                      Total:{' '}
                      <span className="font-mono font-medium tabular-nums text-ink">{memberTotalFormatted}</span>
                    </span>
                    {earned != null && (
                      <span className="font-mono text-xs tabular-nums text-accent-strong">
                        Earned: $
                        {earned.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  {group.entries.map((te, index) => renderTimeEntryRow(te, index))}
                </div>
              </div>
            )
          })}
        </div>
      ) : filteredEntries.length > 0 ? (
        // Fallback: simple list (for self-only employees)
        <div className="space-y-1">
          {filteredEntries.map((te, index) => renderTimeEntryRow(te, index))}
        </div>
      ) : null}

      <AppModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Delete time entry"
        size="sm"
        footer={
          <>
            <AppButton variant="ghost" onClick={() => setDeleteId(null)}>
              Cancel
            </AppButton>
            <AppButton variant="danger" onClick={handleConfirmDelete}>
              Delete
            </AppButton>
          </>
        }
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-soft text-danger">
            <AlertIcon className="h-5 w-5" />
          </span>
          <p className="text-sm leading-relaxed text-ink-muted">
            Are you sure you want to delete this time entry?
          </p>
        </div>
      </AppModal>

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
            <AppButton onClick={handleConfirmConflict}>Save &amp; switch</AppButton>
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
              if (s < 60) return null
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
                  <span className="font-semibold break-words text-ink">{priorTitle}</span>
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
                  <span className="font-semibold break-words text-ink">{jobLogTitle}</span>?
                </p>
                <p className="text-xs text-ink-subtle">
                  Cancel to keep your current clock running and stay on {priorTitle}.
                </p>
                {conflictError && (
                  <div role="alert">
                    <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                      <span className="break-words">{conflictError}</span>
                    </Alert>
                  </div>
                )}
              </div>
            )
          })()}
      </AppModal>

      <AppModal
        isOpen={detailEntry !== null}
        onClose={() => {
          setTimeEntryDetailId(null)
          setDetailModalError(null)
        }}
        title="Time entry"
        size="sm"
        footer={
          <div className="flex flex-col gap-2 w-full min-w-0 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div
              className={cn(
                'flex flex-wrap gap-2 w-full sm:w-auto sm:min-w-0 sm:justify-end',
                detailEntry && canEditEntry(detailEntry) && 'sm:order-2 sm:flex-1'
              )}
            >
              <AppButton
                variant="subtle"
                size="sm"
                className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
                onClick={() => {
                  setTimeEntryDetailId(null)
                  setDetailModalError(null)
                }}
                disabled={detailModalSaving}
              >
                Close
              </AppButton>
              {detailEntry && canEditEntry(detailEntry) && (
                <AppButton
                  size="sm"
                  className="min-h-[44px] sm:min-h-0 flex-1 sm:flex-initial"
                  onClick={handleDetailModalSave}
                  disabled={detailModalSaving}
                  isLoading={detailModalSaving}
                >
                  {detailModalSaving ? 'Saving…' : 'Save'}
                </AppButton>
              )}
            </div>
            {detailEntry && canEditEntry(detailEntry) && (
              <AppButton
                variant="dangerGhost"
                size="sm"
                className="w-full min-h-[44px] sm:min-h-0 sm:w-auto sm:order-1"
                disabled={detailModalSaving}
                onClick={() => {
                  const id = detailEntry.id
                  setTimeEntryDetailId(null)
                  setDetailModalError(null)
                  handleDeleteClick(id)
                }}
              >
                Delete
              </AppButton>
            )}
          </div>
        }
      >
        {detailEntry && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-ink">{jobLogTitle}</p>
              {(effectiveIsAdmin || effectiveClockInFor !== 'self') && (
                <p className="text-sm mt-0.5 text-ink-muted">
                  {resolveEntryUserName(detailEntry)}
                </p>
              )}
            </div>

            {canEditEntry(detailEntry) ? (
              <>
                {detailModalError && (
                  <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
                    {detailModalError}
                  </Alert>
                )}
                <DateField
                  label="Date"
                  value={detailModalDate}
                  onChange={date => setDetailModalDate(date ?? '')}
                  placeholder="Select date"
                />
                <div className="flex flex-wrap items-end gap-2">
                  <TimeNumberInput
                    label="Start"
                    value={detailModalStart}
                    onChange={setDetailModalStart}
                  />
                  <span className="pb-2 text-ink-subtle">–</span>
                  <TimeNumberInput label="End" value={detailModalEnd} onChange={setDetailModalEnd} />
                </div>
                <p className="text-sm">
                  <span className="text-ink-muted">Duration{' '}</span>
                  <span className="font-mono font-medium tabular-nums text-accent-strong">
                    {detailModalDurationPreview ?? '—'}
                  </span>
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-ink-subtle">Notes</label>
                  <textarea
                    value={detailModalNotes}
                    onChange={e => setDetailModalNotes(e.target.value)}
                    placeholder="Optional"
                    rows={3}
                    className="resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle outline-none transition-[color,border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
                  />
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-sm tabular-nums text-ink">
                  {format(new Date(detailEntry.startTime), 'MMM d, yyyy • h:mm a')} –{' '}
                  {format(new Date(detailEntry.endTime), 'h:mm a')}
                </p>
                <p className="text-sm">
                  <span className="text-ink-muted">Duration{' '}</span>
                  <span className="font-mono font-medium tabular-nums text-accent-strong">
                    {entryDurationLabel(detailEntry)}
                  </span>
                </p>
                {detailEntry.notes?.trim() ? (
                  <p className="text-sm whitespace-pre-wrap text-ink">{detailEntry.notes}</p>
                ) : (
                  <p className="text-sm text-ink-subtle">No notes</p>
                )}
              </>
            )}
          </div>
        )}
      </AppModal>

      {/* User Selector Modal for Clocking In */}
      <AppModal
        isOpen={showUserSelector && availableUsersToClockIn.length > 0}
        onClose={() => {
          setShowUserSelector(false)
          setSelectedClockInUserId(null)
        }}
        title="Clock in for"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">Select which team member to clock in for:</p>
          {availableUsersToClockIn.length > 0 ? (
            <SelectField
              value={selectedClockInUserId || effectiveCurrentUserId || ''}
              onChange={e => {
                const userId = e.target.value
                setSelectedClockInUserId(userId || null)
              }}
              options={availableUsersToClockIn.map(u => ({
                value: u.id,
                label: u.id === effectiveCurrentUserId ? `${u.name} (You)` : u.name,
              }))}
            />
          ) : (
            <p className="text-sm text-ink-subtle">Loading team members...</p>
          )}
          <div className="flex gap-3 pt-4">
            <AppButton
              onClick={() => {
                const userId = selectedClockInUserId || effectiveCurrentUserId
                if (userId) {
                  handleStartTimer(userId)
                  setShowUserSelector(false)
                  setSelectedClockInUserId(null)
                }
              }}
              className="flex-1"
            >
              <PlayIcon className="h-4 w-4" />
              Start Timer
            </AppButton>
            <AppButton
              variant="subtle"
              onClick={() => {
                setShowUserSelector(false)
                setSelectedClockInUserId(null)
              }}
              className="flex-1"
            >
              Cancel
            </AppButton>
          </div>
        </div>
      </AppModal>

      <AppModal
        isOpen={showManualEntryModal}
        onClose={closeManualEntryModal}
        title="Add manual entry"
        size="sm"
        footer={
          <>
            <AppButton
              variant="ghost"
              size="sm"
              onClick={closeManualEntryModal}
              disabled={manualEntrySaving}
            >
              Cancel
            </AppButton>
            <AppButton
              size="sm"
              onClick={handleManualEntrySubmit}
              disabled={manualEntrySaving}
              isLoading={manualEntrySaving}
            >
              {manualEntrySaving ? 'Adding...' : 'Add entry'}
            </AppButton>
          </>
        }
      >
        <div className="space-y-4">
          {manualEntryError && (
            <Alert tone="danger" icon={<AlertIcon className="h-4 w-4" />}>
              {manualEntryError}
            </Alert>
          )}
          <DateField
            label="Date"
            value={manualEntryDate}
            onChange={date => setManualEntryDate(date ?? '')}
            placeholder="Select date"
          />
          {canClockInForOthers && (effectiveIsAdmin || availableUsersToClockIn.length > 1) && (
            <SelectField
              label="For"
              value={manualEntryUserId || effectiveCurrentUserId || ''}
              onChange={e => {
                const userId = e.target.value
                setManualEntryUserId(userId || null)
              }}
              options={availableUsersToClockIn.map(u => ({
                value: u.id,
                label: u.id === effectiveCurrentUserId ? `${u.name} (You)` : u.name,
              }))}
            />
          )}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-subtle">Start time</label>
              <div className="flex h-10 items-center rounded-lg border border-line bg-surface px-3 py-2">
                <TimeNumberInput value={manualEntryStart} onChange={setManualEntryStart} />
              </div>
            </div>
            <span className="self-center text-ink-subtle sm:self-end sm:pb-2">–</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-ink-subtle">End time</label>
              <div className="flex h-10 items-center rounded-lg border border-line bg-surface px-3 py-2">
                <TimeNumberInput value={manualEntryEnd} onChange={setManualEntryEnd} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-ink-subtle">Notes (optional)</label>
            <textarea
              value={manualEntryNotes}
              onChange={e => setManualEntryNotes(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle outline-none transition-[color,border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-soft)]"
            />
          </div>
        </div>
      </AppModal>

      {(() => {
        const te = descriptionModalId
          ? filteredEntries.find(t => t.id === descriptionModalId)
          : null
        const handleModalClose = () => {
          setDescriptionModalId(null)
          setDescriptionModalEditing(false)
        }
        const handleEditClick = () => {
          setModalEditNotes(te?.notes ?? '')
          setDescriptionModalEditing(true)
        }
        const handleModalSave = async () => {
          if (!te) return
          try {
            await updateTimeEntry(te.id, { notes: modalEditNotes || undefined }, jobLogId)
            setDescriptionModalEditing(false)
          } catch (e) {
            console.error(e)
          }
        }
        const displayNotes = descriptionModalEditing ? modalEditNotes : (te?.notes ?? '')
        return (
          <AppModal
            isOpen={descriptionModalId !== null}
            onClose={handleModalClose}
            title="Description"
            headerRight={
              te &&
              `${format(new Date(te.startTime), 'MMM d')} • ${format(new Date(te.startTime), 'h:mma')} – ${format(new Date(te.endTime), 'h:mma')}`
            }
            footer={
              descriptionModalEditing ? (
                <AppButton size="sm" onClick={handleModalSave}>
                  Save
                </AppButton>
              ) : (
                <AppButton variant="subtle" size="sm" onClick={handleEditClick}>
                  <PencilIcon className="h-4 w-4" />
                  Edit
                </AppButton>
              )
            }
          >
            <textarea
              ref={modalTextareaRef}
              value={displayNotes}
              onChange={e => setModalEditNotes(e.target.value)}
              readOnly={!descriptionModalEditing}
              placeholder="Add description"
              className="w-full min-h-[80px] resize-none whitespace-pre-wrap border-none bg-transparent p-0 text-base text-ink placeholder:text-ink-subtle focus:outline-none"
              style={{ font: 'inherit' }}
            />
          </AppModal>
        )
      })()}
    </div>
  )
}

export default TimeTracker
