import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    const { theme } = useTheme()
    // Prevent scroll from changing number input values
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (props.type === 'number') {
        e.currentTarget.blur()
      }
    }

    return (
      <div className="w-full">
        {label && (
          <label className={cn(
            "block text-sm font-medium mb-2",
            theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
          )}>{label}</label>
        )}
        <input
          className={cn(
            'flex h-10 w-full rounded-lg border px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            '[&[type=number]]:appearance-none',
            theme === 'dark'
              ? 'border-primary-blue bg-primary-dark-secondary text-primary-light placeholder:text-primary-light/50'
              : 'border-gray-200 bg-white text-primary-lightText placeholder:text-primary-lightTextSecondary',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          ref={ref}
          onWheel={handleWheel}
          {...props}
        />
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
)

Input.displayName = 'Input'

export default Input
