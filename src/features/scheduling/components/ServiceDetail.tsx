import type { Service } from '../types/service'
import { AppButton, AppModal, StatusBadge } from './schedulingUi'
import { serviceStatus } from './schedulingStatus'

interface ServiceDetailProps {
  service: Service
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onGetLink?: () => void
}

const ServiceDetail = ({ service, isOpen, onClose, onEdit, onDelete, onGetLink }: ServiceDetailProps) => {
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const { label: statusLabel, tone: statusTone } = serviceStatus(service.isActive)

  const workingHours = service.availability?.workingHours || []
  const workingDays = workingHours.filter((wh: any) => wh.isWorking)

  const panelCls = 'rounded-xl border border-line bg-surface-2 p-4'
  const panelLabelCls = 'mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle'

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title="Service details"
      size="lg"
      footer={
        <>
          {onDelete && (
            <AppButton variant="dangerGhost" onClick={onDelete}>
              Delete
            </AppButton>
          )}
          {onGetLink && (
            <AppButton variant="subtle" onClick={onGetLink}>
              Get booking link
            </AppButton>
          )}
          {onEdit && (
            <AppButton variant="subtle" onClick={onEdit}>
              Edit
            </AppButton>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="mb-2 text-2xl font-semibold tracking-tight text-ink">{service.name}</h2>
            <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          </div>
        </div>

        {service.description && (
          <div className={panelCls}>
            <h3 className={panelLabelCls}>Description</h3>
            <p className="text-sm leading-relaxed text-ink">{service.description}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className={panelCls}>
            <h3 className={panelLabelCls}>Duration</h3>
            <p className="text-sm text-ink">
              <span className="font-mono tabular-nums">{service.duration}</span> minutes
            </p>
          </div>

          {service.price && (
            <div className={panelCls}>
              <h3 className={panelLabelCls}>Price</h3>
              <p className="font-mono text-sm tabular-nums text-ink">${Number(service.price).toFixed(2)}</p>
            </div>
          )}
        </div>

        {workingDays.length > 0 && (
          <div className={panelCls}>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Working hours</h3>
            <div className="space-y-2">
              {workingDays.map((wh: any) => (
                <div key={wh.dayOfWeek} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{DAYS_OF_WEEK[wh.dayOfWeek]}</span>
                  <span className="font-mono tabular-nums text-ink-muted">
                    {wh.startTime} - {wh.endTime}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {service.availability && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {service.availability.bufferTime !== undefined && (
              <div className={panelCls}>
                <h3 className={panelLabelCls}>Buffer time</h3>
                <p className="text-sm text-ink">
                  <span className="font-mono tabular-nums">{service.availability.bufferTime}</span> minutes
                </p>
              </div>
            )}

            {service.availability.advanceBookingDays !== undefined && (
              <div className={panelCls}>
                <h3 className={panelLabelCls}>Advance booking</h3>
                <p className="text-sm text-ink">
                  <span className="font-mono tabular-nums">{service.availability.advanceBookingDays}</span> days
                </p>
              </div>
            )}

            {service.availability.sameDayBooking !== undefined && (
              <div className={panelCls}>
                <h3 className={panelLabelCls}>Same-day booking</h3>
                <p className="text-sm text-ink">
                  {service.availability.sameDayBooking ? 'Allowed' : 'Not allowed'}
                </p>
              </div>
            )}
          </div>
        )}

        {service.bookingSettings && (
          <div className={panelCls}>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Booking settings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Require confirmation</span>
                <span className="text-ink">
                  {service.bookingSettings.requireConfirmation ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">Allow cancellation</span>
                <span className="text-ink">
                  {service.bookingSettings.allowCancellation ? 'Yes' : 'No'}
                </span>
              </div>
              {service.bookingSettings.cancellationHours !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Cancellation window</span>
                  <span className="text-ink">
                    <span className="font-mono tabular-nums">{service.bookingSettings.cancellationHours}</span> hours
                  </span>
                </div>
              )}
              {service.bookingSettings.maxBookingsPerSlot !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">Max bookings per slot</span>
                  <span className="font-mono tabular-nums text-ink">
                    {service.bookingSettings.maxBookingsPerSlot}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppModal>
  )
}

export default ServiceDetail
