import { useEffect } from 'react'
import { useServiceStore } from '../store/serviceStore'
import ServiceCard from './ServiceCard'
import { Button } from '@/components/ui'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

interface ServiceListProps {
  onServiceClick?: (serviceId: string) => void
  onCreateClick?: () => void
}

const ServiceList = ({ onServiceClick, onCreateClick }: ServiceListProps) => {
  const {
    services,
    isLoading,
    fetchServices,
  } = useServiceStore()
  const { theme } = useTheme()

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className={cn(
          theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
        )}>Loading services...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {services.length === 0 ? (
        <div className="p-6 text-center">
          <p className={cn(
            "mb-4",
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}>No services created yet</p>
          {onCreateClick && (
            <Button onClick={onCreateClick}>Create Your First Service</Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onClick={() => onServiceClick?.(service.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default ServiceList

