import { format } from 'date-fns'
import { useJobStore } from '../store/jobStore'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { Job } from '../types/job'

interface JobCardProps {
  job: Job
}

const JobCard = ({ job }: JobCardProps) => {
  const { setSelectedJob } = useJobStore()

  const statusColors = {
    scheduled: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
    'in-progress': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
    'pending-confirmation': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  }

  const statusLabels = {
    scheduled: 'Scheduled',
    'in-progress': 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'pending-confirmation': 'Pending Confirmation',
  }

  const isArchived = !!job.archivedAt

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

  const subtitle = [job.contactName, job.location].filter(Boolean).join(' • ')

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary-gold transition-colors',
        isArchived && 'opacity-75'
      )}
      onClick={() => setSelectedJob(job)}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-lg font-semibold text-primary-light">
              {job.title}
              {isArchived && (
                <span className="text-primary-light/60 ml-2">• Archived</span>
              )}
            </h3>
            {subtitle && (
              <p className="text-xs text-primary-light/50 mt-1">{subtitle}</p>
            )}
          </div>
          <span
            className={cn(
              'px-2 py-1 text-xs font-medium rounded border flex-shrink-0',
              statusColors[job.status]
            )}
          >
            {statusLabels[job.status]}
          </span>
        </div>

        {/* Scheduled Time */}
        <div className="text-sm text-primary-light/70">
          {job.startTime
            ? format(new Date(job.startTime), 'MMM d, h:mm a')
            : 'To be scheduled'}
        </div>

        {/* Total / Price */}
        <div className="pt-2 border-t border-primary-blue">
          <div className="flex justify-between items-center">
            <span className="text-sm text-primary-light/70">
              {job.price != null ? 'Total' : 'Scheduled'}
            </span>
            <span className="text-xl font-bold text-primary-gold">
              {job.price != null
                ? formatCurrency(job.price)
                : job.startTime
                  ? format(new Date(job.startTime), 'h:mm a')
                  : '—'}
            </span>
          </div>
        </div>

        {/* Service */}
        {job.serviceName && (
          <div className="text-xs text-primary-light/50">
            {job.serviceName}
          </div>
        )}
      </div>
    </Card>
  )
}

export default JobCard
