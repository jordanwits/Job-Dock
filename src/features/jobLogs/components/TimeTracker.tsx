import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button, ConfirmationDialog, Modal, DatePicker, Select } from '@/components/ui'
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
  externalTimerState?: {
    isRunning: boolean
    start: Date | null
    elapsed: number
    onStart: (userId?: string) => void
    onStop: () => Promise<void>
  }
}

const TIMER_STORAGE_KEY = 'joblog-active-timer'

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
      setMinStr(isNaN(parsed) ? '' : String(parsed))
    }
  }, [value])

  const emit = (h: string, min: string, pm: boolean) => {
    const hour12 = parseInt(h, 10)
    const hasHour = h !== '' && !isNaN(hour12)
    const hasMin = min !== ''
    const minute = parseInt(min, 10) || 0
    if (hasHour && hasMin) {
      const h24 = pm ? (hour12 === 12 ? 12 : hour12 + 12) : hour12 === 12 ? 0 : hour12
      onChange(`${h24}`.padStart(2, '0') + ':' + `${minute}`.padStart(2, '0'))
    } else {
      onChange(`${h}:${min}`)
    }
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    setHourStr(raw)
    emit(raw, minStr, isPM)
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2)
    setMinStr(raw)
    emit(hourStr, raw, isPM)
  }

  const toggleAMPM = () => {
    setIsPM(prev => !prev)
    emit(hourStr, minStr, !isPM)
  }

  const base =
    'bg-transparent text-primary-light focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
  const inputSize = 'h-9 w-7 min-w-0 px-0 py-1 text-base sm:text-sm text-center'
  return (
    <div className="flex flex-col gap-0.5">
      {label && <span className="text-xs font-medium text-primary-light/60">{label}</span>}
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
        <span className="text-primary-light/50 shrink-0">:</span>
        <input
          type="text"
          inputMode="numeric"
          value={minStr && !isNaN(parseInt(minStr, 10)) ? String(parseInt(minStr, 10)).padStart(2, '0') : minStr}
          onChange={handleMinuteChange}
          className={cn(base, inputSize)}
          placeholder="min"
          aria-label={label ? `${label} minute` : undefined}
        />
        <button
          type="button"
          onClick={toggleAMPM}
          className={cn(
            base,
            'h-9 w-7 min-w-0 px-0.5 py-1 text-xs font-medium shrink-0 self-end',
            isPM ? 'text-primary-gold' : 'text-primary-light/70'
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
  externalTimerState,
}: TimeTrackerProps) => {
  const { createTimeEntry, updateTimeEntry, deleteTimeEntry } = useJobLogStore()
  const { user } = useAuthStore()
  const effectiveIsAdmin = isAdmin ?? (user?.role === 'admin' || user?.role === 'owner')
  const effectiveCurrentUserId = currentUserId ?? user?.id
  
  // Internal timer state (only used if externalTimerState is not provided)
  const [internalIsTimerRunning, setInternalIsTimerRunning] = useState(() => {
    if (externalTimerState) return false
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY)
      if (!stored) return false
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLogId && startTime
    } catch {
      return false
    }
  })
  const [internalTimerStart, setInternalTimerStart] = useState<Date | null>(() => {
    if (externalTimerState) return null
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY)
      if (!stored) return null
      const { jobLogId: storedId, startTime } = JSON.parse(stored)
      return storedId === jobLogId && startTime ? new Date(startTime) : null
    } catch {
      return null
    }
  })
  const [internalElapsedSeconds, setInternalElapsedSeconds] = useState(0)

  // Use external timer state if provided, otherwise use internal state
  const isTimerRunning = externalTimerState ? externalTimerState.isRunning : internalIsTimerRunning
  const timerStart = externalTimerState ? externalTimerState.start : internalTimerStart
  const elapsedSeconds = externalTimerState ? externalTimerState.elapsed : internalElapsedSeconds

  // Filter entries for employees, show all for admins
  const filteredEntries = useMemo(() => {
    if (effectiveIsAdmin) {
      return timeEntries
    }
    // Employee view: only show their own entries
    return timeEntries.filter(te => te.userId === effectiveCurrentUserId)
  }, [timeEntries, effectiveIsAdmin, effectiveCurrentUserId])

  // Permission helpers (backend enforces permissions, these are for UX)
  const canEditEntry = useCallback((entry: TimeEntry): boolean => {
    if (effectiveIsAdmin) return true
    if (!effectiveCurrentUserId) return false
    // Employees can edit their own entries
    return entry.userId === effectiveCurrentUserId
  }, [effectiveIsAdmin, effectiveCurrentUserId])

  const canClockFor = useCallback((targetUserId?: string): boolean => {
    if (effectiveIsAdmin) return true
    if (!effectiveCurrentUserId || !targetUserId) return false
    // Employees can clock in for themselves
    if (targetUserId === effectiveCurrentUserId) return true
    // For clocking in others, check if current user has a role with permissions
    // Backend will enforce actual permissions
    const currentUserAssignment = assignedTo?.find(a => a.userId === effectiveCurrentUserId)
    // If user has a roleId, they might have permissions (backend will check)
    return !!currentUserAssignment?.roleId
  }, [effectiveIsAdmin, effectiveCurrentUserId, assignedTo])

  // Group entries by user for admin view
  const entriesByUser = useMemo(() => {
    if (!effectiveIsAdmin) return null
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
  }, [filteredEntries, effectiveIsAdmin, effectiveCurrentUserId, assignedTo])
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
  const [teamMembersLoading, setTeamMembersLoading] = useState(true)
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
  }, [])

  // Get available users to clock in for based on permissions
  const availableUsersToClockIn = useMemo(() => {
    if (effectiveIsAdmin) {
      // Admins can clock in for anyone
      return teamMembers
    }
    if (!effectiveCurrentUserId || !assignedTo) return []
    
    const currentUserAssignment = assignedTo.find(a => a.userId === effectiveCurrentUserId)
    if (!currentUserAssignment?.roleId) {
      // No roleId - can only clock in for self
      return teamMembers.filter(u => u.id === effectiveCurrentUserId)
    }

    // For now, we'll check permissions on the backend
    // Frontend: show all assigned users (backend will enforce permissions)
    const assignedUserIds = new Set(assignedTo.map(a => a.userId))
    return teamMembers.filter(u => assignedUserIds.has(u.id))
  }, [effectiveIsAdmin, effectiveCurrentUserId, assignedTo, teamMembers])

  // Check if user can clock in for others
  const canClockInForOthers = useMemo(() => {
    if (effectiveIsAdmin) return true
    if (!effectiveCurrentUserId || !assignedTo) return false
    const currentUserAssignment = assignedTo.find(a => a.userId === effectiveCurrentUserId)
    return !!currentUserAssignment?.roleId
  }, [effectiveIsAdmin, effectiveCurrentUserId, assignedTo])

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

  const handleStartTimer = (userId?: string) => {
    const targetUserId = userId || effectiveCurrentUserId
    if (externalTimerState) {
      externalTimerState.onStart(targetUserId)
      return
    }
    const start = new Date()
    setInternalTimerStart(start)
    setInternalIsTimerRunning(true)
    setSelectedClockInUserId(targetUserId || null)
    try {
      localStorage.setItem(
        TIMER_STORAGE_KEY,
        JSON.stringify({
          jobLogId,
          startTime: start.toISOString(),
          userId: targetUserId,
        })
      )
    } catch {
      // ignore
    }
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
    if (externalTimerState) {
      await externalTimerState.onStop()
      return
    }
    // Use localStorage as source of truth for start time (survives navigation/refresh)
    let startTime: string
    let storedUserId: string | undefined
    try {
      const stored = localStorage.getItem(TIMER_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const { jobLogId: storedId, startTime: storedStart, userId: storedUser } = parsed
        if (storedId === jobLogId && storedStart) {
          startTime = storedStart
          storedUserId = storedUser
        } else if (internalTimerStart) {
          startTime = internalTimerStart.toISOString()
        } else {
          return
        }
      } else if (internalTimerStart) {
        startTime = internalTimerStart.toISOString()
      } else {
        return
      }
    } catch {
      if (!internalTimerStart) return
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
    } finally {
      setInternalIsTimerRunning(false)
      setInternalTimerStart(null)
      setInternalElapsedSeconds(0)
      setSelectedClockInUserId(null)
      try {
        localStorage.removeItem(TIMER_STORAGE_KEY)
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

  // Helper function to render a single time entry row
  const renderTimeEntryRow = (te: TimeEntry, index: number) => (
    <div
      key={te.id}
      className={cn(
        'flex gap-2 sm:gap-3 py-2 px-3 rounded-lg bg-primary-dark/30 border border-primary-blue/30 hover:bg-primary-dark/40 transition-colors',
        inlineTimeEditId === te.id
          ? 'flex-col sm:flex-row sm:flex-nowrap sm:items-center'
          : 'flex-nowrap items-center overflow-x-auto'
      )}
    >
      {/* Index + Job title + Team member (admin) + Notes */}
      <div className="flex items-center gap-2 min-w-0 flex-1 w-full sm:w-auto">
        <div className="w-8 h-8 flex items-center justify-center rounded border border-primary-blue/50 bg-primary-dark/50 text-xs font-medium text-primary-light/80 shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
          {effectiveIsAdmin && te.userName && (
            <>
              <span className="text-sm font-medium text-primary-light/70 shrink-0">
                {te.userName}
              </span>
              <span className="text-primary-light/50 shrink-0 hidden sm:inline">–</span>
            </>
          )}
          <span className="font-semibold text-base text-primary-light truncate">{jobLogTitle}</span>
          <span className="text-primary-light/50 shrink-0 hidden sm:inline">–</span>
          {inlineEditId === te.id ? (
            canEditEntry(te) ? (
              <input
                type="text"
                value={inlineNotes}
                onChange={e => setInlineNotes(e.target.value)}
                onBlur={() => handleInlineNotesSave(te)}
                onKeyDown={e => e.key === 'Enter' && handleInlineNotesSave(te)}
                placeholder="Add description"
                className="flex-1 min-w-0 bg-transparent text-sm text-primary-light placeholder:text-primary-light/40 focus:outline-none focus:ring-0"
                autoFocus
              />
            ) : (
              <span className="flex-1 min-w-0 text-sm text-primary-light/80 truncate">
                {te.notes || ''}
              </span>
            )
          ) : (
            <button
              type="button"
              onClick={() => {
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
                "flex-1 min-w-0 text-left text-sm text-primary-light/80 hover:text-primary-light truncate",
                !canEditEntry(te) && "cursor-default opacity-60"
              )}
            >
              {te.notes || <span className="text-primary-light/40">Add description</span>}
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
              className="flex flex-col sm:flex-row sm:items-center gap-2 w-full min-w-0 p-2 sm:p-0 rounded-lg sm:rounded-none bg-primary-dark/50 sm:bg-transparent border border-primary-blue/30 sm:border-0"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex flex-row items-start gap-2 flex-wrap">
                <div className="min-w-[280px]">
                  <DatePicker
                    label="Date"
                    value={inlineEditDate}
                    onChange={date => setInlineEditDate(date ?? '')}
                    placeholder="Select date"
                  />
                </div>
                <div className="flex flex-col gap-0.5 items-start">
                  <span className="text-xs font-medium text-primary-light/60">Start</span>
                  <TimeNumberInput value={inlineStartTime} onChange={setInlineStartTime} />
                </div>
                <span className="text-primary-light/50 self-end pb-1">–</span>
                <div className="flex flex-col gap-0.5 items-start">
                  <span className="text-xs font-medium text-primary-light/60">End</span>
                  <TimeNumberInput value={inlineEndTime} onChange={setInlineEndTime} />
                </div>
              </div>
              {timeEditError && <p className="text-sm text-red-400">{timeEditError}</p>}
              <div className="flex gap-2 sm:gap-1 pt-0.5 sm:pt-0 border-t border-primary-blue/20 sm:border-0">
                <button
                  type="button"
                  onClick={() => handleInlineTimeSave(te)}
                  className="flex-1 sm:flex-none px-4 py-2 sm:px-2 sm:py-1 text-sm font-medium text-primary-dark bg-primary-gold hover:bg-primary-gold/90 rounded-lg transition-colors"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInlineTimeEditId(null)
                    setTimeEditError(null)
                  }}
                  className="flex-1 sm:flex-none px-4 py-2 sm:px-2 sm:py-1 text-sm text-primary-light/80 hover:text-primary-light rounded-lg border border-primary-blue/50 hover:border-primary-blue"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            canEditEntry(te) ? (
              <button
                type="button"
                onClick={() => beginTimeEdit(te)}
                className="text-sm text-primary-light/80 hover:text-primary-light hover:underline hidden sm:inline-block"
              >
                {format(new Date(te.startTime), 'MMM d')} • {format(new Date(te.startTime), 'h:mma')} – {format(new Date(te.endTime), 'h:mma')}
              </button>
            ) : (
              <span className="text-sm text-primary-light/80 hidden sm:inline-block">
                {format(new Date(te.startTime), 'MMM d')} • {format(new Date(te.startTime), 'h:mma')} – {format(new Date(te.endTime), 'h:mma')}
              </span>
            )
          )}
        </div>

        {/* Date on mobile (time range hidden) */}
        <span className="text-xs text-primary-light/60 shrink-0 sm:hidden">
          {format(new Date(te.startTime), 'MMM d')}
        </span>

        {/* Duration */}
        <div className="w-24 shrink-0 text-right flex flex-col items-end gap-0.5">
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
                className="w-full text-sm font-medium text-primary-light bg-transparent px-2 py-1 text-right focus:outline-none focus:ring-0 font-mono tabular-nums"
                autoFocus
              />
              {durationError && (
                <p className="text-xs text-red-400 text-right max-w-[140px]">{durationError}</p>
              )}
            </>
          ) : (
            canEditEntry(te) ? (
              <button
                type="button"
                onClick={() => beginDurationEdit(te)}
                className="text-sm font-medium text-primary-light hover:text-primary-gold hover:underline w-full text-right"
              >
                {formatDuration(te)}
              </button>
            ) : (
              <span className="text-sm font-medium text-primary-light w-full text-right">
                {formatDuration(te)}
              </span>
            )
          )}
        </div>

        {/* Kebab menu */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={e => {
              menuButtonRef.current = e.currentTarget
              setOpenMenuId(openMenuId === te.id ? null : te.id)
            }}
            className="p-1 rounded hover:bg-primary-dark text-primary-light/60 hover:text-primary-light"
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
                  onClick={() => setOpenMenuId(null)}
                  aria-hidden
                />
                <div
                  className="fixed z-[101] py-1 rounded-lg bg-primary-dark-secondary border border-primary-blue shadow-xl min-w-[140px]"
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
                        onClick={() => {
                          setOpenMenuId(null)
                          beginTimeEdit(te)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-primary-light hover:bg-primary-blue/10"
                      >
                        Edit times
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null)
                          handleDeleteClick(te.id)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-500/10"
                      >
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

  return (
    <div className="space-y-4">
      {/* Header: Today | Total */}
      <div className="flex items-center justify-between border-b border-primary-blue/50 pb-3">
        <span className="text-sm font-medium text-primary-light/80">
          {effectiveIsAdmin ? 'All Time Entries' : 'My Time Entries'}
        </span>
        <div className="flex items-center gap-2">
          {filteredEntries.length > 0 && (
            <span className="text-sm text-primary-light/80">
              {effectiveIsAdmin ? 'Overall Total' : 'Total'}:{' '}
              <span className="font-medium text-primary-gold">{totalFormatted}</span>
            </span>
          )}
          <Button variant="outline" size="sm" onClick={openManualEntryModal}>
            Add entry
          </Button>
        </div>
      </div>

      {/* Timer */}
      <div className="flex flex-nowrap items-center gap-4">
        {!isTimerRunning ? (
          <Button onClick={handleStartTimerClick} size="sm">
            Start Job
          </Button>
        ) : (
          <div className="flex items-center gap-4">
            {selectedClockInUserId && selectedClockInUserId !== effectiveCurrentUserId && (
              <span className="text-sm text-primary-light/70">
                For: {teamMembers.find(u => u.id === selectedClockInUserId)?.name || 'Unknown'}
              </span>
            )}
            <span className="text-2xl font-mono text-primary-gold tabular-nums">
              {formatElapsed(elapsedSeconds)}
            </span>
            <Button onClick={handleStopTimer} variant="outline" size="sm">
              Stop
            </Button>
          </div>
        )}
      </div>

      {/* Time entries list */}
      {effectiveIsAdmin && entriesByUser && entriesByUser.length > 0 ? (
        // Admin view: grouped by team member
        <div className="space-y-4">
          {entriesByUser.map((group, groupIndex) => {
            const memberTotalSeconds = calculateTotalSeconds(group.entries)
            const memberTotalFormatted = formatTotal(memberTotalSeconds)
            const userId = group.userId
            const assignment = userId ? assignedTo?.find(a => a.userId === userId) : undefined
            const payType = assignment?.payType || 'job'
            const hourlyRate = assignment?.hourlyRate
            const totalHours = memberTotalSeconds / 3600
            const earned = payType === 'hourly' && hourlyRate != null && !isNaN(hourlyRate)
              ? totalHours * hourlyRate
              : null
            return (
              <div key={groupIndex} className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-primary-blue/30 pb-2">
                  <span className="text-sm font-semibold text-primary-light">{group.userName}</span>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm text-primary-light/80">
                      Total:{' '}
                      <span className="font-medium text-primary-gold">{memberTotalFormatted}</span>
                    </span>
                    {earned != null && (
                      <span className="text-xs text-primary-gold/90">
                        Earned: ${earned.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
        // Employee view: simple list
        <div className="space-y-1">
          {filteredEntries.map((te, index) => renderTimeEntryRow(te, index))}
        </div>
      ) : null}

      <ConfirmationDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Time Entry"
        message="Are you sure you want to delete this time entry?"
        confirmText="Delete"
        confirmVariant="danger"
      />

      {/* User Selector Modal for Clocking In */}
      <Modal
        isOpen={showUserSelector && availableUsersToClockIn.length > 0}
        onClose={() => {
          setShowUserSelector(false)
          setSelectedClockInUserId(null)
        }}
        title="Clock In For"
      >
        <div className="space-y-4">
          <p className="text-sm text-primary-light/70">
            Select which team member to clock in for:
          </p>
          {availableUsersToClockIn.length > 0 ? (
            <Select
              value={selectedClockInUserId || effectiveCurrentUserId || ''}
              onChange={(e) => {
                const userId = e.target.value
                setSelectedClockInUserId(userId || null)
              }}
              options={availableUsersToClockIn.map(u => ({
                value: u.id,
                label: u.id === effectiveCurrentUserId ? `${u.name} (You)` : u.name,
              }))}
            />
          ) : (
            <p className="text-sm text-primary-light/50">Loading team members...</p>
          )}
          <div className="flex gap-3 pt-4">
            <Button
              variant="primary"
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
              Start Timer
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setShowUserSelector(false)
                setSelectedClockInUserId(null)
              }}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showManualEntryModal}
        onClose={closeManualEntryModal}
        title="Add Manual Entry"
        size="md"
        footer={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={closeManualEntryModal} disabled={manualEntrySaving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleManualEntrySubmit} disabled={manualEntrySaving}>
              {manualEntrySaving ? 'Adding...' : 'Add Entry'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {manualEntryError && (
            <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{manualEntryError}</p>
          )}
          <DatePicker
            label="Date"
            value={manualEntryDate}
            onChange={date => setManualEntryDate(date ?? '')}
            placeholder="Select date"
          />
          {canClockInForOthers && availableUsersToClockIn.length > 1 && (
            <Select
              label="For"
              value={manualEntryUserId || effectiveCurrentUserId || ''}
              onChange={(e) => {
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
              <label className="text-xs font-medium text-primary-light/60">Start time</label>
              <div className="h-10 rounded-lg border border-primary-blue bg-primary-blue/10 px-3 py-2 flex items-center">
                <TimeNumberInput value={manualEntryStart} onChange={setManualEntryStart} />
              </div>
            </div>
            <span className="text-primary-light/50 self-center sm:self-end sm:pb-2">–</span>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-primary-light/60">End time</label>
              <div className="h-10 rounded-lg border border-primary-blue bg-primary-blue/10 px-3 py-2 flex items-center">
                <TimeNumberInput value={manualEntryEnd} onChange={setManualEntryEnd} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-primary-light/60">Notes (optional)</label>
            <textarea
              value={manualEntryNotes}
              onChange={e => setManualEntryNotes(e.target.value)}
              placeholder="Add description"
              rows={3}
              className="rounded-lg border border-primary-blue bg-primary-blue/10 px-3 py-2 text-sm text-primary-light placeholder:text-primary-light/40 focus:outline-none focus:ring-2 focus:ring-primary-gold focus:border-primary-gold resize-none"
            />
          </div>
        </div>
      </Modal>

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
          <Modal
            isOpen={descriptionModalId !== null}
            onClose={handleModalClose}
            title="Description"
            headerRight={
              te &&
              `${format(new Date(te.startTime), 'MMM d')} • ${format(new Date(te.startTime), 'h:mma')} – ${format(new Date(te.endTime), 'h:mma')}`
            }
            footer={
              descriptionModalEditing ? (
                <Button size="sm" onClick={handleModalSave}>
                  Save
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleEditClick}>
                  Edit
                </Button>
              )
            }
          >
            <textarea
              ref={modalTextareaRef}
              value={displayNotes}
              onChange={e => setModalEditNotes(e.target.value)}
              readOnly={!descriptionModalEditing}
              placeholder="Add description"
              className="w-full min-h-[80px] p-0 bg-transparent text-primary-light placeholder:text-primary-light/40 focus:outline-none border-none resize-none whitespace-pre-wrap text-base"
              style={{ font: 'inherit' }}
            />
          </Modal>
        )
      })()}
    </div>
  )
}

export default TimeTracker
