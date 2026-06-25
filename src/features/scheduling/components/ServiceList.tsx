import { useEffect } from 'react'
import { useServiceStore } from '../store/serviceStore'
import ServiceCard from './ServiceCard'
import { AppButton, EmptyState, Spinner, CalendarIcon } from './schedulingUi'

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

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-ink-muted">
        <Spinner className="text-accent-strong" />
        Loading services...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {services.length === 0 ? (
        <EmptyState
          icon={<CalendarIcon className="h-7 w-7" />}
          title="No services created yet."
          action={
            onCreateClick ? (
              <AppButton onClick={onCreateClick} className="mt-1">
                Create your first service
              </AppButton>
            ) : undefined
          }
        />
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
