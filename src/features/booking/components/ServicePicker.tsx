import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Service } from '@/features/scheduling/types/service'

interface ServicePickerProps {
  services: Service[]
  selectedServiceId: string | null
  onServiceSelect: (serviceId: string) => void
}

const ServicePicker = ({ services, selectedServiceId, onServiceSelect }: ServicePickerProps) => {
  if (services.length === 0) {
    return (
      <div className="text-center p-6">
        <p className="text-primary-light/70">No services available for booking</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-primary-light mb-4">Select a Service</h2>
      <div className="grid grid-cols-1 gap-3">
        {services.map((service) => (
          <Card
            key={service.id}
            className={cn(
              'cursor-pointer transition-all hover:border-primary-gold',
              selectedServiceId === service.id && 'border-primary-gold bg-primary-gold/5'
            )}
            onClick={() => onServiceSelect(service.id)}
          >
            <div className="space-y-2">
              <h3 className="font-semibold text-primary-light">{service.name}</h3>
              {service.description && (
                <p className="text-sm text-primary-light/70 line-clamp-2">
                  {service.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-sm text-primary-light/70">
                <span className="flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {service.duration} minutes
                </span>
                {service.price && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    ${Number(service.price).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

export default ServicePicker

