import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-gold disabled:pointer-events-none disabled:opacity-50 whitespace-nowrap'
    
    const variants = {
      primary: 'bg-primary-gold text-primary-dark hover:bg-primary-gold/90',
      secondary: 'bg-primary-blue text-primary-light hover:bg-primary-blue/90',
      outline: 'border-2 border-primary-gold/50 text-primary-light hover:bg-primary-gold/20',
      ghost: 'text-primary-light hover:bg-primary-dark-secondary',
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
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'

export default Button

