import { useState, useEffect, useMemo } from 'react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addWeeks, subWeeks, addMonths, subMonths, addDays, subDays, startOfDay, getHours, getMinutes, setHours, setMinutes } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Job } from '../types/job'

interface CalendarProps {
  jobs: Job[]
  viewMode: 'day' | 'week' | 'month'
  currentDate: Date
  onDateChange: (date: Date) => void
  onViewModeChange: (mode: 'day' | 'week' | 'month') => void
  onJobClick: (job: Job) => void
  onDateClick: (date: Date) => void
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

  // Get jobs for a specific date
  const getJobsForDate = (date: Date) => {
    return jobs.filter((job) => {
      const jobDate = startOfDay(new Date(job.startTime))
      return isSameDay(jobDate, date)
    })
  }

  // Get jobs for a time slot (for day/week view)
  const getJobsForTimeSlot = (date: Date, hour: number) => {
    return jobs.filter((job) => {
      const jobDate = new Date(job.startTime)
      return isSameDay(jobDate, date) && getHours(jobDate) === hour
    })
  }

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
                className="border-b border-primary-blue/30 min-h-[60px] md:min-h-[80px] relative"
              >
                <div className="absolute left-0 top-0 w-12 md:w-20 p-1 md:p-2 text-xs md:text-sm text-primary-light/70">
                  {format(setHours(setMinutes(new Date(), 0), hour), 'h:mm a')}
                </div>
                <div className="ml-12 md:ml-20 p-1 md:p-2">
                  {timeSlotJobs.map((job) => {
                    const startTime = new Date(job.startTime)
                    const endTime = new Date(job.endTime)
                    const startMinutes = getHours(startTime) * 60 + getMinutes(startTime)
                    const endMinutes = getHours(endTime) * 60 + getMinutes(endTime)
                    const duration = endMinutes - startMinutes
                    const topOffset = getMinutes(startTime)
                    const height = (duration / 60) * 80

                    return (
                      <div
                        key={job.id}
                        onClick={() => onJobClick(job)}
                        className={cn(
                          'absolute rounded-lg p-2 cursor-pointer transition-all hover:opacity-90',
                          'border-l-4',
                          job.status === 'scheduled' && 'bg-blue-500/20 border-blue-500',
                          job.status === 'in-progress' && 'bg-yellow-500/20 border-yellow-500',
                          job.status === 'completed' && 'bg-green-500/20 border-green-500',
                          job.status === 'cancelled' && 'bg-red-500/20 border-red-500'
                        )}
                        style={{
                          top: `${topOffset * (80 / 60)}px`,
                          height: `${height}px`,
                          width: 'calc(100% - 1rem)',
                        }}
                      >
                        <div className="text-sm font-medium text-primary-light">
                          {job.title}
                        </div>
                        <div className="text-xs text-primary-light/70">
                          {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                        </div>
                        {job.contactName && (
                          <div className="text-xs text-primary-light/60">
                            {job.contactName}
                          </div>
                        )}
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
      <div className="flex-1 overflow-auto">
        <div className="sticky top-0 bg-primary-dark-secondary border-b border-primary-blue z-10">
          <div className="p-3 md:p-4 text-center">
            <h2 className="text-base md:text-xl font-semibold text-primary-light">
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </h2>
          </div>
        </div>
        <div className="flex overflow-x-auto">
          {/* Time column */}
          <div className="w-12 md:w-20 flex-shrink-0 border-r border-primary-blue/30">
            <div className="h-10 md:h-12 border-b border-primary-blue/30"></div>
            {hours.map((hour) => (
              <div
                key={hour}
                className="h-12 md:h-20 border-b border-primary-blue/30 p-1 md:p-2 text-xs text-primary-light/70"
              >
                {format(setHours(setMinutes(new Date(), 0), hour), 'h:mm a')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day) => {
            const dayJobs = getJobsForDate(day)
            return (
              <div key={day.toISOString()} className="flex-1 border-r border-primary-blue/30 last:border-r-0">
                {/* Day header */}
                <div
                  className={cn(
                    'h-10 md:h-12 border-b border-primary-blue/30 p-1 md:p-2 text-center cursor-pointer hover:bg-primary-blue/10 min-w-[60px] md:min-w-0',
                    isToday(day) && 'bg-primary-gold/20'
                  )}
                  onClick={() => onDateClick(day)}
                >
                  <div className="text-xs text-primary-light/70">
                    {format(day, 'EEE')}
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
                        className="h-12 md:h-20 border-b border-primary-blue/30 relative"
                      >
                        {timeSlotJobs.map((job) => {
                          const startTime = new Date(job.startTime)
                          const endTime = new Date(job.endTime)
                          const startMinutes = getHours(startTime) * 60 + getMinutes(startTime)
                          const endMinutes = getHours(endTime) * 60 + getMinutes(endTime)
                          const duration = endMinutes - startMinutes
                          const topOffset = getMinutes(startTime)
                          const height = (duration / 60) * 80

                          return (
                            <div
                              key={job.id}
                              onClick={() => onJobClick(job)}
                              className={cn(
                                'absolute left-1 right-1 rounded p-1 cursor-pointer transition-all hover:opacity-90 text-xs',
                                'border-l-2',
                                job.status === 'scheduled' && 'bg-blue-500/20 border-blue-500',
                                job.status === 'in-progress' && 'bg-yellow-500/20 border-yellow-500',
                                job.status === 'completed' && 'bg-green-500/20 border-green-500',
                                job.status === 'cancelled' && 'bg-red-500/20 border-red-500'
                              )}
                              style={{
                                top: `${topOffset * (80 / 60)}px`,
                                height: `${height}px`,
                              }}
                            >
                              <div className="font-medium text-primary-light truncate">
                                {job.title}
                              </div>
                              <div className="text-primary-light/70 truncate">
                                {format(startTime, 'h:mm a')}
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
    )
  }

  const renderMonthView = () => {
    const monthStart = startOfMonth(selectedDate)
    const monthEnd = endOfMonth(selectedDate)
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  'min-h-[60px] md:min-h-[100px] border-b border-r border-primary-blue/30 p-1 md:p-2 cursor-pointer hover:bg-primary-blue/10 transition-colors',
                  !isCurrentMonth && 'opacity-40',
                  isToday(day) && 'bg-primary-gold/10',
                  isSelected && 'ring-2 ring-primary-gold'
                )}
                onClick={() => {
                  setSelectedDate(day)
                  onDateClick(day)
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
                  {dayJobs.slice(0, 1).map((job) => (
                    <div
                      key={job.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onJobClick(job)
                      }}
                      className={cn(
                        'text-[10px] md:text-xs p-0.5 md:p-1 rounded truncate cursor-pointer hover:opacity-80',
                        'border-l-2',
                        job.status === 'scheduled' && 'bg-blue-500/20 border-blue-500 text-blue-300',
                        job.status === 'in-progress' && 'bg-yellow-500/20 border-yellow-500 text-yellow-300',
                        job.status === 'completed' && 'bg-green-500/20 border-green-500 text-green-300',
                        job.status === 'cancelled' && 'bg-red-500/20 border-red-500 text-red-300'
                      )}
                      title={job.title}
                    >
                      <span className="hidden sm:inline">{format(new Date(job.startTime), 'h:mm a')} {job.title}</span>
                      <span className="sm:hidden">{format(new Date(job.startTime), 'h:mm')}</span>
                    </div>
                  ))}
                  {dayJobs.length > 1 && (
                    <div className="text-[10px] md:text-xs text-primary-light/50">
                      +{dayJobs.length - 1} more
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

