import { } from 'react'
import { Modal, Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Service } from '../types/service'
import { useTheme } from '@/contexts/ThemeContext'

interface ServiceDetailProps {
  service: Service
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onGetLink?: () => void
}

const ServiceDetail = ({ service, isOpen, onClose, onEdit, onDelete, onGetLink }: ServiceDetailProps) => {
  const { theme } = useTheme()
  const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const workingHours = service.availability?.workingHours || []
  const workingDays = workingHours.filter((wh: any) => wh.isWorking)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Service Details"
      size="lg"
      footer={
        <>
          {onDelete && (
            <Button variant="ghost" onClick={onDelete} className="text-red-500 hover:text-red-600 border border-red-500/50">
              Delete
            </Button>
          )}
          {onGetLink && (
            <Button variant="ghost" onClick={onGetLink} className={cn(
              "border",
              theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
            )}>
              Get Booking Link
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" onClick={onEdit} className={cn(
              "border",
              theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
            )}>
              Edit
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className={cn(
              "text-2xl font-bold mb-2",
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>{service.name}</h2>
            <span
              className={cn(
                'inline-block px-3 py-1 rounded text-sm font-medium border',
                service.isActive
                  ? theme === 'dark'
                    ? 'border-green-500 bg-green-500/10 text-green-300'
                    : 'border-green-300 bg-green-100 text-green-700'
                  : theme === 'dark'
                    ? 'border-gray-500 bg-gray-500/10 text-gray-300'
                    : 'border-gray-300 bg-gray-100 text-gray-700'
              )}
            >
              {service.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {service.description && (
          <Card>
            <h3 className={cn(
              "text-sm font-medium mb-2",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>Description</h3>
            <p className={cn(
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>{service.description}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <h3 className={cn(
              "text-sm font-medium mb-2",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>Duration</h3>
            <p className={cn(
              theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
            )}>{service.duration} minutes</p>
          </Card>

          {service.price && (
            <Card>
              <h3 className={cn(
                "text-sm font-medium mb-2",
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}>Price</h3>
              <p className={cn(
                theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
              )}>${Number(service.price).toFixed(2)}</p>
            </Card>
          )}
        </div>

        {workingDays.length > 0 && (
          <Card>
            <h3 className={cn(
              "text-sm font-medium mb-3",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>Working Hours</h3>
            <div className="space-y-2">
              {workingDays.map((wh: any) => (
                <div key={wh.dayOfWeek} className="flex items-center justify-between text-sm">
                  <span className={cn(
                    "font-medium",
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}>
                    {DAYS_OF_WEEK[wh.dayOfWeek]}
                  </span>
                  <span className={cn(
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>
                    {wh.startTime} - {wh.endTime}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {service.availability && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {service.availability.bufferTime !== undefined && (
              <Card>
                <h3 className={cn(
                  "text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Buffer Time</h3>
                <p className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>{service.availability.bufferTime} minutes</p>
              </Card>
            )}

            {service.availability.advanceBookingDays !== undefined && (
              <Card>
                <h3 className={cn(
                  "text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Advance Booking</h3>
                <p className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>{service.availability.advanceBookingDays} days</p>
              </Card>
            )}

            {service.availability.sameDayBooking !== undefined && (
              <Card>
                <h3 className={cn(
                  "text-sm font-medium mb-2",
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Same-Day Booking</h3>
                <p className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
                  {service.availability.sameDayBooking ? 'Allowed' : 'Not Allowed'}
                </p>
              </Card>
            )}
          </div>
        )}

        {service.bookingSettings && (
          <Card>
            <h3 className={cn(
              "text-sm font-medium mb-3",
              theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
            )}>Booking Settings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Require Confirmation:</span>
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
                  {service.bookingSettings.requireConfirmation ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                )}>Allow Cancellation:</span>
                <span className={cn(
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}>
                  {service.bookingSettings.allowCancellation ? 'Yes' : 'No'}
                </span>
              </div>
              {service.bookingSettings.cancellationHours !== undefined && (
                <div className="flex items-center justify-between">
                  <span className={cn(
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>Cancellation Window:</span>
                  <span className={cn(
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}>
                    {service.bookingSettings.cancellationHours} hours
                  </span>
                </div>
              )}
              {service.bookingSettings.maxBookingsPerSlot !== undefined && (
                <div className="flex items-center justify-between">
                  <span className={cn(
                    theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
                  )}>Max Bookings Per Slot:</span>
                  <span className={cn(
                    theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                  )}>
                    {service.bookingSettings.maxBookingsPerSlot}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </Modal>
  )
}

export default ServiceDetail

