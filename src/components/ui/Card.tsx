import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-primary-blue bg-primary-dark-secondary p-4',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

export default Card

