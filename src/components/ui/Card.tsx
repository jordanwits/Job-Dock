import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-lg border border-primary-dark-secondary bg-primary-dark-secondary p-6 shadow-lg',
          className
        )}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

export default Card

