import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { cn } from '@/lib/utils'

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'options'> {
  label?: string
  error?: string
  helperText?: string
  options: Array<{ value: string; label: string }>
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      options,
      value,
      onChange,
      onBlur,
      name,
      disabled,
      placeholder = 'Select an option',
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const selectRef = useRef<HTMLSelectElement>(null)

    // Expose the select ref for react-hook-form
    useImperativeHandle(ref, () => selectRef.current as HTMLSelectElement)

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
          if (onBlur && selectRef.current) {
            onBlur({ target: selectRef.current } as React.FocusEvent<HTMLSelectElement>)
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
        // Small delay to ensure the dropdown is rendered
        setTimeout(() => {
          dropdownRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest',
          })
        }, 10)
      }
    }, [isOpen])

    const selectedOption = options.find(opt => opt.value === value)
    const displayValue = selectedOption ? selectedOption.label : placeholder

    const handleSelect = (optionValue: string) => {
      if (selectRef.current) {
        // Update the hidden select element's value first
        selectRef.current.value = optionValue

        if (onChange) {
          // Create a synthetic event for react-hook-form with the actual select element
          const syntheticEvent = {
            target: selectRef.current,
            currentTarget: selectRef.current,
            type: 'change',
          } as React.ChangeEvent<HTMLSelectElement>

          onChange(syntheticEvent)
        }
      }
      setIsOpen(false)
    }

    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label className="block text-sm font-medium text-primary-light mb-2">{label}</label>
        )}

        {/* Hidden select for react-hook-form */}
        <select
          ref={selectRef}
          name={name}
          value={value || ''}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          className="hidden"
          {...props}
        >
          {options.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Custom dropdown */}
        <div className="relative w-full" ref={containerRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className={cn(
              'flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-sm text-primary-light',
              'bg-primary-dark-secondary border-primary-blue',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-500 focus-visible:ring-red-500',
              isOpen && 'border-primary-gold ring-2 ring-primary-gold',
              !selectedOption && 'text-primary-light/50'
            )}
          >
            <span className="truncate">{displayValue}</span>
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
                {options.map(option => {
                  const isSelected = value === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        'w-full px-3 py-2 text-sm rounded-lg text-left transition-colors',
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

        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-primary-light/70">{helperText}</p>}
      </div>
    )
  }
)

Select.displayName = 'Select'

export default Select
