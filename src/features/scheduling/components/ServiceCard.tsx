import { useServiceStore } from '../store/serviceStore'
import { cn } from '@/lib/utils'
import type { Service } from '../types/service'
import { AppButton, StatusBadge } from './schedulingUi'
import { serviceStatus } from './schedulingStatus'

interface ServiceCardProps {
  service: Service
  onClick?: () => void
}

const ServiceCard = ({ service, onClick }: ServiceCardProps) => {
  const { toggleServiceActive } = useServiceStore()
  const { label, tone } = serviceStatus(service.isActive)

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await toggleServiceActive(service.id)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'group relative flex cursor-pointer flex-col rounded-xl bg-surface p-5 shadow-card outline-none transition-shadow hover:shadow-pop focus-visible:ring-2 focus-visible:ring-accent',
        !service.isActive && 'opacity-60'
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-ink">{service.name}</h3>
            <StatusBadge tone={tone}>{label}</StatusBadge>
          </div>
          {service.description && (
            <p className="mb-2 line-clamp-2 text-sm text-ink-muted">{service.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted md:gap-4">
            <span>
              Duration:{' '}
              <span className="font-mono tabular-nums text-ink">{service.duration}</span> min
            </span>
            {service.price && (
              <span>
                Price:{' '}
                <span className="font-mono tabular-nums text-ink">${service.price}</span>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-2 sm:ml-4 sm:flex-col">
          <AppButton
            size="sm"
            variant="subtle"
            onClick={handleToggleActive}
            className="flex-1 sm:flex-none"
          >
            {service.isActive ? 'Deactivate' : 'Activate'}
          </AppButton>
        </div>
      </div>
    </div>
  )
}

export default ServiceCard
