import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

const Card = forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'rounded-xl border border-white/10 bg-primary-dark-secondary p-6 shadow-sm shadow-black/20',
        className
      )}
      {...props}
    />
  )
})

Card.displayName = 'Card'

export default Card
