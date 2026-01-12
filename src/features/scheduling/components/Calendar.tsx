import { useState, useEffect, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays, startOfDay, getHours, getMinutes, setHours, setMinutes, addMinutes } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Job } from '../types/job'
import { useJobStore } from '../store/jobStore'

interface CalendarProps {
  jobs: Job[]
  viewMode: 'day' | 'week' | 'month'
  currentDate: Date
  onDateChange: (date: Date) => void
  onViewModeChange: (mode: 'day' | 'week' | 'month') => void
  onJobClick: (job: Job) => void
  onDateClick: (date: Date) => void
}

interface DragState {
  job: Job | null
  type: 'move' | 'resize' | null
  startY: number
  originalStartTime: Date | null
  originalEndTime: Date | null
}

const Calendar = ({
  jobs,
  viewMode,
  currentDate,
  onDateChange,
  onViewModeChange,
  onJobClick,
  onDateClick,
}: CalendarProps) => {
  const [selectedDate, setSelectedDate] = useState(currentDate)
  const [calendarScale, setCalendarScale] = useState<number>(100)
  const [dragState, setDragState] = useState<DragState>({
    job: null,
    type: null,
    startY: 0,
    originalStartTime: null,
    originalEndTime: null,
  })
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null)
  const [dragOverHour, setDragOverHour] = useState<number | null>(null)
  const [previewEndTime, setPreviewEndTime] = useState<Date | null>(null)
  
  const { updateJob } = useJobStore()

  // Helper function to snap to 15-minute increments
  const snapTo15Minutes = (date: Date): Date => {
    const minutes = getMinutes(date)
    const snappedMinutes = Math.round(minutes / 15) * 15
    return setMinutes(date, snappedMinutes)
  }

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
    return jobs.filter((job) => {
      const jobStartDate = startOfDay(new Date(job.startTime))
      const jobEndDate = startOfDay(new Date(job.endTime))
      const targetDate = startOfDay(date)
      
      // Check if the target date falls within the job's date range
      return targetDate >= jobStartDate && targetDate <= jobEndDate
    })
  }

  // Get jobs for a time slot (for day/week view)
  const getJobsForTimeSlot = (date: Date, hour: number) => {
    return jobs.filter((job) => {
      const jobDate = new Date(job.startTime)
      return isSameDay(jobDate, date) && getHours(jobDate) === hour
    })
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.MouseEvent, job: Job, type: 'move' | 'resize') => {
    e.stopPropagation()
    setDragState({
      job,
      type,
      startY: e.clientY,
      originalStartTime: new Date(job.startTime),
      originalEndTime: new Date(job.endTime),
    })
  }

  const handleDragMove = (e: React.MouseEvent) => {
    if (!dragState.job || !dragState.type) return
    
    // Visual feedback handled by CSS
    const deltaY = e.clientY - dragState.startY
    // We'll calculate the actual time change on drop
  }

  const handleDrop = async (date: Date, hour: number) => {
    if (!dragState.job || !dragState.type) return

    const { job, type, originalStartTime, originalEndTime } = dragState

    try {
      if (type === 'move') {
        // Calculate new start and end times
        const originalStart = new Date(originalStartTime!)
        const originalEnd = new Date(originalEndTime!)
        const duration = originalEnd.getTime() - originalStart.getTime()
        
        // Set new start time to the dropped hour, keeping original minutes, then snap to 15 minutes
        let newStartTime = setHours(setMinutes(date, getMinutes(originalStart)), hour)
        newStartTime = snapTo15Minutes(newStartTime)
        const newEndTime = new Date(newStartTime.getTime() + duration)

        await updateJob({
          id: job.id,
          startTime: newStartTime.toISOString(),
          endTime: newEndTime.toISOString(),
        })
      }
    } catch (error) {
      console.error('Failed to update job:', error)
    }

    // Clear drag state
    setDragState({
      job: null,
      type: null,
      startY: 0,
      originalStartTime: null,
      originalEndTime: null,
    })
    setDragOverDate(null)
    setDragOverHour(null)
  }

  // Handle drop on a day (for month view - keeps same time, changes date)
  const handleDropOnDay = async (date: Date) => {
    if (!dragState.job || dragState.type !== 'move') return

    const { job, originalStartTime, originalEndTime } = dragState

    try {
      // Calculate new start and end times - same time of day, different date
      const originalStart = new Date(originalStartTime!)
      const originalEnd = new Date(originalEndTime!)
      const duration = originalEnd.getTime() - originalStart.getTime()
      
      // Keep the same time of day, but change the date, then snap to 15 minutes
      let newStartTime = setHours(setMinutes(date, getMinutes(originalStart)), getHours(originalStart))
      newStartTime = snapTo15Minutes(newStartTime)
      const newEndTime = new Date(newStartTime.getTime() + duration)

      await updateJob({
        id: job.id,
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString(),
      })
    } catch (error) {
      console.error('Failed to update job:', error)
    }

    // Clear drag state
    setDragState({
      job: null,
      type: null,
      startY: 0,
      originalStartTime: null,
      originalEndTime: null,
    })
    setDragOverDate(null)
    setDragOverHour(null)
  }

  const handleResizeDrop = async (minutesChange: number) => {
    if (!dragState.job || dragState.type !== 'resize') return

    const { job, originalEndTime } = dragState

    try {
      // Snap to 15-minute increments
      const snappedMinutesChange = Math.round(minutesChange / 15) * 15
      const newEndTime = addMinutes(new Date(originalEndTime!), snappedMinutesChange)
      
      // Ensure end time is after start time (at least 15 minutes)
      const startTime = new Date(job.startTime)
      if (newEndTime <= startTime) return

      await updateJob({
        id: job.id,
        endTime: newEndTime.toISOString(),
      })
    } catch (error) {
      console.error('Failed to resize job:', error)
    }

    // Clear drag state and preview
    setDragState({
      job: null,
      type: null,
      startY: 0,
      originalStartTime: null,
      originalEndTime: null,
    })
    setPreviewEndTime(null)
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.type === 'resize' && dragState.job && dragState.originalEndTime) {
        // Calculate real-time preview with 15-minute snapping
        const deltaY = e.clientY - dragState.startY
        const pixelsPerHour = viewMode === 'day' ? 80 : 80 // Can adjust for different views
        const minutesChange = Math.round((deltaY / pixelsPerHour) * 60)
        const snappedMinutesChange = Math.round(minutesChange / 15) * 15
        
        const newEndTime = addMinutes(new Date(dragState.originalEndTime), snappedMinutesChange)
        const startTime = new Date(dragState.job.startTime)
        
        // Only update preview if end time is after start time
        if (newEndTime > startTime) {
          setPreviewEndTime(newEndTime)
        }
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (dragState.type === 'resize' && dragState.job) {
        const deltaY = e.clientY - dragState.startY
        const pixelsPerHour = viewMode === 'day' ? 80 : 80
        const minutesChange = Math.round((deltaY / pixelsPerHour) * 60)
        handleResizeDrop(minutesChange)
      } else if (dragState.type === 'move') {
        // Drag move handled by drop zone
        setDragState({
          job: null,
          type: null,
          startY: 0,
          originalStartTime: null,
          originalEndTime: null,
        })
        setPreviewEndTime(null)
      }
    }

    if (dragState.job) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragState, viewMode])

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const dayJobs = getJobsForDate(selectedDate)

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 bg-primary-dark-secondary border-b border-primary-blue z-10">
          <div className="p-3 md:p-4 text-center">
            <h2 className="text-base md:text-xl font-semibold text-primary-light">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </h2>
          </div>
        </div>
        <div className="relative">
          {hours.map((hour) => {
            const timeSlotJobs = getJobsForTimeSlot(selectedDate, hour)
            return (
              <div
                key={hour}
                className={cn(
                  "border-b border-primary-blue/30 min-h-[60px] md:min-h-[80px] relative",
                  dragOverHour === hour && dragOverDate && isSameDay(dragOverDate, selectedDate) && "bg-primary-gold/10"
                )}
                onMouseEnter={() => {
                  if (dragState.type === 'move') {
                    setDragOverDate(selectedDate)
                    setDragOverHour(hour)
                  }
                }}
                onMouseUp={() => {
                  if (dragState.type === 'move' && dragOverHour === hour) {
                    handleDrop(selectedDate, hour)
                  }
                }}
              >
                <div className="absolute left-0 top-0 w-12 md:w-20 p-1 md:p-2 text-xs md:text-sm text-primary-light/70">
                  {format(setHours(setMinutes(new Date(), 0), hour), 'h:mm a')}
                </div>
                <div className="ml-12 md:ml-20 p-1 md:p-2">
                  {timeSlotJobs.map((job) => {
                    const startTime = new Date(job.startTime)
                    const isDragging = dragState.job?.id === job.id
                    const isResizing = isDragging && dragState.type === 'resize'
                    
                    // Use preview end time if resizing, otherwise use actual end time
                    const endTime = isResizing && previewEndTime ? previewEndTime : new Date(job.endTime)
                    
                    const startMinutes = getHours(startTime) * 60 + getMinutes(startTime)
                    const endMinutes = getHours(endTime) * 60 + getMinutes(endTime)
                    const duration = endMinutes - startMinutes
                    const topOffset = getMinutes(startTime)
                    const height = (duration / 60) * 80

                    return (
                      <div
                        key={job.id}
                        className={cn(
                          'absolute rounded-lg border-l-4 select-none group transition-all',
                          isDragging && dragState.type === 'move' && 'opacity-50',
                          job.status === 'scheduled' && 'bg-blue-500/20 border-blue-500',
                          job.status === 'in-progress' && 'bg-yellow-500/20 border-yellow-500',
                          job.status === 'completed' && 'bg-green-500/20 border-green-500',
                          job.status === 'cancelled' && 'bg-red-500/20 border-red-500',
                          job.status === 'pending-confirmation' && 'bg-orange-500/20 border-orange-500'
                        )}
                        style={{
                          top: `${topOffset * (80 / 60)}px`,
                          height: `${height}px`,
                          width: 'calc(100% - 1rem)',
                        }}
                      >
                        {/* Main content area - draggable */}
                        <div
                          className="absolute top-0 left-0 right-0 p-2 cursor-move hover:opacity-90 transition-all overflow-hidden"
                          style={{ bottom: '24px' }}
                          onMouseDown={(e) => handleDragStart(e, job, 'move')}
                          onClick={(e) => {
                            if (!dragState.job) {
                              onJobClick(job)
                            }
                          }}
                        >
                          <div className="text-sm font-medium text-primary-light">
                            {job.title}
                          </div>
                          <div className="text-xs text-primary-light/70">
                            {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                            {isResizing && ' (resizing...)'}
                          </div>
                          {job.contactName && (
                            <div className="text-xs text-primary-light/60">
                              {job.contactName}
                            </div>
                          )}
                        </div>
                        
                        {/* Resize handle - bottom 24px always accessible */}
                        <div
                          className="absolute bottom-0 left-0 right-0 cursor-ns-resize group-hover:bg-white/5 hover:!bg-white/10 transition-colors flex items-center justify-center z-10"
                          style={{ height: '24px' }}
                          onMouseDown={(e) => {
                            e.stopPropagation()
                            handleDragStart(e, job, 'resize')
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!dragState.job) {
                              onJobClick(job)
                            }
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
        `}</style>
        <div className="flex-1 overflow-auto week-slot-height min-w-0">
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
              <div className="h-10 md:h-12 border-b border-primary-blue/30"></div>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="h-12 md:h-20 border-b border-primary-blue/30 p-1 md:p-2 text-xs text-primary-light/70"
                >
                  <span className="hidden sm:inline">{format(setHours(setMinutes(new Date(), 0), hour), 'h:mm a')}</span>
                  <span className="sm:hidden">{format(setHours(setMinutes(new Date(), 0), hour), 'h a')}</span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day) => {
              const dayJobs = getJobsForDate(day)
              return (
                <div key={day.toISOString()} className="w-[100px] md:flex-1 md:min-w-0 flex-shrink-0 border-r border-primary-blue/30 last:border-r-0">
                  {/* Day header */}
                  <div
                    className={cn(
                      'h-10 md:h-12 border-b border-primary-blue/30 p-1 md:p-2 text-center cursor-pointer hover:bg-primary-blue/10',
                      isToday(day) && 'bg-primary-gold/20'
                    )}
                    onClick={() => onDateClick(day)}
                  >
                    <div className="text-xs text-primary-light/70">
                      <span className="hidden sm:inline">{format(day, 'EEE')}</span>
                      <span className="sm:hidden">{format(day, 'EEEEE')}</span>
                    </div>
                    <div
                      className={cn(
                        'text-xs md:text-sm font-medium',
                        isToday(day) ? 'text-primary-gold' : 'text-primary-light',
                        isSameDay(day, selectedDate) && 'ring-2 ring-primary-gold rounded-full w-5 h-5 md:w-6 md:h-6 mx-auto flex items-center justify-center'
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                  </div>

                  {/* Time slots */}
                  <div className="relative">
                    {hours.map((hour) => {
                      const timeSlotJobs = getJobsForTimeSlot(day, hour)
                      return (
                        <div
                          key={hour}
                          className={cn(
                            "h-12 md:h-20 border-b border-primary-blue/30 relative",
                            dragOverHour === hour && dragOverDate && isSameDay(dragOverDate, day) && "bg-primary-gold/10"
                          )}
                          onMouseEnter={() => {
                            if (dragState.type === 'move') {
                              setDragOverDate(day)
                              setDragOverHour(hour)
                            }
                          }}
                          onMouseUp={() => {
                            if (dragState.type === 'move' && dragOverHour === hour && dragOverDate && isSameDay(dragOverDate, day)) {
                              handleDrop(day, hour)
                            }
                          }}
                        >
                          {timeSlotJobs.map((job) => {
                            const startTime = new Date(job.startTime)
                            const isDragging = dragState.job?.id === job.id
                            const isResizing = isDragging && dragState.type === 'resize'
                            
                            // Use preview end time if resizing, otherwise use actual end time
                            const endTime = isResizing && previewEndTime ? previewEndTime : new Date(job.endTime)
                            
                            const startMinutes = getHours(startTime) * 60 + getMinutes(startTime)
                            const endMinutes = getHours(endTime) * 60 + getMinutes(endTime)
                            const duration = endMinutes - startMinutes
                            const topOffset = getMinutes(startTime)
                            // Use CSS custom property for responsive height
                            const height = (duration / 60) * 100
                            const topPosition = (topOffset / 60) * 100

                            return (
                              <div
                                key={job.id}
                                className={cn(
                                  'absolute left-1 right-1 rounded text-xs border-l-2 select-none group transition-all',
                                  isDragging && dragState.type === 'move' && 'opacity-50',
                                  job.status === 'scheduled' && 'bg-blue-500/20 border-blue-500',
                                  job.status === 'in-progress' && 'bg-yellow-500/20 border-yellow-500',
                                  job.status === 'completed' && 'bg-green-500/20 border-green-500',
                                  job.status === 'cancelled' && 'bg-red-500/20 border-red-500',
                                  job.status === 'pending-confirmation' && 'bg-orange-500/20 border-orange-500'
                                )}
                                style={{
                                  top: `calc(var(--slot-height) * ${topPosition} / 100)`,
                                  height: `calc(var(--slot-height) * ${height} / 100)`,
                                }}
                              >
                                {/* Main content area - draggable */}
                                <div
                                  className="absolute top-0 left-0 right-0 p-1 cursor-move hover:opacity-90 transition-all overflow-hidden"
                                  style={{ bottom: '16px' }}
                                  onMouseDown={(e) => handleDragStart(e, job, 'move')}
                                  onClick={(e) => {
                                    if (!dragState.job) {
                                      onJobClick(job)
                                    }
                                  }}
                                >
                                  <div className="font-medium text-primary-light truncate">
                                    {job.title}
                                  </div>
                                  <div className="text-primary-light/70 truncate">
                                    <span className="hidden sm:inline">{format(startTime, 'h:mm a')}</span>
                                    <span className="sm:hidden">{format(startTime, 'h:mm')}</span>
                                    {isResizing && <span className="hidden sm:inline"> - {format(endTime, 'h:mm a')}</span>}
                                  </div>
                                </div>
                                
                                {/* Resize handle - bottom 16px always accessible */}
                                <div
                                  className="absolute bottom-0 left-0 right-0 cursor-ns-resize group-hover:bg-white/5 hover:!bg-white/10 transition-colors flex items-center justify-center z-10"
                                  style={{ height: '16px' }}
                                  onMouseDown={(e) => {
                                    e.stopPropagation()
                                    handleDragStart(e, job, 'resize')
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (!dragState.job) {
                                      onJobClick(job)
                                    }
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
    
    // Calculate visible items and cell height based on scale
    const getScaleSettings = () => {
      switch(calendarScale) {
        case 75: return { maxItems: 1, minHeight: 'min-h-[75px] md:min-h-[90px]' }
        case 100: return { maxItems: 2, minHeight: 'min-h-[90px] md:min-h-[120px]' }
        case 125: return { maxItems: 3, minHeight: 'min-h-[120px] md:min-h-[160px]' }
        case 150: return { maxItems: 4, minHeight: 'min-h-[150px] md:min-h-[200px]' }
        default: return { maxItems: 2, minHeight: 'min-h-[90px] md:min-h-[120px]' }
      }
    }
    
    const scaleSettings = getScaleSettings()

    return (
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-primary-dark-secondary border-b border-primary-blue z-10">
          <div className="p-3 md:p-4 text-center">
            <h2 className="text-base md:text-xl font-semibold text-primary-light">
              {format(selectedDate, 'MMMM yyyy')}
            </h2>
          </div>
        </div>
        <div className="grid grid-cols-7">
          {/* Week day headers */}
          {weekDays.map((day) => (
            <div
              key={day}
              className="p-1 md:p-2 text-center text-xs md:text-sm font-medium text-primary-light/70 border-b border-primary-blue/30"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.substring(0, 1)}</span>
            </div>
          ))}

          {/* Calendar days */}
          {days.map((day) => {
            const dayJobs = getJobsForDate(day)
            const isCurrentMonth = isSameMonth(day, selectedDate)
            const isSelected = isSameDay(day, selectedDate)
            const isDropTarget = dragOverDate && isSameDay(dragOverDate, day) && dragState.type === 'move'

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  scaleSettings.minHeight,
                  'border-b border-r border-primary-blue/30 p-1 md:p-2 cursor-pointer hover:bg-primary-blue/10 transition-colors',
                  !isCurrentMonth && 'opacity-40',
                  isToday(day) && 'bg-primary-gold/10',
                  isSelected && 'ring-2 ring-primary-gold',
                  isDropTarget && 'bg-primary-gold/20 ring-2 ring-primary-gold'
                )}
                onClick={(e) => {
                  if (!dragState.job) {
                    setSelectedDate(day)
                    onDateClick(day)
                  }
                }}
                onMouseEnter={() => {
                  if (dragState.type === 'move') {
                    setDragOverDate(day)
                  }
                }}
                onMouseUp={() => {
                  if (dragState.type === 'move' && isDropTarget) {
                    handleDropOnDay(day)
                  }
                }}
              >
                <div
                  className={cn(
                    'text-xs md:text-sm font-medium mb-0.5 md:mb-1',
                    isToday(day) ? 'text-primary-gold' : 'text-primary-light'
                  )}
                >
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5 md:space-y-1">
                  {dayJobs.slice(0, scaleSettings.maxItems).map((job) => {
                    const isDragging = dragState.job?.id === job.id
                    return (
                      <div
                        key={job.id}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          handleDragStart(e, job, 'move')
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!dragState.job) {
                            onJobClick(job)
                          }
                        }}
                        className={cn(
                          'text-[10px] md:text-xs p-0.5 md:p-1 rounded truncate cursor-move hover:opacity-80 select-none',
                          'border-l-2',
                          isDragging && 'opacity-50',
                          job.status === 'scheduled' && 'bg-blue-500/20 border-blue-500 text-blue-300',
                          job.status === 'in-progress' && 'bg-yellow-500/20 border-yellow-500 text-yellow-300',
                          job.status === 'completed' && 'bg-green-500/20 border-green-500 text-green-300',
                          job.status === 'cancelled' && 'bg-red-500/20 border-red-500 text-red-300',
                          job.status === 'pending-confirmation' && 'bg-orange-500/20 border-orange-500 text-orange-300'
                        )}
                        title={job.title}
                      >
                        <span className="hidden sm:inline">{format(new Date(job.startTime), 'h:mm a')} {job.title}</span>
                        <span className="sm:hidden">{format(new Date(job.startTime), 'h:mm')}</span>
                      </div>
                    )
                  })}
                  {dayJobs.length > scaleSettings.maxItems && (
                    <div className="text-[10px] md:text-xs text-primary-light/50">
                      +{dayJobs.length - scaleSettings.maxItems} more
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
    <div className="flex flex-col h-full bg-primary-dark-secondary rounded-lg border border-primary-blue">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 md:p-4 border-b border-primary-blue">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2 rounded-lg hover:bg-primary-blue/20 text-primary-light transition-colors"
            aria-label="Previous"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-3 md:px-4 py-2 rounded-lg bg-primary-gold/20 hover:bg-primary-gold/30 text-primary-gold font-medium transition-colors text-sm md:text-base"
          >
            Today
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="p-2 rounded-lg hover:bg-primary-blue/20 text-primary-light transition-colors"
            aria-label="Next"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 md:gap-2">
            <button
              onClick={() => onViewModeChange('day')}
              className={cn(
                'px-2 md:px-4 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm',
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
                'px-2 md:px-4 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm',
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
                'px-2 md:px-4 py-2 rounded-lg font-medium transition-colors text-xs md:text-sm',
                viewMode === 'month'
                  ? 'bg-primary-gold text-primary-dark'
                  : 'bg-primary-blue/20 text-primary-light hover:bg-primary-blue/30'
              )}
            >
              Month
            </button>
          </div>
          
          {/* Zoom Control - Only show in month view */}
          {viewMode === 'month' && (
            <div className="flex items-center gap-1 border-l border-primary-blue/50 pl-2">
              <span className="text-xs text-primary-light/70 hidden md:inline mr-1">Zoom:</span>
              {[75, 100, 125, 150].map((scale) => (
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

