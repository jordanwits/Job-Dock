import { TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-primary-light mb-2">{label}</label>
        )}
        <textarea
          className={cn(
            'flex min-h-[80px] w-full rounded-lg border border-primary-blue bg-primary-dark-secondary px-3 py-2 text-sm text-primary-light',
            'placeholder:text-primary-light/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold focus-visible:border-primary-gold',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'resize-y',
            error && 'border-red-500 focus-visible:ring-red-500',
            className
          )}
          ref={ref}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-500">{error}</p>}
        {helperText && !error && <p className="mt-1 text-sm text-primary-light/70">{helperText}</p>}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'

export default Textarea
