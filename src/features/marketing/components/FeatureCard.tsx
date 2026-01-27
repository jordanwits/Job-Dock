import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface FeatureCardProps {
  icon: ReactNode
  title: string
  description: string
  className?: string
  variant?: 'default' | 'bordered' | 'elevated'
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
  }

  return (
    <div className={cn(
      'group rounded-xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-1',
      variants[variant],
      className
    )}>
      <div className="flex items-start gap-4 mb-4">
        <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary-gold/20 to-primary-blue/10 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-xl md:text-2xl font-bold text-primary-dark mb-2">{title}</h3>
        </div>
      </div>
      <p className="text-base md:text-lg text-primary-dark/70 leading-relaxed">{description}</p>
    </div>
  )
}

export default FeatureCard
