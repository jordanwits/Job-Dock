import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  const { theme } = useTheme()
  
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl p-6 shadow-sm',
        theme === 'dark'
          ? 'border border-white/10 bg-primary-dark-secondary shadow-black/20'
          : 'border border-gray-200 bg-primary-lightSecondary shadow-gray-200/50',
        className
      )}
      {...props}
    />
  )
})

Card.displayName = 'Card'

export default Card
