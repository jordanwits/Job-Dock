import { useState } from 'react'
import { format, parse, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { cn } from '@/lib/utils'
import { PublicPanel } from '@/components/public/publicUi'
import type { DaySlots, AvailableSlot } from '../types/booking'

interface AvailabilityCalendarProps {
  slots: DaySlots[]
  selectedSlot: AvailableSlot | null
  onSlotSelect: (slot: AvailableSlot) => void
  onMonthChange?: (date: Date) => void
  isLoading?: boolean
}

const ChevronIcon = ({ direction, className }: { direction: 'left' | 'right'; className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
    <path d={direction === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'} />
  </svg>
)

const AvailabilityCalendar = ({
  slots,
  selectedSlot,
  onSlotSelect,
  onMonthChange,
  isLoading,
}: AvailabilityCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const handlePrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    onMonthChange?.(newMonth)
  }

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    onMonthChange?.(newMonth)
  }

  const getSlotsForDate = (date: Date): AvailableSlot[] => {
    if (!slots || slots.length === 0) return []
    const dateStr = format(date, 'yyyy-MM-dd')
    const daySlots = slots.find((s) => s.date === dateStr)
    return daySlots?.slots || []
  }

  const handleDateClick = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    setSelectedDate(dateStr)
  }

  const selectedDateSlots = selectedDate && slots
    ? slots.find((s) => s.date === selectedDate)?.slots || []
    : []

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <h2 className="whitespace-nowrap text-lg font-semibold tracking-tight text-ink">
          Select date &amp; time
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={isLoading}
            aria-label="Previous month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronIcon direction="left" className="h-5 w-5" />
          </button>
          <span className="min-w-[120px] text-center font-mono text-sm font-medium tabular-nums text-ink">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            disabled={isLoading}
            aria-label="Next month"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronIcon direction="right" className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isLoading ? (
        <PublicPanel className="p-4">
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }, (_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        </PublicPanel>
      ) : (
        <>
          {/* Calendar grid */}
          <PublicPanel className="p-3 sm:p-4">
            <div className="grid grid-cols-7 gap-1">
              {/* Weekday headers */}
              {weekDays.map((day) => (
                <div key={day} className="p-2 text-center text-xs font-medium text-ink-subtle">
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {days.map((day) => {
                const dateStr = format(day, 'yyyy-MM-dd')
                const daySlots = getSlotsForDate(day)
                const hasSlots = daySlots.length > 0
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = selectedDate === dateStr
                const isPast = day < new Date() && !isSameDay(day, new Date())

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => hasSlots && handleDateClick(day)}
                    disabled={!hasSlots || isPast}
                    className={cn(
                      'relative aspect-square rounded-lg p-2 font-mono text-sm tabular-nums transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                      'disabled:cursor-not-allowed',
                      !isCurrentMonth && 'text-ink-subtle/50',
                      isCurrentMonth && !hasSlots && 'text-ink-subtle',
                      hasSlots && !isPast && 'cursor-pointer text-ink hover:bg-accent-soft/60',
                      isSelected && 'bg-accent-strong text-accent-contrast hover:bg-accent-strong',
                      isToday(day) && !isSelected && 'ring-1 ring-inset ring-accent'
                    )}
                  >
                    <span className={cn('block', isToday(day) && !isSelected && 'font-semibold text-accent-strong')}>
                      {format(day, 'd')}
                    </span>
                    {hasSlots && (
                      <span
                        className={cn(
                          'absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                          isSelected ? 'bg-accent-contrast' : 'bg-accent-strong'
                        )}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </PublicPanel>

          {/* Time slots for selected date */}
          {selectedDate && selectedDateSlots.length > 0 && (
            <PublicPanel className="p-4">
              <h3 className="mb-3 text-sm font-semibold text-ink">
                Available times for {format(parse(selectedDate, 'yyyy-MM-dd', new Date()), 'EEEE, MMMM d')}
              </h3>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" role="radiogroup" aria-label="Available times">
                {selectedDateSlots.map((slot) => {
                  const isSelected = selectedSlot?.start === slot.start
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => onSlotSelect(slot)}
                      className={cn(
                        'h-10 rounded-lg px-3 font-mono text-sm font-medium tabular-nums transition-colors duration-150',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                        isSelected
                          ? 'bg-accent-strong text-accent-contrast'
                          : 'bg-surface text-ink ring-1 ring-inset ring-line hover:bg-accent-soft/60 hover:ring-accent'
                      )}
                    >
                      {format(new Date(slot.start), 'h:mm a')}
                    </button>
                  )
                })}
              </div>
            </PublicPanel>
          )}

          {selectedDate && selectedDateSlots.length === 0 && (
            <PublicPanel className="p-4">
              <p className="py-4 text-center text-sm text-ink-muted">No available times for this date</p>
            </PublicPanel>
          )}
        </>
      )}
    </div>
  )
}

export default AvailabilityCalendar
