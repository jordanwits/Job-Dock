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
    scheduled: 'border-blue-500 bg-blue-500/10',
    'in-progress': 'border-yellow-500 bg-yellow-500/10',
    completed: 'border-green-500 bg-green-500/10',
    cancelled: 'border-red-500 bg-red-500/10',
    'pending-confirmation': 'border-orange-500 bg-orange-500/10',
  }

  const statusLabels = {
    scheduled: 'Scheduled',
    'in-progress': 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    'pending-confirmation': 'Pending Confirmation',
  }

  const isArchived = !!job.archivedAt

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary-gold transition-all',
        statusColors[job.status],
        isArchived && 'opacity-75 bg-gray-50 border-gray-300'
      )}
      onClick={() => setSelectedJob(job)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-primary-light">{job.title}</h3>
            {isArchived && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-700">
                📦 Archived
              </span>
            )}
          </div>
          {job.description && (
            <p className="text-sm text-primary-light/70 mb-2 line-clamp-2">
              {job.description}
            </p>
          )}
          <div className="space-y-1 text-sm text-primary-light/70">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {job.startTime ? (
                <span>{format(new Date(job.startTime), 'MMM d, yyyy h:mm a')}</span>
              ) : (
                <span className="text-amber-400">To Be Scheduled</span>
              )}
            </div>
            {job.contactName && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>{job.contactName}</span>
              </div>
            )}
            {job.location && (
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="line-clamp-1">{job.location}</span>
              </div>
            )}
          </div>
        </div>
        <div className="ml-4">
          <span
            className={cn(
              'px-2 py-1 rounded text-xs font-medium',
              statusColors[job.status],
              'text-primary-light'
            )}
          >
            {statusLabels[job.status]}
          </span>
        </div>
      </div>
    </Card>
  )
}

export default JobCard

