import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  className?: string
  variant?: 'default' | 'bordered' | 'elevated' | 'glass'
}

const FeatureCard = ({
  icon,
  title,
  description,
  className,
  variant = 'default',
}: FeatureCardProps) => {
  const variants = {
    default: 'bg-white border border-primary-blue/10 hover:border-primary-gold/30 hover:shadow-lg',
    bordered: 'bg-white border-2 border-primary-blue/20 hover:border-primary-gold hover:shadow-xl',
    elevated: 'bg-white shadow-md hover:shadow-2xl border border-primary-blue/5',
    glass:
      'border border-white/30 bg-black/30 backdrop-blur-md shadow-2xl shadow-black/10',
  }

  const isGlass = variant === 'glass'

  return (
    <div
      className={cn(
        'group rounded-3xl p-6 md:p-8 transition-all duration-300',
        !isGlass && 'hover:-translate-y-1',
        variants[variant],
        className
      )}
    >
      <div className="flex items-start gap-4 mb-4">
        <div
          className={cn(
            'flex-shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center transition-transform',
            !isGlass && 'group-hover:scale-110',
            isGlass ? 'bg-white/10' : 'bg-gradient-to-br from-primary-gold/20 to-primary-blue/10'
          )}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3
            className={cn(
              'text-xl md:text-2xl font-bold mb-2',
              isGlass ? 'text-white' : 'text-primary-dark'
            )}
          >
            {title}
          </h3>
        </div>
      </div>
      <p
        className={cn(
          'text-base md:text-lg leading-relaxed',
          isGlass ? 'text-white/90' : 'text-primary-dark/70'
        )}
      >
        {description}
      </p>
    </div>
  )
}

export default FeatureCard
