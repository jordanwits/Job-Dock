import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

export interface SearchableSelectProps {
  label?: string
  error?: string
  helperText?: string
  options: Array<{ value: string; label: string }>
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  disabled?: boolean
  className?: string
}

const SearchableSelect = ({
  label,
  error,
  helperText,
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  disabled,
  className,
}: SearchableSelectProps) => {
  const { theme } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const selectedOption = options.find(opt => opt.value === value)
  const displayValue = selectedOption ? selectedOption.label : placeholder

  // Filter options based on search query
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase())
  )

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchQuery('')
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Focus search input when dropdown opens
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 10)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (optionValue: string) => {
    onChange?.(optionValue)
    setIsOpen(false)
    setSearchQuery('')
  }

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen)
      if (!isOpen) {
        setSearchQuery('')
      }
    }
  }

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className={cn(
          "block text-sm font-medium mb-2",
          theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
        )}>{label}</label>
      )}

      <div className="relative w-full" ref={containerRef}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-500 focus-visible:ring-red-500',
            isOpen && 'border-primary-gold ring-2 ring-primary-gold',
            theme === 'dark'
              ? 'bg-primary-dark-secondary border-primary-blue text-primary-light'
              : 'bg-white border-gray-200/20 text-primary-lightText',
            !selectedOption && (theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary')
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
            className={cn(
              "absolute z-50 mt-2 w-full rounded-lg border shadow-xl max-h-80 overflow-hidden flex flex-col",
              theme === 'dark'
                ? 'border-primary-blue bg-primary-dark-secondary'
                : 'border-gray-200/20 bg-white'
            )}
          >
            {/* Search input */}
            <div className={cn(
              "p-2 border-b",
              theme === 'dark' ? 'border-primary-blue/30' : 'border-gray-200/20'
            )}>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold",
                  theme === 'dark'
                    ? 'border-primary-blue bg-primary-dark text-primary-light placeholder:text-primary-light/50'
                    : 'border-gray-200/20 bg-white text-primary-lightText placeholder:text-primary-lightTextSecondary'
                )}
                onClick={e => e.stopPropagation()}
              />
            </div>

            {/* Options list */}
            <div className="overflow-y-auto max-h-64">
              {filteredOptions.length === 0 ? (
                <div className={cn(
                  "p-4 text-center text-sm",
                  theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                )}>
                  {searchQuery ? 'No results found' : 'No options available'}
                </div>
              ) : (
                <div className="p-2">
                  {filteredOptions.map(option => {
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
                            : theme === 'dark'
                              ? 'text-primary-light hover:bg-primary-dark'
                              : 'text-primary-lightText hover:bg-gray-100'
                        )}
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      {helperText && !error && (
        <p className={cn(
          "mt-1 text-sm",
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>{helperText}</p>
      )}
    </div>
  )
}

export default SearchableSelect
