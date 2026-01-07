import { useState } from 'react'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, startOfWeek, endOfWeek } from 'date-fns'
import { Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { DaySlots, AvailableSlot } from '../types/booking'

interface AvailabilityCalendarProps {
  slots: DaySlots[]
  selectedSlot: AvailableSlot | null
  onSlotSelect: (slot: AvailableSlot) => void
  onMonthChange?: (date: Date) => void
  isLoading?: boolean
}

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-primary-light">
          Select Date & Time
        </h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrevMonth}
            disabled={isLoading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <span className="text-primary-light font-medium min-w-[140px] text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextMonth}
            disabled={isLoading}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-primary-light/70">Loading availability...</p>
        </div>
      ) : (
        <>
          {/* Calendar grid */}
          <Card>
            <div className="grid grid-cols-7 gap-1">
              {/* Weekday headers */}
              {weekDays.map((day) => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-primary-light/70 p-2"
                >
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
                    onClick={() => hasSlots && handleDateClick(day)}
                    disabled={!hasSlots || isPast}
                    className={cn(
                      'aspect-square p-2 rounded-lg text-sm transition-colors relative',
                      'disabled:cursor-not-allowed disabled:opacity-40',
                      !isCurrentMonth && 'text-primary-light/30',
                      isCurrentMonth && !hasSlots && 'text-primary-light/50',
                      hasSlots && !isPast && 'cursor-pointer hover:bg-primary-blue/20',
                      isSelected && 'bg-primary-gold/20 border-2 border-primary-gold',
                      isToday(day) && !isSelected && 'border border-primary-gold',
                    )}
                  >
                    <span className={cn(
                      'block',
                      isToday(day) && 'font-bold text-primary-gold'
                    )}>
                      {format(day, 'd')}
                    </span>
                    {hasSlots && (
                      <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-primary-gold" />
                    )}
                  </button>
                )
              })}
            </div>
          </Card>

          {/* Time slots for selected date */}
          {selectedDate && selectedDateSlots.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold text-primary-light mb-3">
                Available times for {format(new Date(selectedDate), 'EEEE, MMMM d')}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {selectedDateSlots.map((slot) => {
                  const isSelected = selectedSlot?.start === slot.start
                  return (
                    <button
                      key={slot.start}
                      onClick={() => onSlotSelect(slot)}
                      className={cn(
                        'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                        'border-2',
                        isSelected
                          ? 'bg-primary-gold text-primary-dark border-primary-gold'
                          : 'bg-primary-dark-secondary text-primary-light border-primary-blue hover:border-primary-gold hover:bg-primary-gold/10'
                      )}
                    >
                      {format(new Date(slot.start), 'h:mm a')}
                    </button>
                  )
                })}
              </div>
            </Card>
          )}

          {selectedDate && selectedDateSlots.length === 0 && (
            <Card>
              <p className="text-sm text-primary-light/70 text-center py-4">
                No available times for this date
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

export default AvailabilityCalendar

