import { useState, useEffect, useRef, useCallback } from 'react'
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addDays,
  subDays,
  startOfDay,
  getHours,
  getMinutes,
  setHours,
  setMinutes,
  addMinutes,
} from 'date-fns'
import { cn } from '@/lib/utils'
import type { Job } from '../types/job'
import { useJobStore } from '../store/jobStore'
import NotifyClientModal from './NotifyClientModal'
import type { User } from '@/features/auth'
import { getErrorMessage } from '@/lib/utils/errorHandler'
import { ChevronLeftIcon, ChevronRightIcon } from './schedulingUi'
import { resolveJobStatus, eventToneCls, type Tone } from './schedulingStatus'

/** Stable empty default so the `paidInvoiceIds` prop never churns identity when omitted. */
const EMPTY_PAID_SET: Set<string> = new Set()

/**
 * Small solid-green check badge marking a calendar event whose linked invoice is fully paid.
 * Size and position come from `className`; the check glyph fills the badge.
 */
const PaidCheck = ({ className }: { className?: string }) => (
  <span
    role="img"
    aria-label="Paid"
    title="Paid"
    className={cn(
      'inline-flex shrink-0 items-center justify-center rounded-full bg-success text-white',
      className
    )}
  >
    <svg viewBox="0 0 24 24" fill="none" className="h-[70%] w-[70%]" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
)

/**
 * Hover-revealed "confirm" affordance on an unconfirmed (pending-confirmation) event chip.
 * Clicking it flips the appointment to confirmed. `onPointerDown` stops propagation so pressing
 * the button never starts a drag; keyboard focus reveals it too.
 */
const ConfirmChipButton = ({ onConfirm }: { onConfirm: () => void }) => (
  <button
    type="button"
    title="Confirm appointment"
    aria-label="Confirm appointment"
    onPointerDown={e => e.stopPropagation()}
    onClick={e => {
      e.stopPropagation()
      onConfirm()
    }}
    className="absolute right-1 top-1 z-20 inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface/90 text-warning opacity-0 shadow-sm ring-1 ring-inset ring-warning/40 backdrop-blur-sm transition-opacity hover:bg-success hover:text-white hover:ring-success focus-visible:opacity-100 group-hover:opacity-100"
  >
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M5 13l4 4L19 7"
        stroke="currentColor"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
)

interface CalendarProps {
  jobs: Job[]
  viewMode: 'day' | 'week' | 'month'
  currentDate: Date
  onDateChange: (date: Date) => void
  onViewModeChange: (mode: 'day' | 'week' | 'month') => void
  onJobClick: (job: Job) => void
  onDateClick: (date: Date) => void
  onUnscheduledDrop?: (jobId: string, targetDate: Date, targetHour?: number, bookingId?: string) => void
  /** Confirm an unconfirmed (pending-confirmation) appointment straight from its calendar chip. */
  onConfirmJob?: (job: Job) => void
  onUpdateSuccess?: (message: string) => void
  /** When scheduling updates fail (e.g. permissions), surface a message instead of failing silently */
  onUpdateError?: (message: string) => void
  /** IDs of invoices whose paymentStatus is 'paid'. A job whose invoiceId is in this set shows a paid check. */
  paidInvoiceIds?: Set<string>
  user?: User | null
}

interface DragState {
  job: Job | null
  type: 'move' | 'resize' | 'month-move' | 'week-all-day-move' | null
  startY: number
  startX: number
  grabOffsetY: number // Pointer offset from top of card on drag start (aligns drop time with UI)
  slotHeight: number // Actual rendered slot height at drag start (for accurate mobile calculations)
  isDragging: boolean
  hasMoved: boolean // Track if pointer has moved at all (even < 5px)
  originalStartTime: Date | null
  originalEndTime: Date | null
  pointerId?: number
}

const Calendar = ({
  jobs,
  viewMode,
  currentDate,
  onDateChange,
  onViewModeChange,
  onJobClick,
  onDateClick,
  onUnscheduledDrop,
  onConfirmJob,
  onUpdateSuccess,
  onUpdateError,
  paidInvoiceIds = EMPTY_PAID_SET,
  user,
}: CalendarProps) => {
  const reportScheduleUpdateError = useCallback(
    (err: unknown, fallback: string) => {
      onUpdateError?.(getErrorMessage(err, fallback))
    },
    [onUpdateError]
  )

  const canUserEditJob = useCallback((job: Job): boolean => {
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
  }, [user])

  // Token dot fill per tone (mobile month-view dots).
  const dotToneCls: Record<Tone, string> = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    info: 'bg-info',
    neutral: 'bg-ink-subtle',
  }

  // Resolve a job's event-chip styling from its status tone (token-driven).
  // `chip` carries the soft fill + text + hairline ring (applied to every event
  // chip); `dot` is the solid token fill used for the compact mobile month dots.
  const getJobColors = (job: Job) => {
    const { tone } = resolveJobStatus(job.status)
    return {
      tone,
      chip: eventToneCls[tone],
      dot: dotToneCls[tone],
    }
  }

  // A job counts as paid when its linked invoice is fully paid (partial does not qualify).
  const isJobPaid = useCallback(
    (job: Job): boolean => !!(job.invoiceId && paidInvoiceIds.has(job.invoiceId)),
    [paidInvoiceIds]
  )
  // Set initial scale based on screen size
  const getInitialScale = () => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768 ? 100 : 125
    }
    return 125
  }

  const [selectedDate, setSelectedDate] = useState(currentDate)
  const [calendarScale, setCalendarScale] = useState<number>(getInitialScale())
  const [viewportHeight, setViewportHeight] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return window.innerHeight
    }
    return 800
  })
  const [calendarContainerHeight, setCalendarContainerHeight] = useState<number | null>(null)
  const [dragState, setDragState] = useState<DragState>({
    job: null,
    type: null,
    startY: 0,
    startX: 0,
    grabOffsetY: 0,
    slotHeight: 60,
    isDragging: false,
    hasMoved: false,
    originalStartTime: null,
    originalEndTime: null,
  })
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)
  const [previewEndTime, setPreviewEndTime] = useState<Date | null>(null)
  const [previewStartTime, setPreviewStartTime] = useState<Date | null>(null)
  const [dragTargetDay, setDragTargetDay] = useState<Date | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [dragGhost, setDragGhost] = useState<{
    isVisible: boolean
    x: number
    y: number
    width: number
    height: number
    offsetX: number
    offsetY: number
  } | null>(null)
  const weekColumnsRef = useRef<Map<number, DOMRect>>(new Map())
  const dayViewRef = useRef<HTMLDivElement | null>(null)
  const weekViewRef = useRef<HTMLDivElement | null>(null)
  const monthViewRef = useRef<HTMLDivElement | null>(null)
  const dragOriginRef = useRef<HTMLElement | null>(null)
  const isDraggingRef = useRef(false) // True only after crossing drag threshold
  const justDraggedRef = useRef(false) // Used to suppress the post-drag click
  const [justFinishedDrag, setJustFinishedDrag] = useState(false) // Disable transitions after drop
  const [showNotifyClientModal, setShowNotifyClientModal] = useState(false)
  // Guards the notify modal's Yes/No/close handlers against firing twice in the
  // same tick (double-click before the close re-renders), which double-fired the
  // update and double-sent client notifications. Reset on each open.
  const notifyHandledRef = useRef(false)
  const [pendingUpdatePayload, setPendingUpdatePayload] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (showNotifyClientModal) notifyHandledRef.current = false
  }, [showNotifyClientModal])
  // Mobile day-view slide transition (from month view).
  // The sheet mounts on top of the month view and slides up. When the animation
  // completes we commit the real viewMode='day' via onDateClick and unmount the
  // sheet in the same React batch — the underlying day view replaces the sheet
  // with identical DOM (same renderDayView + same date), so the swap is seamless.
  const [mobileDaySheetMounted, setMobileDaySheetMounted] = useState(false)
  const [mobileDaySheetOpen, setMobileDaySheetOpen] = useState(false)
  const openMobileDaySheet = (day: Date) => {
    setSelectedDate(day)
    setMobileDaySheetMounted(true)
    requestAnimationFrame(() => setMobileDaySheetOpen(true))
    setTimeout(() => {
      onDateClick(day)
      setMobileDaySheetMounted(false)
      setMobileDaySheetOpen(false)
    }, 320)
  }

  const { updateJob, updateIndependentBooking } = useJobStore()

  // Update scale and viewport height when window is resized
  useEffect(() => {
    let wasMobile = window.innerWidth < 768
    // Initial values
    setCalendarScale(wasMobile ? 100 : 125)
    setViewportHeight(window.innerHeight)

    const handleResize = () => {
      const isMobile = window.innerWidth < 768
      // Only reset the zoom when crossing the mobile/desktop breakpoint — an ordinary window
      // resize must not discard the zoom level the user picked.
      if (isMobile !== wasMobile) {
        setCalendarScale(isMobile ? 100 : 125)
        wasMobile = isMobile
      }
      setViewportHeight(window.innerHeight)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Measure calendar container height when it's available
  useEffect(() => {
    if (!monthViewRef.current || viewMode !== 'month') return

    const measureContainer = () => {
      if (monthViewRef.current) {
        const rect = monthViewRef.current.getBoundingClientRect()
        setCalendarContainerHeight(rect.height)
      }
    }

    // Initial measurement
    measureContainer()

    // Use ResizeObserver to track calendar container size changes
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(measureContainer)
      resizeObserver.observe(monthViewRef.current)
    }

    // Also measure on window resize
    window.addEventListener('resize', measureContainer)

    return () => {
      window.removeEventListener('resize', measureContainer)
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    }
  }, [viewMode])

  // Disable text selection globally when dragging
  useEffect(() => {
    if (dragState.isDragging) {
      document.body.style.userSelect = 'none'
      document.body.style.webkitUserSelect = 'none'
      return () => {
        document.body.style.userSelect = ''
        document.body.style.webkitUserSelect = ''
      }
    }
  }, [dragState.isDragging])

  useEffect(() => {
    setSelectedDate(currentDate)
  }, [currentDate])

  const navigateDate = (direction: 'prev' | 'next') => {
    let newDate: Date
    if (viewMode === 'day') {
      newDate = direction === 'next' ? addDays(selectedDate, 1) : subDays(selectedDate, 1)
    } else if (viewMode === 'week') {
      newDate = direction === 'next' ? addWeeks(selectedDate, 1) : subWeeks(selectedDate, 1)
    } else {
      newDate = direction === 'next' ? addMonths(selectedDate, 1) : subMonths(selectedDate, 1)
    }
    setSelectedDate(newDate)
    onDateChange(newDate)
  }

  const goToToday = () => {
    const today = new Date()
    setSelectedDate(today)
    onDateChange(today)
  }

  // Last calendar day an appointment actually OCCUPIES. An end time exactly at midnight
  // (00:00) is a boundary, not occupancy: a 10pm–midnight appointment belongs to one day
  // only. Without the -1ms it would be classified multi-day, rendered as an all-day bar, and
  // shown on a day it never touches.
  const lastOccupiedDay = (endTime: string): Date =>
    startOfDay(new Date(new Date(endTime).getTime() - 1))

  // Get jobs for a specific date (includes multi-day jobs that span this date)
  const getJobsForDate = (date: Date) => {
    return jobs.filter(job => {
      // Skip jobs without scheduled times
      if (!job.startTime || !job.endTime) return false

      const jobStartDate = startOfDay(new Date(job.startTime))
      const jobEndDate = lastOccupiedDay(job.endTime)
      const targetDate = startOfDay(date)

      // Check if the target date falls within the job's date range
      return targetDate >= jobStartDate && targetDate <= jobEndDate
    })
  }

  // Check if job spans multiple calendar days
  const isMultiDayJob = (job: Job): boolean => {
    if (!job.startTime || !job.endTime) return false
    const start = startOfDay(new Date(job.startTime))
    const end = lastOccupiedDay(job.endTime)
    return start.getTime() !== end.getTime()
  }

  // Get all dates a job spans within visible calendar range
  const getJobDateRange = (job: Job, calendarStart: Date, calendarEnd: Date): Date[] => {
    if (!job.startTime || !job.endTime) return []
    const jobStart = startOfDay(new Date(job.startTime))
    const jobEnd = lastOccupiedDay(job.endTime)
    const rangeStart = jobStart > calendarStart ? jobStart : calendarStart
    const rangeEnd = jobEnd < calendarEnd ? jobEnd : calendarEnd
    if (rangeStart > rangeEnd) return []
    return eachDayOfInterval({ start: rangeStart, end: rangeEnd })
  }

  // Get jobs active on a specific date (for day/week view)
  const getJobsActiveOnDate = (date: Date): Job[] => {
    return jobs.filter(job => {
      if (!job.startTime || !job.endTime) return false
      const jobStart = new Date(job.startTime)
      const jobEnd = new Date(job.endTime)
      const targetDate = startOfDay(date)
      const targetEnd = addDays(targetDate, 1)
      // Job is active if it overlaps with the target date
      return jobStart < targetEnd && jobEnd > targetDate
    })
  }

  // Get jobs for a time slot (for day/week view) - excludes multi-day jobs
  const getJobsForTimeSlot = (date: Date, hour: number) => {
    return jobs.filter(job => {
      // Skip jobs without scheduled times
      if (!job.startTime) return false
      // Skip multi-day jobs (they'll be shown as full-day bars)
      if (isMultiDayJob(job)) return false

      const jobDate = new Date(job.startTime)
      return isSameDay(jobDate, date) && getHours(jobDate) === hour
    })
  }

  // Check if two jobs overlap in time
  const jobsOverlap = (job1: Job, job2: Job): boolean => {
    // Jobs without times can't overlap
    if (!job1.startTime || !job1.endTime || !job2.startTime || !job2.endTime) return false

    const start1 = new Date(job1.startTime).getTime()
    const end1 = new Date(job1.endTime).getTime()
    const start2 = new Date(job2.startTime).getTime()
    const end2 = new Date(job2.endTime).getTime()
    return start1 < end2 && start2 < end1
  }

  // Calculate layout positions for overlapping jobs
  // A single job can surface as multiple rows: a recurring series shares one job id across all
  // its bookings, and a job can hold several bookings. `job.id` alone is therefore not unique
  // per row — collisions duplicate React keys and make the overlap-layout map put two bookings
  // in the same column. Disambiguate with the booking id (staged virtual chips have no bookingId
  // but already carry a unique synthetic id).
  const getRowKey = (job: Job) => (job.bookingId ? `${job.id}:${job.bookingId}` : job.id)

  const calculateJobLayout = (dayJobs: Job[]) => {
    const layout: { [key: string]: { column: number; totalColumns: number } } = {}

    // Filter to only jobs with times, then sort by start time, then by duration (longer first)
    const sortedJobs = [...dayJobs]
      .filter(
        (job): job is Job & { startTime: string; endTime: string } =>
          job.startTime !== null && job.endTime !== null
      )
      .sort((a, b) => {
        const startDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        if (startDiff !== 0) return startDiff
        const durationA = new Date(a.endTime).getTime() - new Date(a.startTime).getTime()
        const durationB = new Date(b.endTime).getTime() - new Date(b.startTime).getTime()
        return durationB - durationA
      })

    // Build overlap groups
    const groups: Job[][] = []
    sortedJobs.forEach(job => {
      let addedToGroup = false
      for (const group of groups) {
        if (group.some(groupJob => jobsOverlap(job, groupJob))) {
          group.push(job)
          addedToGroup = true
          break
        }
      }
      if (!addedToGroup) {
        groups.push([job])
      }
    })

    // Assign columns within each group
    groups.forEach(group => {
      const columns: Job[][] = []

      group.forEach(job => {
        let placed = false
        for (let i = 0; i < columns.length; i++) {
          const column = columns[i]
          const hasOverlap = column.some(colJob => jobsOverlap(job, colJob))
          if (!hasOverlap) {
            column.push(job)
            layout[getRowKey(job)] = { column: i, totalColumns: 0 }
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([job])
          layout[getRowKey(job)] = { column: columns.length - 1, totalColumns: 0 }
        }
      })

      // Update totalColumns for all jobs in the group
      group.forEach(job => {
        layout[getRowKey(job)].totalColumns = columns.length
      })
    })

    return layout
  }

  // Drag and drop handlers
  const handleDragStart = (
    e: React.PointerEvent,
    job: Job,
    type: 'move' | 'resize' | 'month-move' | 'week-all-day-move'
  ) => {
    e.stopPropagation()

    // Skip if job doesn't have scheduled times
    if (!job.startTime || !job.endTime) return

    // Start a *potential* drag. We'll only start the actual drag once we pass the threshold.
    dragOriginRef.current = e.currentTarget as HTMLElement
    isDraggingRef.current = false
    justDraggedRef.current = false

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const grabOffsetY = e.clientY - rect.top

    // Measure actual slot height at drag start for accurate mobile calculations
    // Find a time slot element and measure its actual rendered height
    let slotHeight = window.innerWidth < 768 ? 60 : 80 // Default fallback
    const timeSlotEl = document.querySelector('[data-drop-hour]') as HTMLElement
    if (timeSlotEl) {
      const measuredHeight = timeSlotEl.getBoundingClientRect().height
      if (measuredHeight > 0) {
        slotHeight = measuredHeight
      }
    }

    // Initialize drag ghost (fixed overlay that follows pointer) - only for move operations
    if (type === 'move' || type === 'week-all-day-move') {
      setDragGhost({
        isVisible: false,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
        offsetX: e.clientX - rect.left,
        offsetY: grabOffsetY,
      })
    } else {
      // Clear ghost for resize operations
      setDragGhost(null)
    }

    setDragState({
      job,
      type,
      startY: e.clientY,
      startX: e.clientX,
      grabOffsetY,
      slotHeight,
      isDragging: false, // Will be set to true when pointer moves beyond threshold
      hasMoved: false, // Track if pointer has moved at all
      originalStartTime: new Date(job.startTime),
      originalEndTime: new Date(job.endTime),
      pointerId: e.pointerId,
    })
    setDragOffset({ x: 0, y: 0 })
    // For week view, initialize target day
    if (type === 'move' || type === 'week-all-day-move') {
      setDragTargetDay(new Date(job.startTime))
    }
  }

  const handleMoveDrop = useCallback(
    async (finalStartTime?: Date) => {
      if (!dragState.job) return

      const { job, originalStartTime, originalEndTime } = dragState

      if (!canUserEditJob(job)) {
        reportScheduleUpdateError(null, 'You can only edit jobs you are assigned to')
        isDraggingRef.current = false
        dragOriginRef.current = null
        setJustFinishedDrag(true)
        setDragGhost(null)
        setDragState({ job: null, type: null, startY: 0, startX: 0, grabOffsetY: 0, slotHeight: 60, isDragging: false, hasMoved: false, originalStartTime: null, originalEndTime: null })
        setDragTargetDay(null)
        setTimeout(() => setJustFinishedDrag(false), 50)
        return
      }

      try {
        const originalStart = new Date(originalStartTime!)
        const originalEnd = new Date(originalEndTime!)
        const duration = originalEnd.getTime() - originalStart.getTime()

        // Calculate new start time from preview or original
        let newStartTime: Date
        if (finalStartTime) {
          newStartTime = new Date(finalStartTime)
        } else if (previewStartTime) {
          // Use preview time (vertical drag for day/week view)
          newStartTime = new Date(previewStartTime)
        } else {
          newStartTime = new Date(originalStart)
        }

        // For week view: use dragTargetDay if dragged to different day
        if (dragTargetDay && !isSameDay(dragTargetDay, originalStart)) {
          newStartTime = setHours(
            setMinutes(dragTargetDay, getMinutes(newStartTime)),
            getHours(newStartTime)
          )
        }

        const newEndTime = new Date(newStartTime.getTime() + duration)

        // Only update if something actually changed
        if (newStartTime.getTime() !== originalStart.getTime()) {
          const hasContact = !!(job.contactId && job.contactId.trim())
          if (job.isIndependent && !hasContact) {
            updateIndependentBooking(job.id, {
              startTime: newStartTime.toISOString(),
              endTime: newEndTime.toISOString(),
            }).catch(err =>
              reportScheduleUpdateError(err, 'Could not reschedule this appointment. If this keeps happening, ask an admin to check your permissions.')
            )
          } else {
            const payload: { id: string; startTime: string; endTime: string; bookingId?: string; isIndependent?: boolean } = {
              id: job.id,
              startTime: newStartTime.toISOString(),
              endTime: newEndTime.toISOString(),
            }
            if (job.bookingId) payload.bookingId = job.bookingId
            if (job.isIndependent) payload.isIndependent = true
            setPendingUpdatePayload(payload)
            setShowNotifyClientModal(true)
          }
        }
      } catch (error) {
        reportScheduleUpdateError(error, 'Could not move this job on the calendar.')
      }

      // Clear drag state and preview
      isDraggingRef.current = false
      dragOriginRef.current = null
      setJustFinishedDrag(true)
      setDragGhost(null) // Clear ghost immediately
      setDragState({
        job: null,
        type: null,
        startY: 0,
        startX: 0,
        grabOffsetY: 0,
        slotHeight: 60,
        isDragging: false,
        hasMoved: false,
        originalStartTime: null,
        originalEndTime: null,
      })
      setPreviewStartTime(null)
      setPreviewEndTime(null)
      setDragOverDate(null)
      setDragTargetDay(null)

      // Re-enable transitions after a brief delay (allows card to appear at new position without animation)
      setTimeout(() => {
        setJustFinishedDrag(false)
      }, 100)
    },
    [dragState, previewStartTime, dragTargetDay, reportScheduleUpdateError]
  )

  const handleResizeDrop = useCallback(
    async (minutesChange: number) => {
      if (!dragState.job || dragState.type !== 'resize' || !dragState.job.startTime) return

      const { job, originalEndTime } = dragState

      if (!canUserEditJob(job)) {
        reportScheduleUpdateError(null, 'You can only edit jobs you are assigned to')
        isDraggingRef.current = false
        dragOriginRef.current = null
        setJustFinishedDrag(true)
        setDragState({ job: null, type: null, startY: 0, startX: 0, grabOffsetY: 0, slotHeight: 60, isDragging: false, hasMoved: false, originalStartTime: null, originalEndTime: null })
        setDragTargetDay(null)
        setTimeout(() => setJustFinishedDrag(false), 50)
        return
      }

      try {
        // Snap to 15-minute increments
        const snappedMinutesChange = Math.round(minutesChange / 15) * 15
        const newEndTime = addMinutes(new Date(originalEndTime!), snappedMinutesChange)

        // Ensure end time is after start time (at least 15 minutes)
        const startTime = new Date(job.startTime!)
        if (newEndTime <= startTime) return

        const hasContact = !!(job.contactId && job.contactId.trim())
        if (job.isIndependent && !hasContact) {
          updateIndependentBooking(job.id, {
            startTime: job.startTime ?? undefined,
            endTime: newEndTime.toISOString(),
          }).catch(err =>
            reportScheduleUpdateError(err, 'Could not update this appointment. If this keeps happening, ask an admin to check your permissions.')
          )
        } else {
          const payload: { id: string; endTime: string; startTime?: string; bookingId?: string; isIndependent?: boolean } = {
            id: job.id,
            endTime: newEndTime.toISOString(),
            startTime: job.startTime ?? undefined,
          }
          if (job.bookingId) payload.bookingId = job.bookingId
          if (job.isIndependent) payload.isIndependent = true
          setPendingUpdatePayload(payload)
          setShowNotifyClientModal(true)
        }
      } catch (error) {
        reportScheduleUpdateError(error, 'Could not resize this job on the calendar.')
      }

      // Clear drag state and preview
      isDraggingRef.current = false
      dragOriginRef.current = null
      setJustFinishedDrag(true)
      setDragState({
        job: null,
        type: null,
        startY: 0,
        startX: 0,
        grabOffsetY: 0,
        slotHeight: 60,
        isDragging: false,
        hasMoved: false,
        originalStartTime: null,
        originalEndTime: null,
      })
      setPreviewEndTime(null)

      // Re-enable transitions after a brief delay
      setTimeout(() => {
        setJustFinishedDrag(false)
      }, 50)
    },
    [dragState, reportScheduleUpdateError]
  )

  useEffect(() => {
    let rafId: number | null = null

    // Pure delta-based calculation - most reliable for mobile
    // Uses the measured slot height from drag start and computes new time from original + delta
    const computeNewStartTimeFromDelta = (deltaY: number): Date => {
      const slotHeight = dragState.slotHeight || 60
      // Each slotHeight pixels = 1 hour = 60 minutes
      const minutesChange = (deltaY / slotHeight) * 60
      const snappedMinutesChange = Math.round(minutesChange / 15) * 15
      return addMinutes(new Date(dragState.originalStartTime!), snappedMinutesChange)
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragState.job) return

      // Only respond to the pointer that initiated the drag
      if (dragState.pointerId !== undefined && e.pointerId !== dragState.pointerId) return

      const clientX = e.clientX
      const clientY = e.clientY
      const deltaY = clientY - dragState.startY
      const deltaX = clientX - dragState.startX
      // For week-all-day-move, only consider horizontal movement
      const distance =
        dragState.type === 'week-all-day-move'
          ? Math.abs(deltaX)
          : Math.sqrt(deltaX * deltaX + deltaY * deltaY)

      // Mark that pointer has moved (even if < 5px)
      if (!dragState.hasMoved && distance > 0) {
        setDragState(prev => ({ ...prev, hasMoved: true }))
      }

      // Only activate drag if pointer moved more than 5 pixels
      if (!dragState.isDragging && distance < 5) {
        return
      }

      // Activate dragging
      if (!dragState.isDragging) {
        isDraggingRef.current = true
        // Only show drag ghost for move operations, not resize
        if (dragState.type === 'move' || dragState.type === 'week-all-day-move') {
          setDragGhost(prev => (prev ? { ...prev, isVisible: true } : prev))
        }
        // Capture pointer only once we commit to dragging
        if (dragState.pointerId !== undefined) {
          try {
            dragOriginRef.current?.setPointerCapture(dragState.pointerId)
          } catch {
            // ignore
          }
        }
        setDragState(prev => ({ ...prev, isDragging: true }))
      }

      // Use requestAnimationFrame for smooth updates
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }

      rafId = requestAnimationFrame(() => {
        // Update ghost position every frame so it looks "picked up" - only for move operations
        if (dragState.type === 'move' || dragState.type === 'week-all-day-move') {
          setDragGhost(prev => {
            if (!prev) return prev
            // For week-all-day-move, only update X position (horizontal movement)
            if (dragState.type === 'week-all-day-move') {
              return { ...prev, x: clientX - prev.offsetX, y: prev.y }
            }
            return { ...prev, x: clientX - prev.offsetX, y: clientY - prev.offsetY }
          })
        }

        // Smooth "picked up" movement (pixel-perfect)
        if (
          dragState.type === 'move' ||
          dragState.type === 'month-move' ||
          dragState.type === 'week-all-day-move'
        ) {
          // For week-all-day-move, only allow horizontal movement
          if (dragState.type === 'week-all-day-move') {
            setDragOffset({ x: deltaX, y: 0 })
          } else {
            setDragOffset({ x: deltaX, y: deltaY })
          }
        }

        // Use the measured slot height from drag start for accurate calculations
        const slotHeight = dragState.slotHeight || 60
        const minutesChange = Math.round((deltaY / slotHeight) * 60)
        const snappedMinutesChange = Math.round(minutesChange / 15) * 15

        if (dragState.type === 'resize' && dragState.originalEndTime && dragState.job?.startTime) {
          // Calculate real-time preview with 15-minute snapping for resize
          const newEndTime = addMinutes(new Date(dragState.originalEndTime), snappedMinutesChange)
          const startTime = new Date(dragState.job.startTime)

          // Only update preview if end time is after start time
          if (newEndTime > startTime) {
            setPreviewEndTime(newEndTime)
          }
        } else if (dragState.type === 'move' && dragState.originalStartTime) {
          // Pure delta-based calculation - most reliable for mobile
          const newStartTime = computeNewStartTimeFromDelta(deltaY)
          setPreviewStartTime(newStartTime)
          if (viewMode === 'week') {
            // For week view, also detect which day column we're over
            weekColumnsRef.current.forEach((rect, dayIndex) => {
              if (clientX >= rect.left && clientX <= rect.right) {
                const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
                const targetDay = addDays(weekStart, dayIndex)
                setDragTargetDay(targetDay)
              }
            })
          }
        } else if (dragState.type === 'week-all-day-move' && dragState.originalStartTime) {
          // For week view all-day jobs: Only detect which day column we're over (horizontal movement only)
          weekColumnsRef.current.forEach((rect, dayIndex) => {
            if (clientX >= rect.left && clientX <= rect.right) {
              const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
              const targetDay = addDays(weekStart, dayIndex)
              setDragTargetDay(targetDay)
            }
          })
        } else if (dragState.type === 'month-move' && dragState.originalStartTime) {
          // For month view: Use elementFromPoint to detect drop target
          const element = document.elementFromPoint(clientX, clientY)
          const dropCell = element?.closest('[data-drop-date]') as HTMLElement
          if (dropCell) {
            const dropDateStr = dropCell.getAttribute('data-drop-date')
            if (dropDateStr) {
              const dropDate = new Date(dropDateStr)
              setDragOverDate(dropDate)
            }
          } else {
            setDragOverDate(null)
          }
        }
      })
    }

    const handlePointerUpOrCancel = (e: PointerEvent) => {
      if (!dragState.job) return

      // Only respond to the pointer that initiated the drag
      if (dragState.pointerId !== undefined && e.pointerId !== dragState.pointerId) return

      // Cancel any pending animation frame
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }

      // If we didn't actually drag, do nothing here.
      // Clicks should be handled by onClick handlers so the modal opens ONLY on click.
      if (!dragState.isDragging) {
        isDraggingRef.current = false
        dragOriginRef.current = null
        setDragOffset({ x: 0, y: 0 })
        setDragGhost(null)
        setDragState({
          job: null,
          type: null,
          startY: 0,
          startX: 0,
          grabOffsetY: 0,
          slotHeight: 60,
          isDragging: false,
          hasMoved: false,
          originalStartTime: null,
          originalEndTime: null,
        })
        return
      }

      // We actually dragged, so save the changes
      if (dragState.type === 'resize') {
        // Suppress the click that can fire after dragging ends
        justDraggedRef.current = true
        isDraggingRef.current = false
        dragOriginRef.current = null
        setDragOffset({ x: 0, y: 0 })
        setDragGhost(null)
        const deltaY = e.clientY - dragState.startY
        // Use measured slot height for accurate resize calculation
        const slotHeight = dragState.slotHeight || 60
        const minutesChange = Math.round((deltaY / slotHeight) * 60)
        handleResizeDrop(minutesChange)
      } else if (dragState.type === 'move') {
        // Suppress the click that can fire after dragging ends
        justDraggedRef.current = true
        isDraggingRef.current = false
        dragOriginRef.current = null
        setDragOffset({ x: 0, y: 0 })
        // Don't clear ghost yet - let handleMoveDrop handle it
        // Save the moved job - use delta-based calculation for accuracy
        const deltaY = e.clientY - dragState.startY
        const finalStartTime = computeNewStartTimeFromDelta(deltaY)
        handleMoveDrop(finalStartTime)
      } else if (
        dragState.type === 'week-all-day-move' &&
        dragTargetDay &&
        dragState.job.startTime &&
        dragState.job.endTime
      ) {
        // Handle week view all-day job drop - only change date, keep time
        const originalStart = new Date(dragState.originalStartTime!)
        const originalEnd = new Date(dragState.originalEndTime!)

        // Calculate the day offset
        const originalStartDay = startOfDay(originalStart)
        const targetStartDay = startOfDay(dragTargetDay)
        const dayOffset = Math.round(
          (targetStartDay.getTime() - originalStartDay.getTime()) / (24 * 60 * 60 * 1000)
        )

        // Only update if the day actually changed
        if (dayOffset !== 0) {
          const newStartTime = addDays(originalStart, dayOffset)
          const newEndTime = addDays(originalEnd, dayOffset)
          const job = dragState.job
          if (!canUserEditJob(job)) {
            reportScheduleUpdateError(null, 'You can only edit jobs you are assigned to')
          } else {
            const hasContact = !!(job.contactId && job.contactId.trim())
            if (job.isIndependent && !hasContact) {
              updateIndependentBooking(job.id, {
                startTime: newStartTime.toISOString(),
                endTime: newEndTime.toISOString(),
              }).catch(err =>
                reportScheduleUpdateError(err, 'Could not reschedule this appointment. If this keeps happening, ask an admin to check your permissions.')
              )
            } else {
              const payload: { id: string; startTime: string; endTime: string; bookingId?: string; isIndependent?: boolean } = {
                id: job.id,
                startTime: newStartTime.toISOString(),
                endTime: newEndTime.toISOString(),
              }
              if (job.bookingId) payload.bookingId = job.bookingId
              if (job.isIndependent) payload.isIndependent = true
              setPendingUpdatePayload(payload)
              setShowNotifyClientModal(true)
            }
          }
        }

        // Clear drag state
        isDraggingRef.current = false
        justDraggedRef.current = true
        dragOriginRef.current = null
        setDragOffset({ x: 0, y: 0 })
        setJustFinishedDrag(true)
        setDragGhost(null)
        setDragState({
          job: null,
          type: null,
          startY: 0,
          startX: 0,
          grabOffsetY: 0,
          slotHeight: 60,
          isDragging: false,
          hasMoved: false,
          originalStartTime: null,
          originalEndTime: null,
        })
        setDragTargetDay(null)

        // Re-enable transitions after a brief delay
        setTimeout(() => {
          setJustFinishedDrag(false)
        }, 50)
      } else if (
        dragState.type === 'month-move' &&
        dragOverDate &&
        dragState.job.startTime &&
        dragState.job.endTime
      ) {
        // Handle month view drop
        const originalStart = new Date(dragState.originalStartTime!)
        const newStartTime = setHours(
          setMinutes(dragOverDate, getMinutes(originalStart)),
          getHours(originalStart)
        )
        const duration =
          new Date(dragState.job.endTime).getTime() - new Date(dragState.job.startTime).getTime()
        const newEndTime = new Date(newStartTime.getTime() + duration)

        const job = dragState.job
        if (isSameDay(newStartTime, originalStart)) {
          // Dropped back on the same day — a month drag only changes the day, so nothing changed.
          // Skip the update and the "notify client?" prompt (which would otherwise send a
          // reschedule notice for a non-move).
        } else if (!canUserEditJob(job)) {
          reportScheduleUpdateError(null, 'You can only edit jobs you are assigned to')
        } else {
          const hasContact = !!(job.contactId && job.contactId.trim())
          if (job.isIndependent && !hasContact) {
            updateIndependentBooking(job.id, {
              startTime: newStartTime.toISOString(),
              endTime: newEndTime.toISOString(),
            }).catch(err =>
              reportScheduleUpdateError(err, 'Could not reschedule this appointment. If this keeps happening, ask an admin to check your permissions.')
            )
          } else {
            const payload: { id: string; startTime: string; endTime: string; bookingId?: string; isIndependent?: boolean } = {
              id: job.id,
              startTime: newStartTime.toISOString(),
              endTime: newEndTime.toISOString(),
            }
            if (job.bookingId) payload.bookingId = job.bookingId
            if (job.isIndependent) payload.isIndependent = true
            setPendingUpdatePayload(payload)
            setShowNotifyClientModal(true)
          }
        }

        // Clear drag state
        isDraggingRef.current = false
        justDraggedRef.current = true
        dragOriginRef.current = null
        setDragOffset({ x: 0, y: 0 })
        setJustFinishedDrag(true)
        setDragGhost(null)
        setDragState({
          job: null,
          type: null,
          startY: 0,
          startX: 0,
          grabOffsetY: 0,
          slotHeight: 60,
          isDragging: false,
          hasMoved: false,
          originalStartTime: null,
          originalEndTime: null,
        })
        setDragOverDate(null)

        // Re-enable transitions after a brief delay
        setTimeout(() => {
          setJustFinishedDrag(false)
        }, 50)
      } else {
        // We were dragging but released with no valid drop target — e.g. a month-move dropped
        // over the header/toolbar/overlay (dragOverDate === null) or a week-all-day-move released
        // off every column (dragTargetDay unset). None of the branches above ran, so without this
        // the drag state would never reset: the pill would stick to the cursor and the next click
        // on a day cell would silently reschedule it. Snap back and suppress the trailing click.
        isDraggingRef.current = false
        justDraggedRef.current = true
        dragOriginRef.current = null
        setDragOffset({ x: 0, y: 0 })
        setJustFinishedDrag(true)
        setDragGhost(null)
        setDragState({
          job: null,
          type: null,
          startY: 0,
          startX: 0,
          grabOffsetY: 0,
          slotHeight: 60,
          isDragging: false,
          hasMoved: false,
          originalStartTime: null,
          originalEndTime: null,
        })
        setDragOverDate(null)
        setDragTargetDay(null)
        setTimeout(() => {
          setJustFinishedDrag(false)
        }, 50)
      }
    }

    if (dragState.job) {
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
    }
  }, [
    dragState,
    dragTargetDay,
    viewMode,
    previewStartTime,
    selectedDate,
    dragOverDate,
    onJobClick,
    handleMoveDrop,
    handleResizeDrop,
    updateJob,
    reportScheduleUpdateError,
  ])

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const allDayJobs = getJobsActiveOnDate(selectedDate).filter(job => isMultiDayJob(job))
    const dayJobs = getJobsForDate(selectedDate).filter(job => !isMultiDayJob(job))
    const jobLayout = calculateJobLayout(dayJobs)

    return (
      <div className="flex-1 overflow-y-auto" ref={dayViewRef}>
        <div className="sticky top-0 border-b border-line bg-surface z-10">
          <div className="p-3 md:p-4 text-center">
            <h2 className="text-base md:text-xl font-semibold text-ink">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
          </div>
        </div>

        {/* All-day / Multi-day jobs section */}
        {allDayJobs.length > 0 && (
          <div className="border-b border-line bg-surface-2">
            <div className="p-2 md:p-3">
              <div className="text-xs md:text-sm font-medium mb-2 text-ink-subtle">
                All Day
              </div>
              <div className="space-y-1">
                {allDayJobs.map(job => {
                  const jobStart = new Date(job.startTime!)
                  const jobEnd = new Date(job.endTime!)
                  const isStartDay = isSameDay(jobStart, selectedDate)
                  const isEndDay = isSameDay(jobEnd, selectedDate)
                  const dateRange =
                    isStartDay && isEndDay
                      ? format(selectedDate, 'MMM d')
                      : isStartDay
                        ? `${format(jobStart, 'MMM d')} - ${format(jobEnd, 'MMM d')}`
                        : isEndDay
                          ? `${format(jobStart, 'MMM d')} - ${format(jobEnd, 'MMM d')}`
                          : `${format(jobStart, 'MMM d')} - ${format(jobEnd, 'MMM d')}`

                  const jobColors = getJobColors(job)
                  return (
                    <div
                      key={getRowKey(job)}
                      className={cn(
                        'rounded-lg border-l-4 border-current/40 p-2 cursor-pointer hover:opacity-90 transition-all',
                        job.status === 'pending-confirmation' && 'border-dashed',
                        jobColors.chip
                      )}
                      onClick={e => {
                        e.stopPropagation()
                        onJobClick(job)
                      }}
                    >
                      <div className="flex min-w-0 flex-nowrap items-baseline gap-x-1 text-sm pointer-events-none">
                        {isJobPaid(job) && <PaidCheck className="h-3.5 w-3.5 self-center" />}
                        <span className="min-w-0 shrink truncate font-medium">
                          {job.title}
                        </span>
                        {job.contactName && (
                          <span className="shrink-0 truncate text-xs font-normal opacity-80">
                            {' - '}
                            {job.contactName}
                          </span>
                        )}
                      </div>
                      <div className="hidden sm:block text-xs font-mono tabular-nums opacity-80">{dateRange}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <div className="relative">
          {hours.map(hour => {
            const timeSlotJobs = getJobsForTimeSlot(selectedDate, hour)
            return (
              <div
                key={hour}
                className="border-b border-line min-h-[60px] md:min-h-[80px] relative select-none"
                data-drop-date={selectedDate.toISOString()}
                data-drop-hour={hour}
                onDragOver={e => {
                  e.preventDefault()
                  e.currentTarget.classList.add('bg-accent-soft')
                }}
                onDragLeave={e => {
                  e.currentTarget.classList.remove('bg-accent-soft')
                }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('bg-accent-soft')
                  const jobId = e.dataTransfer.getData('jobId')
                  const bookingId = e.dataTransfer.getData('bookingId') || undefined
                  if (jobId && onUnscheduledDrop) {
                    onUnscheduledDrop(jobId, selectedDate, hour, bookingId)
                  }
                }}
              >
                <div className="absolute left-0 top-0 w-12 whitespace-nowrap p-1 text-xs font-mono tabular-nums text-ink-subtle md:w-20 md:p-2 md:text-sm">
                  <span className="hidden sm:inline">
                    {format(setHours(setMinutes(new Date(), 0), hour), 'h:mm a')}
                  </span>
                  <span className="sm:hidden">
                    {format(setHours(setMinutes(new Date(), 0), hour), 'h a')}
                  </span>
                </div>
                <div className="ml-12 md:ml-20 p-1 md:p-2 relative">
                  {timeSlotJobs.map(job => {
                    // Skip jobs without scheduled times (already filtered, but TypeScript needs this)
                    if (!job.startTime || !job.endTime) return null

                    const layout = jobLayout[getRowKey(job)] || { column: 0, totalColumns: 1 }
                    const isDragging =
                      dragState.job?.id === job.id &&
                      (dragState.job?.bookingId == null
                        ? job.bookingId == null
                        : dragState.job.bookingId === job.bookingId)
                    const isResizing = isDragging && dragState.type === 'resize'
                    const isMoving = isDragging && dragState.type === 'move'

                    // Always use original job times for position
                    const originalStartTime = new Date(job.startTime)
                    const originalEndTime = new Date(job.endTime)

                    // Calculate display times for the text
                    const displayStartTime =
                      isMoving && previewStartTime ? previewStartTime : originalStartTime
                    const displayEndTime =
                      isResizing && previewEndTime ? previewEndTime : originalEndTime

                    // Position based on original job time
                    const topOffset = getMinutes(originalStartTime)

                    // Height based on duration (use preview end for resize)
                    const startMinutes =
                      getHours(originalStartTime) * 60 + getMinutes(originalStartTime)
                    let endMinutes =
                      isResizing && previewEndTime
                        ? getHours(previewEndTime) * 60 + getMinutes(previewEndTime)
                        : getHours(originalEndTime) * 60 + getMinutes(originalEndTime)
                    // An end of exactly 00:00 is midnight-as-end-of-day (a 10pm–midnight appointment
                    // is single-day); getHours gives 0, which would make the height negative. Treat
                    // it as the end of the day so the block fills to the bottom.
                    if (endMinutes <= startMinutes) endMinutes = 24 * 60
                    const duration = endMinutes - startMinutes
                    // Use responsive pixels per hour: 60px on mobile, 80px on desktop
                    const pixelsPerHour = window.innerWidth < 768 ? 60 : 80
                    const height = (duration / 60) * pixelsPerHour

                    // Calculate transform for move drag
                    const translateX = isMoving ? dragOffset.x : 0
                    const translateY = isMoving ? dragOffset.y : 0

                    // Calculate width and position for overlapping events
                    const widthPercent = layout.totalColumns > 1 ? 100 / layout.totalColumns : 100
                    const leftPercent = layout.totalColumns > 1 ? layout.column * widthPercent : 0

                    const jobColors = getJobColors(job)
                    return (
                      <div
                        key={getRowKey(job)}
                        className={cn(
                          'absolute rounded-lg border-l-4 border-current/40 select-none group',
                          job.status === 'pending-confirmation' && 'border-dashed',
                          isDragging ? 'z-0' : 'z-10',
                          dragState.job && !isDragging && 'pointer-events-none',
                          jobColors.chip
                        )}
                        style={{
                          top: `${topOffset * (pixelsPerHour / 60)}px`,
                          height: `${height}px`,
                          left: `${leftPercent}%`,
                          width: `calc(${widthPercent}% - 0.5rem)`,
                          transform: isMoving
                            ? `translate3d(${translateX}px, ${translateY}px, 0)`
                            : undefined,
                          transition: isMoving || justFinishedDrag ? 'none' : 'all 0.2s ease',
                          willChange: isMoving ? 'transform' : undefined,
                          opacity: isMoving && dragState.isDragging ? 0 : 1,
                          pointerEvents: isMoving && dragState.isDragging ? 'none' : undefined,
                        }}
                      >
                        {onConfirmJob && job.status === 'pending-confirmation' && (
                          <ConfirmChipButton onConfirm={() => onConfirmJob(job)} />
                        )}
                        {/* Main content area - draggable */}
                        <div
                          className="absolute top-0 left-0 right-0 p-2 cursor-move hover:opacity-90 transition-all overflow-hidden touch-none pointer-events-auto"
                          style={{ bottom: '24px' }}
                          onPointerDown={e => {
                            e.stopPropagation()
                            handleDragStart(e, job, 'move')
                          }}
                          onClick={e => {
                            e.stopPropagation()
                            if (justDraggedRef.current) {
                              justDraggedRef.current = false
                              return
                            }
                            if (dragState.isDragging) return
                            onJobClick(job)
                          }}
                        >
                          <div className="flex min-w-0 flex-nowrap items-baseline gap-x-1 text-sm pointer-events-none">
                            {isJobPaid(job) && <PaidCheck className="h-3.5 w-3.5 self-center" />}
                            <span className="min-w-0 shrink truncate font-medium">
                              {job.title}
                            </span>
                            {job.contactName && (
                              <span className="shrink-0 truncate text-xs font-normal opacity-80">
                                {' - '}
                                {job.contactName}
                              </span>
                            )}
                          </div>
                          <div className="hidden sm:block text-xs font-mono tabular-nums pointer-events-none opacity-80">
                            {format(displayStartTime, 'h:mm a')} -{' '}
                            {format(displayEndTime, 'h:mm a')}
                          </div>
                        </div>

                        {/* Resize handle - bottom 24px always accessible */}
                        <div
                          className="absolute bottom-0 left-0 right-0 cursor-ns-resize group-hover:bg-current/5 hover:!bg-current/10 transition-colors flex items-center justify-center touch-none"
                          style={{ height: '24px', zIndex: 20 }}
                          onPointerDown={e => {
                            e.stopPropagation()
                            handleDragStart(e, job, 'resize')
                          }}
                        >
                          <div className="w-8 h-1 rounded-full pointer-events-none bg-current/30 group-hover:bg-current/50"></div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })
    const hours = Array.from({ length: 24 }, (_, i) => i)

    // Calculate lane assignments for all-day jobs in the week
    // Collect all all-day jobs that appear in this week
    const allWeekAllDayJobs = new Map<string, Job>()
    weekDays.forEach(day => {
      const dayAllDayJobs = getJobsActiveOnDate(day).filter(job => isMultiDayJob(job))
      dayAllDayJobs.forEach(job => {
        if (!allWeekAllDayJobs.has(job.id)) {
          allWeekAllDayJobs.set(job.id, job)
        }
      })
    })

    // Sort jobs by start date, then by end date (longer first), then by id for stability
    const sortedAllDayJobs = Array.from(allWeekAllDayJobs.values())
      .filter(job => job.startTime && job.endTime)
      .sort((a, b) => {
        const aStart = startOfDay(new Date(a.startTime!)).getTime()
        const bStart = startOfDay(new Date(b.startTime!)).getTime()
        if (aStart !== bStart) return aStart - bStart
        const aEnd = startOfDay(new Date(a.endTime!)).getTime()
        const bEnd = startOfDay(new Date(b.endTime!)).getTime()
        if (aEnd !== bEnd) return bEnd - aEnd // longer first
        return a.id.localeCompare(b.id)
      })

    // Assign lanes: each job gets the first available lane that doesn't overlap with previous jobs
    const weekLaneMap = new Map<string, number>()
    const laneJobs: Array<Array<{ start: number; end: number }>> = [] // Track all jobs in each lane

    sortedAllDayJobs.forEach(job => {
      const jobStartDay = startOfDay(new Date(job.startTime!))
      const jobEndDay = lastOccupiedDay(job.endTime!)

      // Find visible start/end in the week
      const visibleStart = jobStartDay < weekStart ? weekStart : jobStartDay
      const visibleEnd = jobEndDay > weekEnd ? weekEnd : jobEndDay

      const startDayIndex = weekDays.findIndex(d => isSameDay(startOfDay(d), visibleStart))
      const endDayIndex = weekDays.findIndex(d => isSameDay(startOfDay(d), visibleEnd))

      if (startDayIndex === -1 || endDayIndex === -1) return

      // Find the first lane where this job doesn't overlap with any existing job
      let assignedLane = -1
      for (let lane = 0; lane < laneJobs.length; lane++) {
        const jobsInLane = laneJobs[lane]
        // Check if this job overlaps with any job in this lane
        const overlaps = jobsInLane.some(existingJob => {
          // Two jobs overlap if: this job starts before existing ends AND this job ends after existing starts
          return startDayIndex <= existingJob.end && endDayIndex >= existingJob.start
        })

        if (!overlaps) {
          // This lane is free, use it
          assignedLane = lane
          jobsInLane.push({ start: startDayIndex, end: endDayIndex })
          break
        }
      }

      if (assignedLane === -1) {
        // Need a new lane
        assignedLane = laneJobs.length
        laneJobs.push([{ start: startDayIndex, end: endDayIndex }])
      }

      weekLaneMap.set(job.id, assignedLane)
    })

    // Calculate height needed for all-day slot based on number of lanes
    // Each lane is 1.75rem tall with a small gap
    const laneHeight = 1.75 // rem per lane
    const laneGap = 0.125 // rem gap between lanes
    const allDaySlotHeight = Math.max(1, laneJobs.length) * (laneHeight + laneGap) + 0.25 // Add small padding at bottom

    return (
      <>
        <style>{`
          .week-slot-height {
            --slot-height: 48px;
          }
          @media (min-width: 768px) {
            .week-slot-height {
              --slot-height: 80px;
            }
          }
          .multi-day-job-bar {
            /* When start-index is 0 (rendering in the start column), span from this column */
            width: calc(var(--span-days) * (100px + 1px) - 1px);
            right: auto;
          }
          @media (min-width: 768px) {
            .multi-day-job-bar {
              /* On desktop, columns are flex-1, so use percentage */
              width: calc(var(--span-days) * ((100vw - 3rem) / 7 + 1px) - 1px);
              top: var(--top-desktop, 0) !important;
            }
            .single-day-job-after-multiday {
              margin-top: var(--margin-top-desktop, 0) !important;
            }
          }
        `}</style>
        <div className="flex-1 overflow-auto week-slot-height min-w-0" ref={weekViewRef}>
          <div className="sticky top-0 border-b border-line bg-surface z-10">
            <div className="p-3 md:p-4 text-center">
              <h2 className="text-base md:text-xl font-semibold text-ink">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
            </div>
          </div>
          <div className="flex overflow-x-auto min-w-0">
            {/* Time column */}
            <div className="w-12 md:w-20 flex-shrink-0 border-r border-line bg-surface sticky left-0 z-10">
              {/* Empty space for day headers */}
              <div className="h-10 md:h-12 border-b border-line"></div>
              {/* All-day slot label */}
              <div
                className="border-b border-line p-1 md:p-2 text-xs font-normal text-ink-subtle"
                style={{
                  minHeight: `${allDaySlotHeight}rem`,
                  height: `${allDaySlotHeight}rem`,
                }}
              >
                All Day
              </div>
              {/* Time slots */}
              {hours.map(hour => (
                <div
                  key={hour}
                  className="h-12 md:h-20 whitespace-nowrap border-b border-line p-1 md:p-2 text-xs font-mono tabular-nums text-ink-subtle"
                >
                  <span className="hidden sm:inline">
                    {format(setHours(setMinutes(new Date(), 0), hour), 'h:mm a')}
                  </span>
                  <span className="sm:hidden">
                    {format(setHours(setMinutes(new Date(), 0), hour), 'h a')}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="flex flex-1 min-w-0">
              {weekDays.map((day, dayIndex) => {
                const dayJobs = getJobsForDate(day).filter(job => !isMultiDayJob(job))
                const jobLayout = calculateJobLayout(dayJobs)
                const allDayJobs = getJobsActiveOnDate(day).filter(job => isMultiDayJob(job))

                return (
                  <div
                    key={day.toISOString()}
                    data-day-column={dayIndex}
                    className={cn(
                      'w-[100px] md:flex-1 md:min-w-0 flex-shrink-0 border-r border-line last:border-r-0 flex flex-col',
                      dragState.type === 'move' &&
                        dragTargetDay &&
                        isSameDay(dragTargetDay, day) &&
                        'bg-accent-soft'
                    )}
                    ref={el => {
                      if (el) {
                        weekColumnsRef.current.set(dayIndex, el.getBoundingClientRect())
                      }
                    }}
                  >
                    {/* Day header */}
                    <div
                      className="h-10 md:h-12 border-b border-line cursor-pointer flex-shrink-0 hover:bg-surface-hover"
                      onClick={() => onDateClick(day)}
                    >
                      <div className="p-1 md:p-2 text-center w-full">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">
                          <span className="hidden sm:inline">{format(day, 'EEE')}</span>
                          <span className="sm:hidden">{format(day, 'EEEEE')}</span>
                        </div>
                        <div
                          className={cn(
                            'text-xs md:text-sm font-mono tabular-nums font-medium',
                            isToday(day) ? 'text-accent-strong' : 'text-ink',
                            isSameDay(day, selectedDate) &&
                              'ring-2 ring-accent rounded-full w-5 h-5 md:w-6 md:h-6 mx-auto flex items-center justify-center'
                          )}
                        >
                          {format(day, 'd')}
                        </div>
                      </div>
                    </div>

                    {/* All-day slot - dedicated row for multi-day jobs */}
                    <div
                      className="border-b border-line relative flex-shrink-0 overflow-visible"
                      style={{
                        minHeight: `${allDaySlotHeight}rem`,
                        height: `${allDaySlotHeight}rem`,
                      }}
                    >
                      {/* Render multi-day jobs on the first day they appear in this week */}
                      {allDayJobs
                        .filter(job => {
                          if (!job.startTime || !job.endTime) return false
                          const jobStartDay = startOfDay(new Date(job.startTime))

                          // Calculate the first day this job appears in the week
                          const firstDayInWeek = jobStartDay < weekStart ? weekStart : jobStartDay

                          // Only render on the first day the job appears in this week
                          return isSameDay(startOfDay(day), firstDayInWeek)
                        })
                        .map(job => {
                          if (!job.startTime || !job.endTime) return null

                          const jobStartDay = startOfDay(new Date(job.startTime))
                          const jobEndDay = lastOccupiedDay(job.endTime)

                          // Find which days in the week this job spans
                          const visibleStart = jobStartDay < weekStart ? weekStart : jobStartDay
                          const visibleEnd = jobEndDay > weekEnd ? weekEnd : jobEndDay

                          // Find start and end day indices in the week
                          const startDayIndex = weekDays.findIndex(d =>
                            isSameDay(startOfDay(d), visibleStart)
                          )
                          const endDayIndex = weekDays.findIndex(d =>
                            isSameDay(startOfDay(d), visibleEnd)
                          )

                          if (startDayIndex === -1 || endDayIndex === -1) return null

                          const spanDays = endDayIndex - startDayIndex + 1
                          const isDragging =
                            dragState.job?.id === job.id &&
                            (dragState.job?.bookingId == null
                              ? job.bookingId == null
                              : dragState.job.bookingId === job.bookingId)
                          const isMoving = isDragging && dragState.type === 'week-all-day-move'
                          const translateX = isMoving ? dragOffset.x : 0
                          const translateY = isMoving ? dragOffset.y : 0

                          const isJobStart = isSameDay(jobStartDay, visibleStart)
                          const isJobEnd = isSameDay(jobEndDay, visibleEnd)

                          // Calculate position: negative left to span backwards from this column
                          const columnOffset = dayIndex - startDayIndex
                          // Each column is 100% of its container, plus 1px border between columns
                          const leftOffset =
                            columnOffset > 0 ? `calc(-${columnOffset} * (100% + 1px))` : '0.125rem'

                          // Get lane assignment for vertical positioning
                          const lane = weekLaneMap.get(job.id) ?? 0
                          const laneHeight = 1.75 // rem per lane
                          const laneGap = 0.125 // rem gap between lanes
                          const topOffset = lane * (laneHeight + laneGap)

                          const jobColors = getJobColors(job)
                          const allDayDateRange = isSameDay(jobStartDay, jobEndDay)
                            ? format(jobStartDay, 'MMM d')
                            : `${format(jobStartDay, 'MMM d')} - ${format(jobEndDay, 'MMM d')}`
                          return (
                            <div
                              key={getRowKey(job)}
                              className={cn(
                                'absolute multi-day-job-bar text-[10px] md:text-xs border-l-2 border-current/40 cursor-grab active:cursor-grabbing hover:opacity-90 z-20 flex items-center min-w-0',
                                jobColors.chip,
                                job.status === 'pending-confirmation' && 'border-dashed',
                                isJobStart && 'rounded-l',
                                isJobEnd && 'rounded-r'
                              )}
                              style={
                                {
                                  left: leftOffset,
                                  // Mobile uses inline top; desktop uses CSS rule:
                                  // `.multi-day-job-bar { top: var(--top-desktop, 0) !important; }`
                                  // so we must set the CSS var for proper lane stacking.
                                  top: `${topOffset}rem`,
                                  '--top-desktop': `${topOffset}rem`,
                                  height: `${laneHeight}rem`,
                                  width: `calc(${spanDays} * 100% + ${spanDays - 1} * 1px)`,
                                  paddingLeft: '0.125rem',
                                  paddingRight: '0.125rem',
                                  transform: isMoving
                                    ? `translate3d(${translateX}px, ${translateY}px, 0)`
                                    : undefined,
                                  transition:
                                    isMoving || justFinishedDrag ? 'none' : 'all 0.2s ease',
                                  opacity: isMoving && dragState.isDragging ? 0.5 : 1,
                                } as React.CSSProperties & { '--top-desktop': string }
                              }
                              onPointerDown={e => {
                                e.stopPropagation()
                                handleDragStart(e, job, 'week-all-day-move')
                              }}
                              onClick={e => {
                                e.stopPropagation()
                                if (justDraggedRef.current) {
                                  justDraggedRef.current = false
                                  return
                                }
                                if (dragState.isDragging) return
                                onJobClick(job)
                              }}
                              title={`${job.title}${job.contactName ? ` - ${job.contactName}` : ''} · ${allDayDateRange}`}
                            >
                              <div className="min-w-0 flex-1 flex flex-col justify-center leading-tight gap-px py-px">
                                <div className="flex min-w-0 flex-nowrap items-baseline gap-x-1">
                                  {isJobPaid(job) && <PaidCheck className="h-3 w-3 self-center" />}
                                  <span className="min-w-0 shrink truncate font-medium">
                                    {job.title}
                                  </span>
                                  {job.contactName && (
                                    <span className="hidden shrink-0 truncate text-[9px] font-normal opacity-90 md:inline md:text-[10px]">
                                      {' - '}
                                      {job.contactName}
                                    </span>
                                  )}
                                </div>
                                <div className="hidden sm:block min-w-0 truncate text-[9px] opacity-80 md:text-[10px]">
                                  {allDayDateRange}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                    </div>

                    {/* Time slots */}
                    <div className="relative">
                      {hours.map(hour => {
                        const timeSlotJobs = getJobsForTimeSlot(day, hour)
                        return (
                          <div
                            key={hour}
                            className="h-12 md:h-20 border-b border-line relative select-none"
                            data-drop-date={day.toISOString()}
                            data-drop-hour={hour}
                            onDragOver={e => {
                              e.preventDefault()
                              e.currentTarget.classList.add('bg-accent-soft')
                            }}
                            onDragLeave={e => {
                              e.currentTarget.classList.remove('bg-accent-soft')
                            }}
                            onDrop={e => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('bg-accent-soft')
                              const jobId = e.dataTransfer.getData('jobId')
                              const bookingId = e.dataTransfer.getData('bookingId') || undefined
                              if (jobId && onUnscheduledDrop) {
                                onUnscheduledDrop(jobId, day, hour, bookingId)
                              }
                            }}
                          >
                            {timeSlotJobs.map(job => {
                              // Skip jobs without scheduled times (already filtered, but TypeScript needs this)
                              if (!job.startTime || !job.endTime) return null

                              const layout = jobLayout[getRowKey(job)] || { column: 0, totalColumns: 1 }
                              const isDragging =
                                dragState.job?.id === job.id &&
                                (dragState.job?.bookingId == null
                                  ? job.bookingId == null
                                  : dragState.job.bookingId === job.bookingId)
                              const isResizing = isDragging && dragState.type === 'resize'
                              const isMoving = isDragging && dragState.type === 'move'

                              // Always use original job times for position
                              const originalStartTime = new Date(job.startTime)
                              const originalEndTime = new Date(job.endTime)

                              // Calculate display times for the text
                              const displayStartTime =
                                isMoving && previewStartTime ? previewStartTime : originalStartTime
                              const displayEndTime =
                                isResizing && previewEndTime ? previewEndTime : originalEndTime

                              // Position based on original job time
                              const topOffset = getMinutes(originalStartTime)

                              // Height based on duration (use preview end for resize)
                              const originalStartMinutes =
                                getHours(originalStartTime) * 60 + getMinutes(originalStartTime)
                              let endMinutes =
                                isResizing && previewEndTime
                                  ? getHours(previewEndTime) * 60 + getMinutes(previewEndTime)
                                  : getHours(originalEndTime) * 60 + getMinutes(originalEndTime)
                              // An end of exactly 00:00 is midnight-as-end-of-day (a 10pm–midnight
                              // appointment is single-day); getHours gives 0, which would make the
                              // height negative. Treat it as the end of the day.
                              if (endMinutes <= originalStartMinutes) endMinutes = 24 * 60
                              const duration = endMinutes - originalStartMinutes

                              // Use CSS custom property for responsive height
                              const height = (duration / 60) * 100
                              const topPosition = (topOffset / 60) * 100

                              // Calculate transform for move drag
                              const translateX = isMoving ? dragOffset.x : 0
                              const translateY = isMoving ? dragOffset.y : 0

                              // Calculate width and position for overlapping events
                              const widthPercent =
                                layout.totalColumns > 1 ? 100 / layout.totalColumns : 100
                              const leftPercent =
                                layout.totalColumns > 1 ? layout.column * widthPercent : 0

                              const jobColors = getJobColors(job)
                              return (
                                <div
                                  key={getRowKey(job)}
                                  className={cn(
                                    'absolute rounded text-xs border-l-2 border-current/40 select-none group',
                                    job.status === 'pending-confirmation' && 'border-dashed',
                                    isDragging ? 'z-0' : 'z-10',
                                    dragState.job && !isDragging && 'pointer-events-none',
                                    jobColors.chip
                                  )}
                                  style={{
                                    top: `calc(var(--slot-height) * ${topPosition} / 100)`,
                                    height: `calc(var(--slot-height) * ${height} / 100)`,
                                    left: `${leftPercent}%`,
                                    width: `calc(${widthPercent}% - 0.25rem)`,
                                    transform: isMoving
                                      ? `translate3d(${translateX}px, ${translateY}px, 0)`
                                      : undefined,
                                    transition:
                                      isMoving || justFinishedDrag ? 'none' : 'all 0.2s ease',
                                    willChange: isMoving ? 'transform' : undefined,
                                    opacity: isMoving && dragState.isDragging ? 0 : 1,
                                    pointerEvents:
                                      isMoving && dragState.isDragging ? 'none' : undefined,
                                  }}
                                >
                                  {onConfirmJob && job.status === 'pending-confirmation' && (
                                    <ConfirmChipButton onConfirm={() => onConfirmJob(job)} />
                                  )}
                                  {/* Main content area - draggable */}
                                  <div
                                    className="absolute top-0 left-0 right-0 p-1 cursor-move hover:opacity-90 transition-all overflow-hidden touch-none pointer-events-auto"
                                    style={{ bottom: '16px' }}
                                    onPointerDown={e => {
                                      e.stopPropagation()
                                      handleDragStart(e, job, 'move')
                                    }}
                                    onClick={e => {
                                      e.stopPropagation()
                                      if (justDraggedRef.current) {
                                        justDraggedRef.current = false
                                        return
                                      }
                                      if (dragState.isDragging) return
                                      onJobClick(job)
                                    }}
                                  >
                                    <div className="flex min-w-0 flex-nowrap items-baseline gap-x-1 pointer-events-none">
                                      {isJobPaid(job) && <PaidCheck className="h-3 w-3 self-center" />}
                                      <span className="min-w-0 shrink truncate text-xs font-medium">
                                        {job.title}
                                      </span>
                                      {job.contactName && (
                                        <span className="hidden shrink-0 truncate text-[10px] font-normal opacity-80 md:inline md:text-xs">
                                          {' - '}
                                          {job.contactName}
                                        </span>
                                      )}
                                    </div>
                                    <div className="hidden sm:block truncate text-[10px] font-mono tabular-nums pointer-events-none opacity-80 md:text-xs">
                                      {format(displayStartTime, 'h:mm a')} -{' '}
                                      {format(displayEndTime, 'h:mm a')}
                                    </div>
                                  </div>

                                  {/* Resize handle - bottom 16px always accessible */}
                                  <div
                                    className="absolute bottom-0 left-0 right-0 cursor-ns-resize group-hover:bg-current/5 hover:!bg-current/10 transition-colors flex items-center justify-center touch-none"
                                    style={{ height: '16px', zIndex: 20 }}
                                    onPointerDown={e => {
                                      e.stopPropagation()
                                      handleDragStart(e, job, 'resize')
                                    }}
                                  >
                                    <div className="w-6 h-0.5 rounded-full pointer-events-none bg-current/30 group-hover:bg-current/50"></div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </>
    )
  }

  const renderMonthView = () => {
    const monthStart = startOfMonth(selectedDate)
    const monthEnd = endOfMonth(selectedDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

    // Calculate number of weeks in the calendar view
    const weeksInView = Math.ceil(days.length / 7)

    // Calculate visible items and cell height based on scale
    const getScaleSettings = () => {
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768

      // For mobile, calculate dynamic height based on available space
      if (isMobile && weeksInView > 0) {
        // Use calendar container height if available, otherwise fall back to viewport
        const containerHeight = calendarContainerHeight || viewportHeight

        // Account for header, week day labels, and padding
        // Header: ~50px, week labels: ~30px, padding: ~10px
        const reservedHeight = 90
        const availableHeight = Math.max(400, containerHeight - reservedHeight) // Minimum 400px available

        // Calculate height per week, then divide by 7 for each day cell
        const heightPerWeek = availableHeight / weeksInView
        const cellHeight = Math.max(80, Math.floor(heightPerWeek / 7)) // Minimum 80px

        // Determine max items based on cell height
        let maxItems = 2
        if (cellHeight >= 120) maxItems = 3
        if (cellHeight >= 150) maxItems = 4
        if (cellHeight >= 180) maxItems = 5

        return {
          maxItems,
          minHeight: `min-h-[${cellHeight}px]`,
          dynamicHeight: cellHeight,
        }
      }

      // Desktop uses fixed heights based on scale
      switch (calendarScale) {
        case 100:
          return { maxItems: 2, minHeight: 'min-h-[120px] md:min-h-[150px]' }
        case 125:
          return { maxItems: 3, minHeight: 'min-h-[150px] md:min-h-[200px]' }
        case 150:
          return { maxItems: 4, minHeight: 'min-h-[180px] md:min-h-[240px]' }
        case 175:
          return { maxItems: 5, minHeight: 'min-h-[210px] md:min-h-[280px]' }
        default:
          return { maxItems: 3, minHeight: 'min-h-[150px] md:min-h-[200px]' }
      }
    }

    const scaleSettings = getScaleSettings()

    // Month view "all-day lane" sizing.
    // Multi-day pills are absolutely positioned and can overflow into adjacent day cells.
    // We reserve lane height in-flow so normal (timed) jobs never overlap those pills.
    // Mobile (<sm): thin colored bars without text. Desktop: full pills with time + title.
    const monthPillHeightRem = 1.5
    const monthLaneGapRem = 0.4
    const monthBarHeightMobileRem = 0.5
    const monthBarGapMobileRem = 0.2
    const monthLaneStepMobileRem = monthBarHeightMobileRem + monthBarGapMobileRem
    const monthLaneStepDesktopRem = monthPillHeightRem + monthLaneGapRem

    // Multi-day jobs in the visible month grid (deduped by id)
    const multiDayJobMap = new Map<string, Job>()
    jobs.forEach(job => {
      if (job.startTime && job.endTime && isMultiDayJob(job)) {
        // Only include jobs that intersect the visible calendar range
        const jobDates = getJobDateRange(job, calendarStart, calendarEnd)
        if (jobDates.length > 0) multiDayJobMap.set(job.id, job)
      }
    })
    const multiDayJobs = Array.from(multiDayJobMap.values())

    // Stable lane assignment per *week row*.
    // This prevents "lane collapsing" mid-week (e.g. when a job ends on the 17th) which can
    // cause a newly-starting job on the 18th to reuse the same lane as an ongoing bar that
    // was rendered from the row's anchor cell (Sunday), resulting in stacked pills.
    const weekLaneInfoByRowStartIso = new Map<
      string,
      { laneMap: Map<string, number>; laneCount: number }
    >()
    for (let i = 0; i < days.length; i += 7) {
      const rowStartDay = days[i]
      const rowEndDay = days[i + 6]
      if (!rowStartDay || !rowEndDay) continue

      const jobsInRow = multiDayJobs
        .filter(job => {
          const jobStartDay = startOfDay(new Date(job.startTime!))
          const jobEndDay = lastOccupiedDay(job.endTime!)
          return (
            jobStartDay.getTime() <= rowEndDay.getTime() &&
            jobEndDay.getTime() >= rowStartDay.getTime()
          )
        })
        .sort((a, b) => {
          const aStart = startOfDay(new Date(a.startTime!)).getTime()
          const bStart = startOfDay(new Date(b.startTime!)).getTime()
          if (aStart !== bStart) return aStart - bStart
          const aEnd = startOfDay(new Date(a.endTime!)).getTime()
          const bEnd = startOfDay(new Date(b.endTime!)).getTime()
          if (aEnd !== bEnd) return bEnd - aEnd // longer first
          return a.id.localeCompare(b.id)
        })

      const laneMap = new Map<string, number>()
      jobsInRow.forEach((job, idx) => laneMap.set(job.id, idx))
      weekLaneInfoByRowStartIso.set(rowStartDay.toISOString(), {
        laneMap,
        laneCount: jobsInRow.length,
      })
    }

    return (
      <div ref={monthViewRef} className="flex-1 overflow-auto p-0.5">
        <style>{`
          /* Month view helpers for multi-day layout */
          @media (min-width: 640px) {
            .month-multi-day-pill {
              top: var(--top-desktop, 0) !important;
              height: var(--height-desktop, 1.5rem) !important;
            }
            .month-multiday-lane-spacer {
              height: var(--spacer-height-desktop, 0) !important;
            }
          }
        `}</style>
        <div className="sticky top-0 border-b border-line bg-surface z-10">
          <div className="p-3 md:p-4 text-center">
            <h2 className="text-base md:text-xl font-semibold text-ink">
              {format(selectedDate, 'MMMM yyyy')}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-7 relative">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div
              key={day}
              className="p-1 md:p-2 text-center text-[11px] md:text-xs font-semibold uppercase tracking-wide border-b border-line text-ink-subtle"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.substring(0, 1)}</span>
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day, dayIndex) => {
            // Calculate which column this day is in (0-6)
            const dayColumn = dayIndex % 7

            // Get all jobs for this day
            const allDayJobs = getJobsForDate(day)
            // Separate single-day and multi-day jobs
            const singleDayJobs = allDayJobs.filter(job => !isMultiDayJob(job))
            const multiDayJobsForDay = allDayJobs.filter(job => isMultiDayJob(job))

            // Calculate which multi-day jobs should render on this day (for rendering pills)
            const multiDayJobsToRender = multiDayJobsForDay
              .map(job => {
                const jobDates = getJobDateRange(job, calendarStart, calendarEnd)
                if (jobDates.length === 0) return null
                const jobStartDay = startOfDay(new Date(job.startTime!))
                const jobEndDay = lastOccupiedDay(job.endTime!)
                const isJobStartDay = isSameDay(day, jobStartDay)
                const isWeekStart = dayColumn === 0
                const thisWeekStart = startOfWeek(day, { weekStartsOn: 0 })
                const shouldRender =
                  isJobStartDay ||
                  (isWeekStart &&
                    jobStartDay < thisWeekStart &&
                    jobDates.some(d => isSameDay(d, day)))
                if (!shouldRender) return null
                return { job, jobStartDay, jobEndDay, isJobStartDay, jobDates }
              })
              .filter((item): item is NonNullable<typeof item> => item !== null)
              .sort((a, b) => a.jobStartDay.getTime() - b.jobStartDay.getTime())

            // Lane assignment: stable per week-row (precomputed above).
            const rowStartIndex = dayIndex - dayColumn
            const rowStartDay = days[rowStartIndex]
            const rowLaneInfo = rowStartDay
              ? weekLaneInfoByRowStartIso.get(rowStartDay.toISOString())
              : undefined
            const jobLaneMap = rowLaneInfo?.laneMap ?? new Map<string, number>()
            const allMultiDayJobsActiveOnDay = rowLaneInfo?.laneCount ?? multiDayJobsForDay.length

            const isCurrentMonth = isSameMonth(day, selectedDate)
            const isDropTarget =
              dragOverDate && isSameDay(dragOverDate, day) && dragState.type === 'month-move'

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  // Only use Tailwind minHeight class on desktop (when dynamicHeight is not set)
                  !scaleSettings.dynamicHeight && scaleSettings.minHeight,
                  'border-b border-r border-line p-1.5 md:p-2 cursor-pointer transition-colors relative select-none overflow-visible hover:bg-surface-hover',
                  isToday(day) && 'bg-surface-2',
                  isDropTarget && 'bg-accent-soft ring-2 ring-accent'
                )}
                style={
                  scaleSettings.dynamicHeight
                    ? { minHeight: `${scaleSettings.dynamicHeight}px` }
                    : undefined
                }
                data-drop-date={day.toISOString()}
                onClick={() => {
                  const isMobile =
                    typeof window !== 'undefined' && window.innerWidth < 640
                  if (isMobile) {
                    openMobileDaySheet(day)
                  } else {
                    setSelectedDate(day)
                    onDateClick(day)
                  }
                }}
                onDragOver={e => {
                  e.preventDefault()
                  e.currentTarget.classList.add('bg-accent-soft')
                }}
                onDragLeave={e => {
                  e.currentTarget.classList.remove('bg-accent-soft')
                }}
                onDrop={async e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('bg-accent-soft')

                  // Handle month view job drag (moving scheduled job to different day)
                  const monthJobId = e.dataTransfer.getData('monthJobId')
                  const monthJobOriginalDate = e.dataTransfer.getData('monthJobOriginalDate')
                  if (monthJobId && monthJobOriginalDate) {
                    const originalStart = new Date(monthJobOriginalDate)
                    // Keep same time, change date
                    const newStartTime = setHours(
                      setMinutes(day, getMinutes(originalStart)),
                      getHours(originalStart)
                    )
                    const monthBookingId = e.dataTransfer.getData('monthBookingId') || undefined
                    const originalJob = monthBookingId
                      ? jobs.find(j => j.id === monthJobId && j.bookingId === monthBookingId)
                      : jobs.find(j => j.id === monthJobId)
                    if (originalJob && originalJob.startTime && originalJob.endTime) {
                      if (!canUserEditJob(originalJob)) {
                        reportScheduleUpdateError(null, 'You can only edit jobs you are assigned to')
                      } else {
                        const duration =
                          new Date(originalJob.endTime).getTime() -
                          new Date(originalJob.startTime).getTime()
                        const newEndTime = new Date(newStartTime.getTime() + duration)
                        if (originalJob.isIndependent && !originalJob.contactId) {
                          updateIndependentBooking(monthJobId, {
                            startTime: newStartTime.toISOString(),
                            endTime: newEndTime.toISOString(),
                          }).catch(err =>
                            reportScheduleUpdateError(err, 'Could not reschedule this appointment. If this keeps happening, ask an admin to check your permissions.')
                          )
                        } else {
                          const payload: { id: string; startTime: string; endTime: string; bookingId?: string; isIndependent?: boolean } = {
                            id: monthJobId,
                            startTime: newStartTime.toISOString(),
                            endTime: newEndTime.toISOString(),
                          }
                          if (originalJob.bookingId) payload.bookingId = originalJob.bookingId
                          if (originalJob.isIndependent) payload.isIndependent = true
                          setPendingUpdatePayload(payload)
                          setShowNotifyClientModal(true)
                        }
                      }
                    }
                    return
                  }

                  // Handle unscheduled job drop (HTML5 DnD - if used)
                  const jobId = e.dataTransfer.getData('jobId')
                  const bookingId = e.dataTransfer.getData('bookingId') || undefined
                  if (jobId && onUnscheduledDrop) {
                    onUnscheduledDrop(jobId, day, undefined, bookingId)
                  }
                }}
              >
                <div
                  className={cn(
                    'text-sm font-mono tabular-nums font-medium mb-1',
                    !isCurrentMonth ? 'text-ink-subtle/50' : isToday(day) ? 'text-accent-strong' : 'text-ink'
                  )}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 md:space-y-1 relative z-10">
                  {/* Multi-day job pills - handle week wrapping */}
                  {multiDayJobsToRender.map((jobData, _jobIndex) => {
                    const { job, jobEndDay, isJobStartDay, jobDates } = jobData

                    const isDragging =
                      dragState.job?.id === job.id &&
                      (dragState.job?.bookingId == null
                        ? job.bookingId == null
                        : dragState.job.bookingId === job.bookingId)
                    const isMonthMoving = isDragging && dragState.type === 'month-move'
                    const translateX = isMonthMoving ? dragOffset.x : 0
                    const translateY = isMonthMoving ? dragOffset.y : 0

                    // Calculate the segment: from this day to end of week or end of job, whichever comes first
                    const thisWeekEnd = endOfWeek(day, { weekStartsOn: 0 })
                    const segmentEnd = jobEndDay < thisWeekEnd ? jobEndDay : thisWeekEnd

                    // Get all dates in this segment that are part of the job, starting from current day
                    const segmentDates = eachDayOfInterval({ start: day, end: segmentEnd })
                    const validSegmentDates = segmentDates.filter(d =>
                      jobDates.some(jd => isSameDay(jd, d))
                    )

                    if (validSegmentDates.length === 0) return null

                    // Calculate how many days this segment spans from the current day
                    const segmentSpanDays = validSegmentDates.length
                    const daysUntilEndOfRow = 7 - dayColumn
                    const segmentSpansToEndOfRow = segmentSpanDays >= daysUntilEndOfRow
                    const segmentEndsOnJobEnd =
                      validSegmentDates[validSegmentDates.length - 1]?.getTime() ===
                      jobEndDay.getTime()

                    // Lane positioning: use global lane from jobLaneMap (all overlapping jobs
                    // on this day, sorted by start) so jobs always wrap underneath regardless of
                    // which cell they render in vs overflow from
                    const lane = jobLaneMap.get(job.id) ?? 0
                    const topOffsetMobile = lane * monthLaneStepMobileRem
                    const topOffsetDesktop = lane * monthLaneStepDesktopRem

                    const jobColors = getJobColors(job)
                    return (
                      <div
                        key={`${job.id}-${day.toISOString()}`}
                        onPointerDown={e => {
                          e.stopPropagation()
                          handleDragStart(e, job, 'month-move')
                        }}
                        onClick={e => {
                          e.stopPropagation()
                          if (justDraggedRef.current) {
                            justDraggedRef.current = false
                            return
                          }
                          if (dragState.isDragging) return
                          onJobClick(job)
                        }}
                        className={cn(
                          'month-multi-day-pill text-[10px] md:text-xs p-0.5 md:p-1 leading-4 cursor-grab active:cursor-grabbing touch-none border-l-2 border-current/40 truncate relative flex items-center overflow-hidden',
                          'hover:opacity-80',
                          !isCurrentMonth && 'opacity-60',
                          jobColors.chip,
                          isJobStartDay && 'rounded-l', // Rounded on left only if job starts here
                          (segmentEndsOnJobEnd || segmentSpansToEndOfRow) && 'rounded-r' // Rounded on right if end of job or row
                        )}
                        style={
                          {
                            position: 'absolute',
                            left: '0.125rem',
                            top: `${topOffsetMobile}rem`,
                            height: `${monthBarHeightMobileRem}rem`,
                            width: `calc(${Math.min(segmentSpanDays, daysUntilEndOfRow)} * (100% + 0.25rem + 1px) - 0.25rem)`,
                            '--top-desktop': `${topOffsetDesktop}rem`,
                            '--height-desktop': `${monthPillHeightRem}rem`,
                            transform: isMonthMoving
                              ? `translate3d(${translateX}px, ${translateY}px, 0)`
                              : undefined,
                            transition: isMonthMoving || justFinishedDrag ? 'none' : undefined,
                            willChange: isMonthMoving ? 'transform' : undefined,
                            zIndex: isMonthMoving && dragState.isDragging ? 50 : 5,
                            pointerEvents:
                              isMonthMoving && dragState.isDragging ? 'none' : undefined,
                          } as React.CSSProperties & {
                            '--top-desktop': string
                            '--height-desktop': string
                          }
                        }
                        title={job.title}
                      >
                        {isJobPaid(job) && (
                          <PaidCheck className="hidden sm:inline-flex h-3 w-3 mr-0.5" />
                        )}
                        {isJobStartDay ? (
                          <span className="hidden sm:inline">
                            {format(new Date(job.startTime!), 'h:mm a')} {job.title}
                          </span>
                        ) : (
                          <span className="hidden sm:inline">{job.title}</span>
                        )}
                      </div>
                    )
                  })}

                  {/* Reserve lane height for multi-day pills (prevents overlap with timed jobs). */}
                  {allMultiDayJobsActiveOnDay > 0 && (
                    <div
                      aria-hidden="true"
                      className="month-multiday-lane-spacer pointer-events-none"
                      style={
                        {
                          height: `${allMultiDayJobsActiveOnDay * monthLaneStepMobileRem}rem`,
                          '--spacer-height-desktop': `${allMultiDayJobsActiveOnDay * monthLaneStepDesktopRem}rem`,
                        } as React.CSSProperties & { '--spacer-height-desktop': string }
                      }
                    />
                  )}

                  {/* Mobile (<sm): colored dots. Tap the cell to drill into the day. */}
                  <div className="flex flex-wrap items-center gap-1 sm:hidden">
                    {singleDayJobs.slice(0, 6).map(job => {
                      if (!job.startTime || !job.endTime) return null
                      const jobColors = getJobColors(job)
                      return (
                        <div
                          key={getRowKey(job)}
                          className={cn(
                            'w-2 h-2 rounded-full flex-shrink-0',
                            jobColors.dot,
                            !isCurrentMonth && 'opacity-60'
                          )}
                          title={job.title}
                        />
                      )
                    })}
                    {singleDayJobs.length > 6 && (
                      <span
                        className={cn(
                          'text-[10px] leading-none text-ink-subtle',
                          !isCurrentMonth && 'opacity-60'
                        )}
                      >
                        +{singleDayJobs.length - 6}
                      </span>
                    )}
                  </div>

                  {/* Desktop (≥sm): single-day pills */}
                  <div className="hidden sm:block space-y-1">
                    {singleDayJobs.slice(0, scaleSettings.maxItems).map(job => {
                      // Skip jobs without scheduled times (already filtered, but TypeScript needs this)
                      if (!job.startTime || !job.endTime) return null

                      const isDragging =
                        dragState.job?.id === job.id &&
                        (dragState.job?.bookingId == null
                          ? job.bookingId == null
                          : dragState.job.bookingId === job.bookingId)
                      const isMonthMoving = isDragging && dragState.type === 'month-move'
                      const translateX = isMonthMoving ? dragOffset.x : 0
                      const translateY = isMonthMoving ? dragOffset.y : 0

                      const jobColors = getJobColors(job)
                      return (
                        <div
                          key={getRowKey(job)}
                          className={cn(
                            'text-xs p-1 rounded flex items-center gap-1 min-w-0 overflow-hidden cursor-grab active:cursor-grabbing touch-none',
                            'border-l-2 border-current/40',
                            !isCurrentMonth && 'opacity-60',
                            'hover:opacity-80',
                            jobColors.chip
                          )}
                          style={
                            {
                              transform: isMonthMoving
                                ? `translate3d(${translateX}px, ${translateY}px, 0)`
                                : undefined,
                              transition: isMonthMoving || justFinishedDrag ? 'none' : undefined,
                              willChange: isMonthMoving ? 'transform' : undefined,
                              zIndex: isMonthMoving && dragState.isDragging ? 50 : 1, // Lower z-index than multi-day jobs (5)
                              pointerEvents:
                                isMonthMoving && dragState.isDragging ? 'none' : undefined,
                            } as React.CSSProperties
                          }
                          onPointerDown={e => {
                            e.stopPropagation()
                            handleDragStart(e, job, 'month-move')
                          }}
                          onClick={e => {
                            e.stopPropagation()
                            if (justDraggedRef.current) {
                              justDraggedRef.current = false
                              return
                            }
                            if (dragState.isDragging) return
                            onJobClick(job)
                          }}
                          title={job.title}
                        >
                          {isJobPaid(job) && <PaidCheck className="h-3 w-3" />}
                          <span className="min-w-0 truncate">
                            {format(new Date(job.startTime), 'h:mm a')} {job.title}
                          </span>
                        </div>
                      )
                    })}
                    {singleDayJobs.length > scaleSettings.maxItems && (
                      <div
                        className={cn(
                          'text-xs text-ink-subtle',
                          !isCurrentMonth && 'opacity-60'
                        )}
                      >
                        +{singleDayJobs.length - scaleSettings.maxItems} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-w-0 rounded-xl bg-surface border border-line shadow-card overflow-hidden select-none">
      {/* Drag ghost overlay (follows pointer for real-time movement) - only for move operations */}
      {dragGhost?.isVisible &&
        dragState.job &&
        (dragState.type === 'move' || dragState.type === 'week-all-day-move') && (
          <div
            className={cn(
              'fixed pointer-events-none z-[9999] rounded-lg border-l-4 border-current/40 shadow-pop opacity-95',
              eventToneCls[resolveJobStatus(dragState.job.status).tone]
            )}
            style={{
              left: 0,
              top: 0,
              width: dragGhost.width,
              height: dragGhost.height,
              transform: `translate3d(${dragGhost.x}px, ${dragGhost.y}px, 0) scale(1.03)`,
              willChange: 'transform',
            }}
          >
            <div className="p-2">
              {previewStartTime && dragState.originalEndTime ? (
                <>
                  <div className="text-sm font-medium font-mono tabular-nums">
                    {format(previewStartTime, 'h:mm a')} -{' '}
                    {format(
                      new Date(
                        previewStartTime.getTime() +
                          (new Date(dragState.originalEndTime).getTime() -
                            new Date(dragState.originalStartTime!).getTime())
                      ),
                      'h:mm a'
                    )}
                  </div>
                  <div className="text-xs font-mono tabular-nums opacity-80">
                    {Math.round(
                      (new Date(dragState.originalEndTime).getTime() -
                        new Date(dragState.originalStartTime!).getTime()) /
                        60000
                    )}{' '}
                    min
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium font-mono tabular-nums">
                    {dragState.job.startTime &&
                      dragState.job.endTime &&
                      `${format(new Date(dragState.job.startTime), 'h:mm a')} - ${format(new Date(dragState.job.endTime), 'h:mm a')}`}
                  </div>
                  <div className="text-xs opacity-80">Dragging...</div>
                </>
              )}
            </div>
          </div>
        )}

      {/* Toolbar - min-w-0 prevents overflow, overflow-x-hidden ensures no horizontal scroll */}
      <div
        className="flex flex-row items-center justify-between gap-1.5 sm:gap-3 p-2.5 sm:p-3 md:p-4 border-b border-line overflow-x-hidden overflow-y-hidden flex-shrink-0 min-w-0"
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      >
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-h-0 min-w-0">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-lg transition-colors flex-shrink-0 min-h-[2.25rem] sm:min-h-0 text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Previous"
          >
            <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={goToToday}
            className="px-2.5 sm:px-3 md:px-4 py-2 rounded-lg bg-accent-soft hover:opacity-80 text-accent-strong font-semibold transition-opacity text-sm md:text-base whitespace-nowrap flex-shrink-0 min-h-[2.25rem] sm:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Today
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-lg transition-colors flex-shrink-0 min-h-[2.25rem] sm:min-h-0 text-ink-muted hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            aria-label="Next"
          >
            <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink min-w-0 min-h-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 min-h-0">
            <button
              onClick={() => onViewModeChange('day')}
              className={cn(
                'px-2.5 sm:px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors text-sm whitespace-nowrap min-h-[2.25rem] sm:min-h-0 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                viewMode === 'day'
                  ? 'bg-accent-soft text-accent-strong'
                  : 'bg-surface-2 text-ink-muted hover:bg-surface-hover hover:text-ink'
              )}
            >
              Day
            </button>
            <button
              onClick={() => onViewModeChange('week')}
              className={cn(
                'px-2.5 sm:px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors text-sm whitespace-nowrap min-h-[2.25rem] sm:min-h-0 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                viewMode === 'week'
                  ? 'bg-accent-soft text-accent-strong'
                  : 'bg-surface-2 text-ink-muted hover:bg-surface-hover hover:text-ink'
              )}
            >
              Week
            </button>
            <button
              onClick={() => onViewModeChange('month')}
              className={cn(
                'px-2.5 sm:px-3 md:px-4 py-2 rounded-lg font-semibold transition-colors text-sm whitespace-nowrap min-h-[2.25rem] sm:min-h-0 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                viewMode === 'month'
                  ? 'bg-accent-soft text-accent-strong'
                  : 'bg-surface-2 text-ink-muted hover:bg-surface-hover hover:text-ink'
              )}
            >
              Month
            </button>
          </div>

          {/* Zoom Control - Only show in month view and hidden on mobile */}
          {viewMode === 'month' && (
            <div className="hidden md:flex items-center gap-1 border-l border-line pl-2 flex-shrink-0">
              <span className="text-xs mr-1 text-ink-subtle">Zoom:</span>
              {[100, 125, 150, 175].map(scale => (
                <button
                  key={scale}
                  onClick={() => setCalendarScale(scale)}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-mono tabular-nums font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                    calendarScale === scale
                      ? 'bg-accent-soft text-accent-strong'
                      : 'bg-surface-2 text-ink-subtle hover:bg-surface-hover hover:text-ink'
                  )}
                >
                  {scale}%
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Calendar content */}
      <div className="flex-1 overflow-hidden relative">
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}

        {/* Mobile-only: day-view sliding transition from month view.
            Slides up over the month view, then onDateClick fires to swap viewMode
            to 'day' as this sheet unmounts (same renderDayView underneath → seamless). */}
        {mobileDaySheetMounted && viewMode === 'month' && (
          <div
            className={cn(
              'absolute inset-0 z-30 flex flex-col sm:hidden bg-surface',
              'transform transition-transform duration-300 ease-out will-change-transform',
              mobileDaySheetOpen ? 'translate-y-0' : 'translate-y-full'
            )}
          >
            {renderDayView()}
          </div>
        )}
      </div>

      <NotifyClientModal
        isOpen={showNotifyClientModal}
        onClose={() => {
          if (notifyHandledRef.current) return
          notifyHandledRef.current = true
          if (pendingUpdatePayload) {
            const { isIndependent, ...rest } = pendingUpdatePayload as { isIndependent?: boolean; id: string; startTime?: string; endTime?: string; bookingId?: string; notifyClient?: boolean }
            if (isIndependent) {
              updateIndependentBooking(rest.id, { startTime: rest.startTime as string, endTime: rest.endTime as string, notifyClient: false })
                .then(() => onUpdateSuccess?.('Appointment updated successfully'))
                .catch(error =>
                  reportScheduleUpdateError(error, 'Could not update this appointment. If this keeps happening, ask an admin to check your permissions.')
                )
            } else {
              updateJob({ ...rest, notifyClient: false })
                .then(() => onUpdateSuccess?.('Job updated successfully'))
                .catch(error =>
                  reportScheduleUpdateError(error, 'Could not update this job. If this keeps happening, ask an admin to check your permissions.')
                )
            }
          }
          setShowNotifyClientModal(false)
          setPendingUpdatePayload(null)
        }}
        onNotify={(notify) => {
          if (notifyHandledRef.current) return
          notifyHandledRef.current = true
          if (pendingUpdatePayload) {
            const { isIndependent, ...rest } = pendingUpdatePayload as { isIndependent?: boolean; id: string; startTime?: string; endTime?: string; bookingId?: string; notifyClient?: boolean }
            const successMessage = notify ? 'Sent via email and SMS' : (isIndependent ? 'Appointment updated successfully' : 'Job updated successfully')
            if (isIndependent) {
              updateIndependentBooking(rest.id, { startTime: rest.startTime as string, endTime: rest.endTime as string, notifyClient: notify })
                .then(() => onUpdateSuccess?.(successMessage))
                .catch(error =>
                  reportScheduleUpdateError(error, 'Could not update this appointment. If this keeps happening, ask an admin to check your permissions.')
                )
            } else {
              updateJob({ ...rest, notifyClient: notify })
                .then(() => onUpdateSuccess?.(successMessage))
                .catch(error =>
                  reportScheduleUpdateError(error, 'Could not update this job. If this keeps happening, ask an admin to check your permissions.')
                )
            }
          }
          setShowNotifyClientModal(false)
          setPendingUpdatePayload(null)
        }}
      />
    </div>
  )
}

export default Calendar
