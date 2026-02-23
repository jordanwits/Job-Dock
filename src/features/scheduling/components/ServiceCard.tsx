import { useServiceStore } from '../store/serviceStore'
import { Card, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Service } from '../types/service'
import { useTheme } from '@/contexts/ThemeContext'

interface ServiceCardProps {
  service: Service
  onClick?: () => void
}

const ServiceCard = ({ service, onClick }: ServiceCardProps) => {
  const { toggleServiceActive } = useServiceStore()
  const { theme } = useTheme()

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await toggleServiceActive(service.id)
  }

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary-gold transition-all',
        !service.isActive && 'opacity-60'
      )}
      onClick={onClick}
    >
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className={cn(
              "font-semibold",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>{service.name}</h3>
            {service.isActive ? (
              <span className={cn(
                "px-2 py-1 rounded text-xs font-medium border",
                theme === 'dark'
                  ? 'bg-green-500/20 text-green-300 border-green-500'
                  : 'bg-green-100 text-green-700 border-green-300'
              )}>
                Active
              </span>
            ) : (
              <span className={cn(
                "px-2 py-1 rounded text-xs font-medium border",
                theme === 'dark'
                  ? 'bg-gray-500/20 text-gray-300 border-gray-500'
                  : 'bg-gray-100 text-gray-700 border-gray-300'
              )}>
                Inactive
              </span>
            )}
          </div>
          {service.description && (
            <p className={cn(
              "text-sm mb-2 line-clamp-2",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>
              {service.description}
            </p>
          )}
          <div className={cn(
            "flex flex-wrap items-center gap-2 md:gap-4 text-sm",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>
            <span>Duration: {service.duration} min</span>
            {service.price && <span>Price: ${service.price}</span>}
          </div>
        </div>
        <div className="flex flex-row sm:flex-col gap-2 sm:ml-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleActive}
            className={cn(
              "flex-1 sm:flex-none border",
              theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
            )}
          >
            {service.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ServiceCard

