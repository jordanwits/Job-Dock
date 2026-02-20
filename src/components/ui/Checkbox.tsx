import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string
  error?: string
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, ...props }, ref) => {
    // SVG checkmark as data URL - black checkmark (thicker stroke-based)
    const checkmarkSvg =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M3 8 L6 11 L13 4' stroke='%23000000' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E"

    return (
      <div className="w-full">
        <style>{`
          input[type="checkbox"].custom-checkbox:checked {
            background-color: #D4AF37 !important;
            background-image: url("${checkmarkSvg}") !important;
            background-size: 12px 12px !important;
            background-position: center !important;
            background-repeat: no-repeat !important;
          }
        `}</style>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            className={cn(
              'custom-checkbox w-4 h-4 rounded border-2 border-primary-blue bg-primary-dark-secondary',
              'cursor-pointer appearance-none transition-all duration-200',
              'checked:border-primary-blue',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:ring-offset-2 focus-visible:ring-offset-primary-dark',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-500 focus-visible:ring-red-500',
              className
            )}
            ref={ref}
            {...props}
          />
          {label && (
            <label
              htmlFor={props.id}
              className={cn(
                'text-sm text-primary-light cursor-pointer select-none',
                props.disabled && 'cursor-not-allowed opacity-50',
                error && 'text-red-500'
              )}
            >
              {label}
            </label>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
      </div>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox
