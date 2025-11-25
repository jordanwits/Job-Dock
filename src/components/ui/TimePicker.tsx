import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { format, setHours, setMinutes } from 'date-fns'

export interface TimePickerProps {
  value?: string // HH:mm format
  onChange?: (time: string) => void
  label?: string
  error?: string
  helperText?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  step?: number // minutes step (default 15)
}

const TimePicker = ({
  value,
  onChange,
  label,
  error,
  helperText,
  placeholder = 'Select time',
  disabled = false,
  className,
  step = 15,
}: TimePickerProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const parseTime = (timeString?: string): { hour: number; minute: number } | null => {
    if (!timeString) return null
    const [hour, minute] = timeString.split(':').map(Number)
    return { hour, minute }
  }

  const formatDisplayTime = (timeString?: string) => {
    if (!timeString) return ''
    try {
      const parsed = parseTime(timeString)
      if (!parsed) return ''
      const date = setHours(setMinutes(new Date(), parsed.minute), parsed.hour)
      return format(date, 'h:mm a')
    } catch {
      return timeString
    }
  }

  const generateTimeSlots = () => {
    const slots: string[] = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += step) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(timeString)
      }
    }
    return slots
  }

  const timeSlots = generateTimeSlots()

  const handleTimeSelect = (time: string) => {
    onChange?.(time)
    setIsOpen(false)
  }

  return (
    <div className={cn('w-full', className)} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-primary-light mb-2">
          {label}
        </label>
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
            error
              ? 'border-red-500 focus-visible:ring-red-500'
              : 'border-primary-blue',
            className
          )}
        >
          <span className={cn('flex-1', !value && 'text-primary-light/50')}>
            {value ? formatDisplayTime(value) : placeholder}
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            className="absolute z-50 mt-2 w-full rounded-lg border border-primary-blue bg-primary-dark-secondary shadow-xl max-h-64 overflow-y-auto"
          >
            <div className="p-2">
              {timeSlots.map((time) => {
                const parsed = parseTime(time)
                if (!parsed) return null
                const date = setHours(setMinutes(new Date(), parsed.minute), parsed.hour)
                const isSelected = value === time

                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => handleTimeSelect(time)}
                    className={cn(
                      'w-full px-3 py-2 text-sm rounded-lg text-left transition-colors',
                      isSelected
                        ? 'bg-primary-gold text-primary-dark font-medium'
                        : 'text-primary-light hover:bg-primary-dark'
                    )}
                  >
                    {format(date, 'h:mm a')}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {helperText && !error && (
        <p className="mt-1 text-sm text-primary-light/70">{helperText}</p>
      )}
    </div>
  )
}

export default TimePicker

