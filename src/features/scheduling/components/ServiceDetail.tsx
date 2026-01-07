import { useState } from 'react'
import { Modal, Button, Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Service } from '../types/service'

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
            <Button variant="ghost" onClick={onGetLink} className="border border-primary-blue">
              Get Booking Link
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" onClick={onEdit} className="border border-primary-blue">
              Edit
            </Button>
          )}
          <Button onClick={onClose} className="border border-primary-gold">Close</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-primary-light mb-2">{service.name}</h2>
            <span
              className={cn(
                'inline-block px-3 py-1 rounded text-sm font-medium',
                service.isActive
                  ? 'border-green-500 bg-green-500/10 text-green-300'
                  : 'border-gray-500 bg-gray-500/10 text-gray-300'
              )}
            >
              {service.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        {service.description && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Description</h3>
            <p className="text-primary-light">{service.description}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Duration</h3>
            <p className="text-primary-light">{service.duration} minutes</p>
          </Card>

          {service.price && (
            <Card>
              <h3 className="text-sm font-medium text-primary-light/70 mb-2">Price</h3>
              <p className="text-primary-light">${Number(service.price).toFixed(2)}</p>
            </Card>
          )}
        </div>

        {workingDays.length > 0 && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-3">Working Hours</h3>
            <div className="space-y-2">
              {workingDays.map((wh: any) => (
                <div key={wh.dayOfWeek} className="flex items-center justify-between text-sm">
                  <span className="text-primary-light font-medium">
                    {DAYS_OF_WEEK[wh.dayOfWeek]}
                  </span>
                  <span className="text-primary-light/70">
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
                <h3 className="text-sm font-medium text-primary-light/70 mb-2">Buffer Time</h3>
                <p className="text-primary-light">{service.availability.bufferTime} minutes</p>
              </Card>
            )}

            {service.availability.advanceBookingDays !== undefined && (
              <Card>
                <h3 className="text-sm font-medium text-primary-light/70 mb-2">Advance Booking</h3>
                <p className="text-primary-light">{service.availability.advanceBookingDays} days</p>
              </Card>
            )}

            {service.availability.sameDayBooking !== undefined && (
              <Card>
                <h3 className="text-sm font-medium text-primary-light/70 mb-2">Same-Day Booking</h3>
                <p className="text-primary-light">
                  {service.availability.sameDayBooking ? 'Allowed' : 'Not Allowed'}
                </p>
              </Card>
            )}
          </div>
        )}

        {service.bookingSettings && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-3">Booking Settings</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-primary-light/70">Require Confirmation:</span>
                <span className="text-primary-light">
                  {service.bookingSettings.requireConfirmation ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-primary-light/70">Allow Cancellation:</span>
                <span className="text-primary-light">
                  {service.bookingSettings.allowCancellation ? 'Yes' : 'No'}
                </span>
              </div>
              {service.bookingSettings.cancellationHours !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-primary-light/70">Cancellation Window:</span>
                  <span className="text-primary-light">
                    {service.bookingSettings.cancellationHours} hours
                  </span>
                </div>
              )}
              {service.bookingSettings.maxBookingsPerSlot !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-primary-light/70">Max Bookings Per Slot:</span>
                  <span className="text-primary-light">
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

