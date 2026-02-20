import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from 'date-fns'

export interface DatePickerProps {
  value?: string
  onChange?: (date: string) => void
  label?: string
  error?: string
  helperText?: string
  placeholder?: string
  disabled?: boolean
  minDate?: string
  maxDate?: string
  className?: string
}

// Helper to parse date string as local date (not UTC)
const parseDateStringAsLocal = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const DatePicker = ({
  value,
  onChange,
  label,
  error,
  helperText,
  placeholder = 'Select a date',
  disabled = false,
  minDate,
  maxDate,
  className,
}: DatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentMonth, setCurrentMonth] = useState(
    value ? parseDateStringAsLocal(value) : new Date()
  )
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)

      // Scroll the date picker calendar into view when it opens
      setTimeout(() => {
        if (calendarRef.current) {
          calendarRef.current.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          })
        }
      }, 100)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const selectedDate = value ? parseDateStringAsLocal(value) : null
  const min = minDate ? parseDateStringAsLocal(minDate) : null
  const max = maxDate ? parseDateStringAsLocal(maxDate) : null

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const handleDateSelect = (date: Date) => {
    if (min && date < min) return
    if (max && date > max) return

    const dateString = format(date, 'yyyy-MM-dd')
    onChange?.(dateString)
    setIsOpen(false)
  }

  const handlePrevMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1))
  }

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const formatDisplayDate = (dateString?: string) => {
    if (!dateString) return ''
    try {
      return format(parseDateStringAsLocal(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  const isDateDisabled = (date: Date) => {
    if (min && date < min) return true
    if (max && date > max) return true
    return false
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className={cn('w-full', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-primary-light mb-2">{label}</label>
      )}
      <div className="relative">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full rounded-lg border px-3 py-2 text-sm text-left',
            'bg-primary-dark-secondary text-primary-light',
            'placeholder:text-primary-light/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error ? 'border-red-500 focus-visible:ring-red-500' : 'border-primary-blue',
            className
          )}
        >
          <span className={cn('flex-1', !value && 'text-primary-light/50')}>
            {value ? formatDisplayDate(value) : placeholder}
          </span>
          <svg
            className="w-5 h-5 text-primary-light/70"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            ref={calendarRef}
            className="absolute z-50 mt-2 w-full rounded-lg border border-primary-blue bg-primary-dark-secondary shadow-xl p-4"
          >
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-primary-dark text-primary-light hover:text-primary-gold transition-colors"
                aria-label="Previous month"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h3 className="text-base font-semibold text-primary-light">
                {format(currentMonth, 'MMMM yyyy')}
              </h3>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-primary-dark text-primary-light hover:text-primary-gold transition-colors"
                aria-label="Next month"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map(day => (
                <div
                  key={day}
                  className="text-center text-xs font-medium text-primary-light/70 py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, index) => {
                const isCurrentMonth = isSameMonth(day, currentMonth)
                const isSelected = selectedDate && isSameDay(day, selectedDate)
                const isTodayDate = isToday(day)
                const isDisabled = isDateDisabled(day)

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleDateSelect(day)}
                    disabled={isDisabled || !isCurrentMonth}
                    className={cn(
                      'h-9 w-9 rounded text-sm transition-colors',
                      !isCurrentMonth && 'text-primary-light/20',
                      isCurrentMonth &&
                        !isSelected &&
                        !isTodayDate &&
                        'text-primary-light hover:bg-primary-dark',
                      isTodayDate &&
                        !isSelected &&
                        'bg-primary-blue/20 text-primary-light font-semibold',
                      isSelected && 'bg-primary-gold text-primary-dark font-semibold',
                      isDisabled && 'opacity-30 cursor-not-allowed',
                      !isDisabled && isCurrentMonth && 'hover:bg-primary-dark'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            {/* Today Button */}
            <div className="mt-4 pt-4 border-t border-primary-blue">
              <button
                type="button"
                onClick={() => handleDateSelect(new Date())}
                className="w-full px-4 py-2 text-sm font-medium text-primary-gold hover:bg-primary-dark rounded-lg transition-colors"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {helperText && !error && <p className="mt-1 text-sm text-primary-light/70">{helperText}</p>}
    </div>
  )
}

export default DatePicker
