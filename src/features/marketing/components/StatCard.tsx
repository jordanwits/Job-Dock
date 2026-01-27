import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  icon?: ReactNode
  value: string
  label: string
  description?: string
  className?: string
}

const StatCard = ({
  icon,
  value,
  label,
  description,
  className,
}: StatCardProps) => {
  return (
    <div className={cn(
      'bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-6 md:p-8 text-center group hover:bg-white/20 transition-all duration-300',
      className
    )}>
      {icon && (
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-gold/20 rounded-full mb-4 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      )}
      <div className="text-4xl md:text-5xl font-bold text-primary-gold mb-2">{value}</div>
      <div className="text-lg md:text-xl font-semibold text-white mb-1">{label}</div>
      {description && (
        <p className="text-sm text-white/70 mt-2">{description}</p>
      )}
    </div>
  )
}

export default StatCard
