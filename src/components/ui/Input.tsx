import { InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    // Prevent scroll from changing number input values
    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
      if (props.type === 'number') {
        e.currentTarget.blur()
      }
    }

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-primary-light mb-2">{label}</label>
        )}
        <input
          className={cn(
            'flex h-10 w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light',
            'placeholder:text-primary-light/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold',
            'disabled:cursor-not-allowed disabled:opacity-50',
            '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
            '[&[type=number]]:appearance-none',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          ref={ref}
          onWheel={handleWheel}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-primary-light/70">{helperText}</p>}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
