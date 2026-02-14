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
import { getTeamMemberColors } from '@/lib/utils/teamColors'
import type { User } from '@/features/auth'
import { services } from '@/lib/api/services'

interface CalendarProps {
  jobs: Job[]
  viewMode: 'day' | 'week' | 'month'
  currentDate: Date
  onDateChange: (date: Date) => void
  onViewModeChange: (mode: 'day' | 'week' | 'month') => void
  onJobClick: (job: Job) => void
  onDateClick: (date: Date) => void
  onUnscheduledDrop?: (jobId: string, targetDate: Date, targetHour?: number) => void
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
  user,
}: CalendarProps) => {
  // Determine if we should use team member colors (for admin/owner)
  const useTeamColors = user?.role === 'admin' || user?.role === 'owner'
  
  // Fetch team members and create color map
  const [userColorMap, setUserColorMap] = useState<Record<string, string>>({})
  
  useEffect(() => {
    if (useTeamColors) {
      const loadTeamMembers = async () => {
        try {
          const teamMembers = await services.users.getAll()
          const colorMap: Record<string, string> = {}
          teamMembers.forEach((member: { name: string; color?: string | null }) => {
            if (member.name && member.color) {
              // Map both exact name and lowercase name for flexibility
              colorMap[member.name] = member.color
              colorMap[member.name.toLowerCase()] = member.color
            }
          })
          setUserColorMap(colorMap)
        } catch (error) {
          console.error('Failed to load team members for color mapping:', error)
        }
      }
      loadTeamMembers()
    }
  }, [useTeamColors])

  // Helper function to get job colors based on user role
  const getJobColors = (job: Job) => {
    if (useTeamColors) {
      return getTeamMemberColors(job.assignedToName, userColorMap)
    }
    // Fall back to status-based colors for employees
    switch (job.status) {
      case 'scheduled':
        return { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-300', isMultiAssignment: false, memberCount: 0 }
      case 'in-progress':
        return { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-300', isMultiAssignment: false, memberCount: 0 }
      case 'completed':
        return { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-300', isMultiAssignment: false, memberCount: 0 }
      case 'cancelled':
        return { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-300', isMultiAssignment: false, memberCount: 0 }
      case 'pending-confirmation':
        return { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-300', isMultiAssignment: false, memberCount: 0 }
      default:
        return { bg: 'bg-gray-500/20', border: 'border-gray-500', text: 'text-gray-300', isMultiAssignment: false, memberCount: 0 }
    }
  }
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

  const { updateJob } = useJobStore()

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

  // Update scale and viewport height when window is resized
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768
      setCalendarScale(isMobile ? 100 : 125)
      setViewportHeight(window.innerHeight)
    }

    handleResize() // Initial call
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

  // Get jobs for a specific date (includes multi-day jobs that span this date)
  const getJobsForDate = (date: Date) => {
    return jobs.filter(job => {
      // Skip jobs without scheduled times
      if (!job.startTime || !job.endTime) return false

      const jobStartDate = startOfDay(new Date(job.startTime))
      const jobEndDate = startOfDay(new Date(job.endTime))
      const targetDate = startOfDay(date)

      // Check if the target date falls within the job's date range
      return targetDate >= jobStartDate && targetDate <= jobEndDate
    })
  }

  // Check if job spans multiple calendar days
  const isMultiDayJob = (job: Job): boolean => {
    if (!job.startTime || !job.endTime) return false
    const start = startOfDay(new Date(job.startTime))
    const end = startOfDay(new Date(job.endTime))
    return start.getTime() !== end.getTime()
  }

  // Get all dates a job spans within visible calendar range
  const getJobDateRange = (job: Job, calendarStart: Date, calendarEnd: Date): Date[] => {
    if (!job.startTime || !job.endTime) return []
    const jobStart = startOfDay(new Date(job.startTime))
    const jobEnd = startOfDay(new Date(job.endTime))
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
            layout[job.id] = { column: i, totalColumns: 0 }
            placed = true
            break
          }
        }
        if (!placed) {
          columns.push([job])
          layout[job.id] = { column: columns.length - 1, totalColumns: 0 }
        }
      })

      // Update totalColumns for all jobs in the group
      group.forEach(job => {
        layout[job.id].totalColumns = columns.length
      })
    })

    return layout
  }

  // Drag and drop handlers
  const handleDragStart = (
    e: React.PointerEvent,
    job: Job,
    type: 'move' | 'resize' | 'month-move'
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
          await updateJob({
            id: job.id,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
          })
        }
      } catch (error) {
        console.error('Failed to update job:', error)
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
    [dragState, previewStartTime, dragTargetDay, updateJob]
  )

  const handleResizeDrop = useCallback(
    async (minutesChange: number) => {
      if (!dragState.job || dragState.type !== 'resize' || !dragState.job.startTime) return

      const { job, originalEndTime } = dragState

      try {
        // Snap to 15-minute increments
        const snappedMinutesChange = Math.round(minutesChange / 15) * 15
        const newEndTime = addMinutes(new Date(originalEndTime!), snappedMinutesChange)

        // Ensure end time is after start time (at least 15 minutes)
        const startTime = new Date(job.startTime!)
        if (newEndTime <= startTime) return

        await updateJob({
          id: job.id,
          endTime: newEndTime.toISOString(),
        })
      } catch (error) {
        console.error('Failed to resize job:', error)
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
    [dragState, updateJob]
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

        if (dragState.type === 'resize' && dragState.originalEndTime && dragState.job.startTime) {
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
        const duration = originalEnd.getTime() - originalStart.getTime()

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

          updateJob({
            id: dragState.job.id,
            startTime: newStartTime.toISOString(),
            endTime: newEndTime.toISOString(),
          }).catch(error => {
            console.error('Failed to move job:', error)
          })
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

        updateJob({
          id: dragState.job.id,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
        }).catch(error => {
          console.error('Failed to move job:', error)
        })

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
    viewMode,
    previewStartTime,
    selectedDate,
    dragOverDate,
    onJobClick,
    handleMoveDrop,
    handleResizeDrop,
    updateJob,
  ])

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const allDayJobs = getJobsActiveOnDate(selectedDate).filter(job => isMultiDayJob(job))
    const dayJobs = getJobsForDate(selectedDate).filter(job => !isMultiDayJob(job))
    const jobLayout = calculateJobLayout(dayJobs)

    return (
      <div className="flex-1 overflow-y-auto" ref={dayViewRef}>
        <div className="sticky top-0 bg-primary-dark-secondary border-b border-primary-blue z-10">
          <div className="p-3 md:p-4 text-center">
            <h2 className="text-base md:text-xl font-semibold text-primary-light">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
          </div>
        </div>

        {/* All-day / Multi-day jobs section */}
        {allDayJobs.length > 0 && (
          <div className="border-b border-primary-blue/30 bg-primary-dark-secondary/50">
            <div className="p-2 md:p-3">
              <div className="text-xs md:text-sm font-medium text-primary-light/70 mb-2">
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
                      key={job.id}
                      className={cn(
                        'rounded-lg border-l-4 p-2 cursor-pointer hover:opacity-90 transition-all',
                        jobColors.bg || '',
                        jobColors.border
                      )}
                      style={jobColors.gradientStyle}
                      onClick={e => {
                        e.stopPropagation()
                        onJobClick(job)
                      }}
                    >
                      <div className="text-sm font-medium text-primary-light">{job.title}</div>
                      <div className="text-xs text-primary-light/70">{dateRange}</div>
                      {job.contactName && (
                        <div className="text-xs text-primary-light/60">{job.contactName}</div>
                      )}
                      {job.assignedToName && (
                        <div className="text-xs text-primary-light/50">→ {job.assignedToName}</div>
                      )}
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
                className="border-b border-primary-blue/30 min-h-[60px] md:min-h-[80px] relative select-none"
                data-drop-date={selectedDate.toISOString()}
                data-drop-hour={hour}
                onDragOver={e => {
                  e.preventDefault()
                  e.currentTarget.classList.add('bg-primary-gold/10')
                }}
                onDragLeave={e => {
                  e.currentTarget.classList.remove('bg-primary-gold/10')
                }}
                onDrop={e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('bg-primary-gold/10')
                  const jobId = e.dataTransfer.getData('jobId')
                  if (jobId && onUnscheduledDrop) {
                    onUnscheduledDrop(jobId, selectedDate, hour)
                  }
                }}
              >
                <div className="absolute left-0 top-0 w-12 md:w-20 p-1 md:p-2 text-xs md:text-sm text-primary-light/70">
                  {format(setHours(setMinutes(new Date(), 0), hour), 'h:mm a')}
                </div>
                <div className="ml-12 md:ml-20 p-1 md:p-2 relative">
                  {timeSlotJobs.map(job => {
                    // Skip jobs without scheduled times (already filtered, but TypeScript needs this)
                    if (!job.startTime || !job.endTime) return null

                    const layout = jobLayout[job.id] || { column: 0, totalColumns: 1 }
                    const isDragging = dragState.job?.id === job.id
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
                    const endMinutes =
                      isResizing && previewEndTime
                        ? getHours(previewEndTime) * 60 + getMinutes(previewEndTime)
                        : getHours(originalEndTime) * 60 + getMinutes(originalEndTime)
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
                        key={job.id}
                        className={cn(
                          'absolute rounded-lg border-l-4 select-none group',
                          isDragging ? 'z-0' : 'z-10',
                          dragState.job && !isDragging && 'pointer-events-none',
                          jobColors.bg || '',
                          jobColors.border
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
                          ...jobColors.gradientStyle,
                        }}
                      >
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
                          <div className="text-sm font-medium text-primary-light pointer-events-none">
                            {job.title}
                          </div>
                          <div className="text-xs text-primary-light/70 pointer-events-none">
                            {format(displayStartTime, 'h:mm a')} -{' '}
                            {format(displayEndTime, 'h:mm a')}
                            {isResizing && ' (resizing...)'}
                            {isMoving && ' (moving...)'}
                          </div>
                          {job.contactName && (
                            <div className="text-xs text-primary-light/60 pointer-events-none">
                              {job.contactName}
                            </div>
                          )}
                          {job.assignedToName && (
                            <div className="text-xs text-primary-light/50 pointer-events-none">
                              → {job.assignedToName}
                            </div>
                          )}
                        </div>

                        {/* Resize handle - bottom 24px always accessible */}
                        <div
                          className="absolute bottom-0 left-0 right-0 cursor-ns-resize group-hover:bg-white/5 hover:!bg-white/10 transition-colors flex items-center justify-center touch-none"
                          style={{ height: '24px', zIndex: 20 }}
                          onPointerDown={e => {
                            e.stopPropagation()
                            handleDragStart(e, job, 'resize')
                          }}
                        >
                          <div className="w-8 h-1 bg-primary-light/30 group-hover:bg-primary-light/50 rounded-full pointer-events-none"></div>
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
          <div className="sticky top-0 bg-primary-dark-secondary border-b border-primary-blue z-10">
            <div className="p-3 md:p-4 text-center">
              <h2 className="text-base md:text-xl font-semibold text-primary-light">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </h2>
            </div>
          </div>
          <div className="flex overflow-x-auto min-w-0">
            {/* Time column */}
            <div className="w-12 md:w-20 flex-shrink-0 border-r border-primary-blue/30 sticky left-0 bg-primary-dark-secondary z-10">
              {/* Empty space for day headers */}
              <div className="h-10 md:h-12 border-b border-primary-blue/30"></div>
              {/* All-day slot label */}
              <div className="h-7 md:h-9 border-b border-primary-blue/30 p-1 md:p-2 text-xs text-primary-light/70 font-normal">
                All Day
              </div>
              {/* Time slots */}
              {hours.map(hour => (
                <div
                  key={hour}
                  className="h-12 md:h-20 border-b border-primary-blue/30 p-1 md:p-2 text-xs text-primary-light/70"
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
                      'w-[100px] md:flex-1 md:min-w-0 flex-shrink-0 border-r border-primary-blue/30 last:border-r-0 flex flex-col',
                      dragState.type === 'move' &&
                        dragTargetDay &&
                        isSameDay(dragTargetDay, day) &&
                        'bg-primary-gold/5'
                    )}
                    ref={el => {
                      if (el) {
                        weekColumnsRef.current.set(dayIndex, el.getBoundingClientRect())
                      }
                    }}
                  >
                    {/* Day header */}
                    <div
                      className={cn(
                        'h-10 md:h-12 border-b border-primary-blue/30 cursor-pointer hover:bg-primary-blue/10 flex-shrink-0',
                        isToday(day) && 'border-l-4 border-primary-gold'
                      )}
                      onClick={() => onDateClick(day)}
                    >
                      <div className="p-1 md:p-2 text-center w-full">
                        <div className="text-xs text-primary-light/70">
                          <span className="hidden sm:inline">{format(day, 'EEE')}</span>
                          <span className="sm:hidden">{format(day, 'EEEEE')}</span>
                        </div>
                        <div
                          className={cn(
                            'text-xs md:text-sm font-medium',
                            isToday(day) ? 'text-primary-gold' : 'text-primary-light',
                            isSameDay(day, selectedDate) &&
                              'ring-2 ring-primary-gold rounded-full w-5 h-5 md:w-6 md:h-6 mx-auto flex items-center justify-center'
                          )}
                        >
                          {format(day, 'd')}
                        </div>
                      </div>
                    </div>

                    {/* All-day slot - dedicated row for multi-day jobs */}
                    <div className="h-7 md:h-9 border-b border-primary-blue/30 relative flex-shrink-0 overflow-visible">
                      {/* Render multi-day jobs on the first day they appear in this week */}
                      {allDayJobs
                        .filter(job => {
                          if (!job.startTime || !job.endTime) return false
                          const jobStartDay = startOfDay(new Date(job.startTime))
                          const jobEndDay = startOfDay(new Date(job.endTime))

                          // Calculate the first day this job appears in the week
                          const firstDayInWeek = jobStartDay < weekStart ? weekStart : jobStartDay

                          // Only render on the first day the job appears in this week
                          return isSameDay(startOfDay(day), firstDayInWeek)
                        })
                        .map(job => {
                          if (!job.startTime || !job.endTime) return null

                          const jobStartDay = startOfDay(new Date(job.startTime))
                          const jobEndDay = startOfDay(new Date(job.endTime))

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
                          const isDragging = dragState.job?.id === job.id
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

                          const jobColors = getJobColors(job)
                          return (
                            <div
                              key={job.id}
                              className={cn(
                                'absolute multi-day-job-bar text-[10px] md:text-xs border-l-2 truncate cursor-grab active:cursor-grabbing hover:opacity-90 z-20 flex items-center',
                                jobColors.bg || '',
                                jobColors.border,
                                jobColors.text,
                                isJobStart && 'rounded-l',
                                isJobEnd && 'rounded-r'
                              )}
                              style={{
                                left: leftOffset,
                                top: 0,
                                bottom: 0,
                                width: `calc(${spanDays} * 100% + ${spanDays - 1} * 1px)`,
                                paddingLeft: '0.125rem',
                                paddingRight: '0.125rem',
                                transform: isMoving
                                  ? `translate3d(${translateX}px, ${translateY}px, 0)`
                                  : undefined,
                                transition: isMoving || justFinishedDrag ? 'none' : 'all 0.2s ease',
                                opacity: isMoving && dragState.isDragging ? 0.5 : 1,
                                ...jobColors.gradientStyle,
                              }}
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
                              title={job.title}
                            >
                              <span className="truncate">{job.title}</span>
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
                            className="h-12 md:h-20 border-b border-primary-blue/30 relative select-none"
                            data-drop-date={day.toISOString()}
                            data-drop-hour={hour}
                            onDragOver={e => {
                              e.preventDefault()
                              e.currentTarget.classList.add('bg-primary-gold/10')
                            }}
                            onDragLeave={e => {
                              e.currentTarget.classList.remove('bg-primary-gold/10')
                            }}
                            onDrop={e => {
                              e.preventDefault()
                              e.currentTarget.classList.remove('bg-primary-gold/10')
                              const jobId = e.dataTransfer.getData('jobId')
                              if (jobId && onUnscheduledDrop) {
                                onUnscheduledDrop(jobId, day, hour)
                              }
                            }}
                          >
                            {timeSlotJobs.map(job => {
                              // Skip jobs without scheduled times (already filtered, but TypeScript needs this)
                              if (!job.startTime || !job.endTime) return null

                              const layout = jobLayout[job.id] || { column: 0, totalColumns: 1 }
                              const isDragging = dragState.job?.id === job.id
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
                              const endMinutes =
                                isResizing && previewEndTime
                                  ? getHours(previewEndTime) * 60 + getMinutes(previewEndTime)
                                  : getHours(originalEndTime) * 60 + getMinutes(originalEndTime)
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
                                  key={job.id}
                                  className={cn(
                                    'absolute rounded text-xs border-l-2 select-none group',
                                    isDragging ? 'z-0' : 'z-10',
                                    dragState.job && !isDragging && 'pointer-events-none',
                                    jobColors.bg || '',
                                    jobColors.border
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
                                    ...jobColors.gradientStyle,
                                  }}
                                >
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
                                    <div className="font-medium text-primary-light truncate pointer-events-none">
                                      {job.title}
                                    </div>
                                    <div className="text-primary-light/70 truncate pointer-events-none">
                                      <span className="hidden sm:inline">
                                        {format(displayStartTime, 'h:mm a')}
                                      </span>
                                      <span className="sm:hidden">
                                        {format(displayStartTime, 'h:mm')}
                                      </span>
                                      {(isResizing || isMoving) && (
                                        <span className="hidden sm:inline">
                                          {' '}
                                          - {format(displayEndTime, 'h:mm a')}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Resize handle - bottom 16px always accessible */}
                                  <div
                                    className="absolute bottom-0 left-0 right-0 cursor-ns-resize group-hover:bg-white/5 hover:!bg-white/10 transition-colors flex items-center justify-center touch-none"
                                    style={{ height: '16px', zIndex: 20 }}
                                    onPointerDown={e => {
                                      e.stopPropagation()
                                      handleDragStart(e, job, 'resize')
                                    }}
                                  >
                                    <div className="w-6 h-0.5 bg-primary-light/30 group-hover:bg-primary-light/50 rounded-full pointer-events-none"></div>
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
          dynamicHeight: cellHeight
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
    const monthLaneStepMobileRem = 1.25
    const monthLaneStepDesktopRem = 1.5

    // Group multi-day jobs by their first visible day to avoid duplicates
    const multiDayJobMap = new Map<string, Job>()
    jobs.forEach(job => {
      if (job.startTime && job.endTime && isMultiDayJob(job)) {
        const jobDates = getJobDateRange(job, calendarStart, calendarEnd)
        if (jobDates.length > 0) {
          const firstDate = jobDates[0].toISOString()
          if (!multiDayJobMap.has(firstDate) || jobDates.length > 1) {
            multiDayJobMap.set(job.id, job)
          }
        }
      }
    })
    const multiDayJobs = Array.from(multiDayJobMap.values())

    return (
      <div ref={monthViewRef} className="flex-1 overflow-auto p-0.5">
        <style>{`
          /* Month view helpers for multi-day layout */
          @media (min-width: 768px) {
            .month-multi-day-pill {
              top: var(--top-desktop, 0) !important;
            }
            .month-multiday-lane-spacer {
              height: var(--spacer-height-desktop, 0) !important;
            }
          }
        `}</style>
        <div className="sticky top-0 bg-primary-dark-secondary border-b border-primary-blue z-10">
          <div className="p-3 md:p-4 text-center">
            <h2 className="text-base md:text-xl font-semibold text-primary-light">
              {format(selectedDate, 'MMMM yyyy')}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-7 relative">
          {/* Week day headers */}
          {weekDays.map(day => (
            <div
              key={day}
              className="p-1 md:p-2 text-center text-xs md:text-sm font-medium text-primary-light/70 border-b border-primary-blue/30"
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
                const jobEndDay = startOfDay(new Date(job.endTime!))
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

            // Count ALL multi-day jobs active on this day (for spacing calculation)
            // multiDayJobsForDay already includes all multi-day jobs that span this day,
            // regardless of where their pill is rendered
            const allMultiDayJobsActiveOnDay = multiDayJobsForDay.length

            const isCurrentMonth = isSameMonth(day, selectedDate)
            const isSelected = isSameDay(day, selectedDate)
            const isDropTarget =
              dragOverDate && isSameDay(dragOverDate, day) && dragState.type === 'month-move'
            const isFirstColumn = dayColumn === 0
            const isLastColumn = dayColumn === 6

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  // Only use Tailwind minHeight class on desktop (when dynamicHeight is not set)
                  !scaleSettings.dynamicHeight && scaleSettings.minHeight,
                  'border-b border-r border-primary-blue/30 p-1 md:p-2 cursor-pointer hover:bg-primary-blue/10 transition-colors relative select-none overflow-visible',
                  isToday(day) && 'border-2 border-primary-gold',
                  isDropTarget && 'bg-primary-gold/20 ring-2 ring-primary-gold'
                )}
                style={
                  scaleSettings.dynamicHeight
                    ? { minHeight: `${scaleSettings.dynamicHeight}px` }
                    : undefined
                }
                data-drop-date={day.toISOString()}
                onClick={() => {
                  setSelectedDate(day)
                  onDateClick(day)
                }}
                onDragOver={e => {
                  e.preventDefault()
                  e.currentTarget.classList.add('bg-primary-gold/20')
                }}
                onDragLeave={e => {
                  e.currentTarget.classList.remove('bg-primary-gold/20')
                }}
                onDrop={async e => {
                  e.preventDefault()
                  e.currentTarget.classList.remove('bg-primary-gold/20')

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
                    const originalJob = jobs.find(j => j.id === monthJobId)
                    if (originalJob && originalJob.startTime && originalJob.endTime) {
                      const duration =
                        new Date(originalJob.endTime).getTime() -
                        new Date(originalJob.startTime).getTime()
                      const newEndTime = new Date(newStartTime.getTime() + duration)
                      await updateJob({
                        id: monthJobId,
                        startTime: newStartTime.toISOString(),
                        endTime: newEndTime.toISOString(),
                      })
                    }
                    return
                  }

                  // Handle unscheduled job drop
                  const jobId = e.dataTransfer.getData('jobId')
                  if (jobId && onUnscheduledDrop) {
                    // Month view: no specific hour, will default to 9 AM
                    onUnscheduledDrop(jobId, day)
                  }
                }}
              >
                <div
                  className={cn(
                    'text-xs md:text-sm font-medium mb-0.5 md:mb-1',
                    !isCurrentMonth && 'opacity-40',
                    isToday(day) ? 'text-primary-gold' : 'text-primary-light'
                  )}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 md:space-y-1 relative z-10">
                  {/* Multi-day job pills - handle week wrapping */}
                  {multiDayJobsToRender.map((jobData, jobIndex) => {
                    const { job, jobStartDay, jobEndDay, isJobStartDay, jobDates } = jobData

                    const isDragging = dragState.job?.id === job.id
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

                    // Lane positioning for stacking multi-day segments
                    const topOffsetMobile = jobIndex * monthLaneStepMobileRem
                    const topOffsetDesktop = jobIndex * monthLaneStepDesktopRem

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
                          'month-multi-day-pill text-[10px] md:text-xs p-0.5 md:p-1 leading-4 cursor-grab active:cursor-grabbing touch-none border-l-2 truncate relative',
                          'hover:opacity-80',
                          !isCurrentMonth && 'opacity-60',
                          jobColors.bg,
                          jobColors.border,
                          jobColors.text,
                          isJobStartDay && 'rounded-l', // Rounded on left only if job starts here
                          (segmentEndsOnJobEnd || segmentSpansToEndOfRow) && 'rounded-r', // Rounded on right if end of job or row
                          // Add visual indicator for multi-assignment
                          jobColors.isMultiAssignment && 'border-l-2 border-r border-t border-b'
                        )}
                        style={
                          {
                            position: 'absolute',
                            left: '0.125rem',
                            top: `${topOffsetMobile}rem`,
                            width: `calc(${Math.min(segmentSpanDays, daysUntilEndOfRow)} * (100% + 0.25rem + 1px) - 0.25rem)`,
                            '--top-desktop': `${topOffsetDesktop}rem`,
                            transform: isMonthMoving
                              ? `translate3d(${translateX}px, ${translateY}px, 0)`
                              : undefined,
                            transition: isMonthMoving || justFinishedDrag ? 'none' : undefined,
                            willChange: isMonthMoving ? 'transform' : undefined,
                            zIndex: isMonthMoving && dragState.isDragging ? 50 : 5,
                            pointerEvents:
                              isMonthMoving && dragState.isDragging ? 'none' : undefined,
                          } as React.CSSProperties & { '--top-desktop': string }
                        }
                        title={job.title}
                      >
                        {isJobStartDay ? (
                          <>
                            <span className="hidden sm:inline">
                              {format(new Date(job.startTime!), 'h:mm a')} {job.title}
                            </span>
                            <span className="sm:hidden">
                              {format(new Date(job.startTime!), 'h:mm')}
                            </span>
                          </>
                        ) : (
                          <span>{job.title}</span>
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

                  {/* Single-day jobs - positioned below multi-day jobs */}
                  {singleDayJobs.slice(0, scaleSettings.maxItems).map((job, singleJobIndex) => {
                    // Skip jobs without scheduled times (already filtered, but TypeScript needs this)
                    if (!job.startTime || !job.endTime) return null

                    const isDragging = dragState.job?.id === job.id
                    const isMonthMoving = isDragging && dragState.type === 'month-move'
                    const translateX = isMonthMoving ? dragOffset.x : 0
                    const translateY = isMonthMoving ? dragOffset.y : 0

                    const jobColors = getJobColors(job)
                    return (
                      <div
                        key={job.id}
                        className={cn(
                          'text-[10px] md:text-xs p-0.5 md:p-1 rounded truncate cursor-grab active:cursor-grabbing touch-none',
                          'border-l-2',
                          !isCurrentMonth && 'opacity-60',
                          'hover:opacity-80',
                          jobColors.bg || '',
                          jobColors.border,
                          jobColors.text
                        )}
                        style={{
                          transform: isMonthMoving
                            ? `translate3d(${translateX}px, ${translateY}px, 0)`
                            : undefined,
                          transition: isMonthMoving || justFinishedDrag ? 'none' : undefined,
                          willChange: isMonthMoving ? 'transform' : undefined,
                          zIndex: isMonthMoving && dragState.isDragging ? 50 : 1, // Lower z-index than multi-day jobs (5)
                          pointerEvents:
                            isMonthMoving && dragState.isDragging ? 'none' : undefined,
                          ...jobColors.gradientStyle,
                        } as React.CSSProperties
                        }
                        onPointerDown={e => {
                          // Month view: use pointer-based drag for ALL devices (mouse + touch)
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
                        <span className="hidden sm:inline">
                          {format(new Date(job.startTime), 'h:mm a')} {job.title}
                        </span>
                        <span className="sm:hidden">{format(new Date(job.startTime), 'h:mm')}</span>
                      </div>
                    )
                  })}
                  {singleDayJobs.length > scaleSettings.maxItems && (
                    <div
                      className={cn(
                        'text-[10px] md:text-xs text-primary-light/50',
                        !isCurrentMonth && 'opacity-60'
                      )}
                    >
                      +{singleDayJobs.length - scaleSettings.maxItems} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-primary-dark-secondary rounded-lg border border-primary-blue overflow-hidden select-none">
      {/* Drag ghost overlay (follows pointer for real-time movement) - only for move operations */}
      {dragGhost?.isVisible &&
        dragState.job &&
        (dragState.type === 'move' || dragState.type === 'week-all-day-move') && (
          <div
            className="fixed pointer-events-none z-[9999] rounded-lg border-l-4 shadow-2xl opacity-95"
            style={{
              left: 0,
              top: 0,
              width: dragGhost.width,
              height: dragGhost.height,
              transform: `translate3d(${dragGhost.x}px, ${dragGhost.y}px, 0) scale(1.03)`,
              willChange: 'transform',
              background:
                dragState.job.status === 'scheduled'
                  ? 'rgba(59, 130, 246, 0.25)'
                  : dragState.job.status === 'in-progress'
                    ? 'rgba(234, 179, 8, 0.25)'
                    : dragState.job.status === 'completed'
                      ? 'rgba(34, 197, 94, 0.25)'
                      : dragState.job.status === 'cancelled'
                        ? 'rgba(239, 68, 68, 0.25)'
                        : 'rgba(249, 115, 22, 0.25)',
              borderLeftColor:
                dragState.job.status === 'scheduled'
                  ? 'rgb(59, 130, 246)'
                  : dragState.job.status === 'in-progress'
                    ? 'rgb(234, 179, 8)'
                    : dragState.job.status === 'completed'
                      ? 'rgb(34, 197, 94)'
                      : dragState.job.status === 'cancelled'
                        ? 'rgb(239, 68, 68)'
                        : 'rgb(249, 115, 22)',
            }}
          >
            <div className="p-2">
              {previewStartTime && dragState.originalEndTime ? (
                <>
                  <div className="text-sm font-medium text-primary-light">
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
                  <div className="text-xs text-primary-light/60">
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
                  <div className="text-sm font-medium text-primary-light">
                    {dragState.job.startTime &&
                      dragState.job.endTime &&
                      `${format(new Date(dragState.job.startTime), 'h:mm a')} - ${format(new Date(dragState.job.endTime), 'h:mm a')}`}
                  </div>
                  <div className="text-xs text-primary-light/60">Dragging...</div>
                </>
              )}
            </div>
          </div>
        )}

      {/* Toolbar */}
      <div 
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 md:p-4 border-b border-primary-blue overflow-hidden flex-shrink-0"
        style={{ touchAction: 'none', overscrollBehavior: 'none' }}
      >
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 min-h-0">
          <button
            onClick={() => navigateDate('prev')}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-primary-blue/20 text-primary-light transition-colors flex-shrink-0"
            aria-label="Previous"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg bg-primary-gold/20 hover:bg-primary-gold/30 text-primary-gold font-medium transition-colors text-xs sm:text-sm md:text-base whitespace-nowrap flex-shrink-0"
          >
            Today
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="p-1.5 sm:p-2 rounded-lg hover:bg-primary-blue/20 text-primary-light transition-colors flex-shrink-0"
            aria-label="Next"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-wrap min-w-0 min-h-0">
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 min-h-0">
            <button
              onClick={() => onViewModeChange('day')}
              className={cn(
                'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap',
                viewMode === 'day'
                  ? 'bg-primary-gold text-primary-dark'
                  : 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
              )}
            >
              Day
            </button>
            <button
              onClick={() => onViewModeChange('week')}
              className={cn(
                'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap',
                viewMode === 'week'
                  ? 'bg-primary-gold text-primary-dark'
                  : 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
              )}
            >
              Week
            </button>
            <button
              onClick={() => onViewModeChange('month')}
              className={cn(
                'px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-colors text-xs sm:text-sm whitespace-nowrap',
                viewMode === 'month'
                  ? 'bg-primary-gold text-primary-dark'
                  : 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
              )}
            >
              Month
            </button>
          </div>

          {/* Zoom Control - Only show in month view and hidden on mobile */}
          {viewMode === 'month' && (
            <div className="hidden md:flex items-center gap-1 border-l border-primary-blue/50 pl-2 flex-shrink-0">
              <span className="text-xs text-primary-light/70 mr-1">Zoom:</span>
              {[100, 125, 150, 175].map(scale => (
                <button
                  key={scale}
                  onClick={() => setCalendarScale(scale)}
                  className={cn(
                    'px-2 py-1 rounded text-xs font-medium transition-colors',
                    calendarScale === scale
                      ? 'bg-primary-gold text-primary-dark'
                      : 'bg-primary-blue/10 text-primary-light/70 hover:bg-primary-blue/20'
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
      <div className="flex-1 overflow-hidden">
        {viewMode === 'day' && renderDayView()}
        {viewMode === 'week' && renderWeekView()}
        {viewMode === 'month' && renderMonthView()}
      </div>
    </div>
  )
}

export default Calendar
