import { format } from 'date-fns'
import { Modal, Button, Card } from '@/components/ui'
import { useJobStore } from '../store/jobStore'
import type { Job } from '../types/job'
import { cn } from '@/lib/utils'

interface JobDetailProps {
  job: Job
  isOpen: boolean
  onClose: () => void
  onEdit?: () => void
  onDelete?: () => void
  onConfirm?: () => void
  onDecline?: () => void
}

const JobDetail = ({ job, isOpen, onClose, onEdit, onDelete, onConfirm, onDecline }: JobDetailProps) => {
  const statusColors = {
    scheduled: 'border-blue-500 bg-blue-500/10 text-blue-300',
    'in-progress': 'border-yellow-500 bg-yellow-500/10 text-yellow-300',
    completed: 'border-green-500 bg-green-500/10 text-green-300',
    cancelled: 'border-red-500 bg-red-500/10 text-red-300',
    'pending-confirmation': 'border-orange-500 bg-orange-500/10 text-orange-300',
  }

  const statusLabels = {
    scheduled: 'Scheduled',
    'in-progress': 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'pending-confirmation': 'Pending Confirmation',
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Job Details"
      size="lg"
      footer={
        <>
          {job.status === 'pending-confirmation' && (
            <>
              {onDecline && (
                <Button variant="ghost" onClick={onDecline} className="text-red-500 hover:text-red-600">
                  Decline
                </Button>
              )}
              {onConfirm && (
                <Button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white">
                  Confirm Booking
                </Button>
              )}
            </>
          )}
          {job.status !== 'pending-confirmation' && (
            <>
              {onDelete && (
                <Button variant="ghost" onClick={onDelete} className="text-red-500 hover:text-red-600">
                  Delete
                </Button>
              )}
              {onEdit && (
                <Button variant="ghost" onClick={onEdit}>
                  Edit
                </Button>
              )}
            </>
          )}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-primary-light mb-2">{job.title}</h2>
            <span
              className={cn(
                'inline-block px-3 py-1 rounded text-sm font-medium',
                statusColors[job.status]
              )}
            >
              {statusLabels[job.status]}
            </span>
          </div>
        </div>

        {job.description && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Description</h3>
            <p className="text-primary-light">{job.description}</p>
          </Card>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Start Time</h3>
            <p className="text-primary-light">
              {format(new Date(job.startTime), 'MMM d, yyyy h:mm a')}
            </p>
          </Card>

          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">End Time</h3>
            <p className="text-primary-light">
              {format(new Date(job.endTime), 'MMM d, yyyy h:mm a')}
            </p>
          </Card>
        </div>

        <Card>
          <h3 className="text-sm font-medium text-primary-light/70 mb-2">Contact</h3>
          <div className="space-y-1">
            {job.contactName ? (
              <>
                <p className="text-primary-light font-medium">{job.contactName}</p>
                {job.contactEmail && (
                  <p className="text-sm text-primary-light/70">{job.contactEmail}</p>
                )}
                {job.contactPhone && (
                  <p className="text-sm text-primary-light/70">{job.contactPhone}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-primary-light/50 italic">Contact information not available</p>
            )}
          </div>
        </Card>

        {job.serviceName && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Service</h3>
            <p className="text-primary-light">{job.serviceName}</p>
          </Card>
        )}

        {job.location && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Location</h3>
            <p className="text-primary-light">{job.location}</p>
          </Card>
        )}

        {job.notes && (
          <Card>
            <h3 className="text-sm font-medium text-primary-light/70 mb-2">Notes</h3>
            <p className="text-primary-light whitespace-pre-wrap">{job.notes}</p>
          </Card>
        )}
      </div>
    </Modal>
  )
}

export default JobDetail

