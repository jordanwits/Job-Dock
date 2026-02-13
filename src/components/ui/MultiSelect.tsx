import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { cn } from '@/lib/utils'

export interface MultiSelectProps {
  label?: string
  error?: string
  helperText?: string
  options: Array<{ value: string; label: string }>
  value?: string[]
  onChange?: (value: string[]) => void
  onBlur?: () => void
  name?: string
  disabled?: boolean
  placeholder?: string
  className?: string
}

const MultiSelect = forwardRef<HTMLInputElement, MultiSelectProps>(
  ({ className, label, error, helperText, options, value = [], onChange, onBlur, name, disabled, placeholder = 'Select team members', ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    // Expose the input ref for react-hook-form
    useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
          if (onBlur) {
            onBlur()
          }
        }
      }

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside)
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }, [isOpen, onBlur])

    // Scroll dropdown into view when it opens
    useEffect(() => {
      if (isOpen && dropdownRef.current) {
        setTimeout(() => {
          dropdownRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
          })
        }, 10)
      }
    }, [isOpen])

    const selectedOptions = options.filter((opt) => value.includes(opt.value))
    const displayValue = selectedOptions.length > 0 
      ? `${selectedOptions.length} selected`
      : placeholder

    const handleToggle = (optionValue: string) => {
      if (disabled) return
      
      const newValue = value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue]
      
      if (onChange) {
        onChange(newValue)
      }
    }

    const handleRemove = (optionValue: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (disabled) return
      
      const newValue = value.filter((v) => v !== optionValue)
      if (onChange) {
        onChange(newValue)
      }
    }

    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label className="block text-sm font-medium text-primary-light mb-2">
            {label}
          </label>
        )}
        
        {/* Hidden input for react-hook-form */}
        <input
          ref={inputRef}
          type="hidden"
          name={name}
          value={JSON.stringify(value)}
          {...props}
        />

        {/* Custom dropdown */}
        <div className="relative w-full" ref={containerRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={cn(
              'flex min-h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-primary-light',
              'bg-primary-dark-secondary border-primary-blue',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-500 focus-visible:ring-red-500',
              isOpen && 'border-primary-gold ring-2 ring-primary-gold',
              !selectedOptions.length && 'text-primary-light/50'
            )}
          >
            <div className="flex flex-wrap gap-1 flex-1 min-w-0">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <span
                    key={option.value}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary-blue/30 text-primary-light text-xs"
                  >
                    <span className="truncate max-w-[120px]">{option.label}</span>
                    {!disabled && (
                      <button
                        type="button"
                        onClick={(e) => handleRemove(option.value, e)}
                        className="hover:text-red-400 transition-colors"
                        aria-label={`Remove ${option.label}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              ) : (
                <span className="truncate">{displayValue}</span>
              )}
            </div>
            <svg
              className={cn(
                'ml-2 h-4 w-4 flex-shrink-0 transition-transform',
                isOpen && 'rotate-180'
              )}
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
          </button>

          {isOpen && (
            <div
              ref={dropdownRef}
              className="absolute z-50 mt-2 w-full rounded-lg border border-primary-blue bg-primary-dark-secondary shadow-xl max-h-64 overflow-y-auto"
            >
              <div className="p-2">
                {options.map((option) => {
                  const isSelected = value.includes(option.value)

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggle(option.value)}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-lg text-left transition-colors flex items-center gap-2',
                        isSelected
                          ? 'bg-primary-blue text-primary-light font-medium'
                          : 'text-primary-light hover:bg-primary-dark'
                      )}
                    >
                      <span className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center',
                        isSelected 
                          ? 'bg-primary-gold border-primary-gold' 
                          : 'border-primary-blue'
                      )}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-primary-dark" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1 text-sm text-primary-light/70">{helperText}</p>
        )}
      </div>
    )
  }
)

MultiSelect.displayName = 'MultiSelect'

export default MultiSelect
