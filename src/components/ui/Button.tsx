import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant = 'primary', size = 'md', isLoading, disabled, children, ...props },
    ref
  ) => {
    const { theme } = useTheme()
    const baseStyles =
      'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap'

    const variants = {
      primary: 'bg-primary-gold text-primary-dark hover:bg-primary-gold/90',
      secondary: theme === 'dark' 
        ? 'bg-primary-blue text-primary-light hover:bg-primary-blue/90'
        : 'bg-primary-blue text-white hover:bg-primary-blue/90',
      outline: theme === 'dark'
        ? 'border-2 border-primary-gold/50 text-primary-light hover:bg-primary-gold/20'
        : 'border-2 border-primary-gold/50 text-primary-lightText hover:bg-primary-gold/20',
      ghost: theme === 'dark'
        ? 'text-primary-light hover:bg-primary-dark-secondary'
        : 'text-primary-lightText hover:bg-gray-100',
      danger: 'bg-red-500 text-white hover:bg-red-600',
    }

    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-base',
      lg: 'h-12 px-6 text-lg',
    }

    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled ?? isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden
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
            {children}
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
