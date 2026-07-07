import { cn } from '@/lib/utils'
import type { Service } from '@/features/scheduling/types/service'

interface ServicePickerProps {
  services: Service[]
  selectedServiceId: string | null
  onServiceSelect: (serviceId: string) => void
}

const ClockIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden>
    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const ServicePicker = ({ services, selectedServiceId, onServiceSelect }: ServicePickerProps) => {
  if (services.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-ink-muted">No services available for booking</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold tracking-tight text-ink">Select a service</h2>
      <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Services">
        {services.map(service => {
          const isSelected = selectedServiceId === service.id
          return (
            <button
              key={service.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onServiceSelect(service.id)}
              className={cn(
                'w-full rounded-2xl bg-surface p-4 text-left shadow-card ring-1 transition-[box-shadow,background-color] duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                isSelected
                  ? 'bg-accent-soft/40 ring-2 ring-accent'
                  : 'ring-line hover:bg-surface-hover hover:ring-line-strong'
              )}
            >
              <div className="space-y-2">
                <h3 className="font-semibold text-ink">{service.name}</h3>
                {service.description && (
                  <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">{service.description}</p>
                )}
                <div className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="h-4 w-4 text-ink-subtle" />
                    <span className="font-mono tabular-nums">{service.duration} min</span>
                  </span>
                  {service.price && (
                    <span className="font-mono font-medium tabular-nums text-ink">
                      ${Number(service.price).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default ServicePicker
