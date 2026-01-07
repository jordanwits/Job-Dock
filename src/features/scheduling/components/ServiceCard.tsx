import { useServiceStore } from '../store/serviceStore'
import { Card, Button } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Service } from '../types/service'

interface ServiceCardProps {
  service: Service
  onClick?: () => void
}

const ServiceCard = ({ service, onClick }: ServiceCardProps) => {
  const { toggleServiceActive } = useServiceStore()

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
            <h3 className="font-semibold text-primary-light">{service.name}</h3>
            {service.isActive ? (
              <span className="px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-300 border border-green-500">
                Active
              </span>
            ) : (
              <span className="px-2 py-1 rounded text-xs font-medium bg-gray-500/20 text-gray-300 border border-gray-500">
                Inactive
              </span>
            )}
          </div>
          {service.description && (
            <p className="text-sm text-primary-light/70 mb-2 line-clamp-2">
              {service.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 md:gap-4 text-sm text-primary-light/70">
            <span>Duration: {service.duration} min</span>
            {service.price && <span>Price: ${service.price}</span>}
          </div>
        </div>
        <div className="flex flex-row sm:flex-col gap-2 sm:ml-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleActive}
            className="flex-1 sm:flex-none border border-primary-blue"
          >
            {service.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>
    </Card>
  )
}

export default ServiceCard

