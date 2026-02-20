import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

export interface StatusOption {
  value: string
  label: string
}

export interface StatusBadgeSelectProps {
  value: string
  options: StatusOption[]
  colorClassesByValue: Record<string, string>
  onChange: (newValue: string) => void
  disabled?: boolean
  isLoading?: boolean
  size?: 'sm' | 'md'
}

const StatusBadgeSelect = ({
  value,
  options,
  colorClassesByValue,
  onChange,
  disabled = false,
  isLoading = false,
  size = 'md',
}: StatusBadgeSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const handleSelect = (optionValue: string) => {
    if (optionValue !== value) {
      onChange(optionValue)
    }
    setIsOpen(false)
  }

  const selectedOption = options.find(opt => opt.value === value)
  const displayValue = selectedOption ? selectedOption.label : value

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
  }

  const isDisabled = disabled || isLoading

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => !isDisabled && setIsOpen(!isOpen)}
        disabled={isDisabled}
        className={cn(
          'font-medium rounded border transition-all cursor-pointer',
          sizeClasses[size],
          colorClassesByValue[value],
          'hover:opacity-80',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold',
          isDisabled && 'opacity-50 cursor-not-allowed',
          isOpen && 'ring-2 ring-primary-gold'
        )}
      >
        <span className="flex items-center gap-2">
          {isLoading && (
            <svg
              className="animate-spin h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          <span className="capitalize">{displayValue}</span>
          {!isDisabled && (
            <svg
              className={cn('h-3 w-3 flex-shrink-0 transition-transform', isOpen && 'rotate-180')}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          )}
        </span>
      </button>

      {isOpen && !isDisabled && (
        <div className="absolute z-50 mt-2 min-w-[140px] rounded-lg border border-primary-blue bg-primary-dark-secondary shadow-xl">
          <div className="p-2">
            {options.map(option => {
              const isSelected = value === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'w-full px-3 py-2 text-sm rounded-lg text-left transition-colors capitalize',
                    isSelected
                      ? 'bg-primary-blue text-primary-light font-medium'
                      : 'text-primary-light hover:bg-primary-dark'
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default StatusBadgeSelect
