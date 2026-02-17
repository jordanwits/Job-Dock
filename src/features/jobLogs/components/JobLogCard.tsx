import { format } from 'date-fns'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { JobLog } from '../types/jobLog'
import { getRecurringTag } from '../utils/recurringPattern'

interface JobLogCardProps {
  jobLog: JobLog
  onClick: () => void
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
  showCreatedBy?: boolean
}

const JobLogCard = ({ jobLog, onClick, isSelected, onToggleSelect, showCreatedBy }: JobLogCardProps) => {
  const totalMinutes =
    jobLog.timeEntries?.reduce((sum, te) => {
      const start = new Date(te.startTime).getTime()
      const end = new Date(te.endTime).getTime()
      const breakMin = te.breakMinutes ?? 0
      return sum + (end - start) / 60000 - breakMin
    }, 0) ?? 0
  const hours = Math.floor(totalMinutes / 60)
  const mins = Math.round(totalMinutes % 60)
  const timeEntryCount = jobLog.timeEntries?.length ?? 0
  const photoCount = jobLog.photos?.length ?? 0

  const subtitle = [jobLog.contact?.name, jobLog.location].filter(Boolean).join(' • ')
  const statusLabel = (jobLog.status === 'archived' ? 'inactive' : jobLog.status) || 'active'
  const statusColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20',
    completed: 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20',
    inactive: 'bg-primary-light/10 text-primary-light/70 ring-1 ring-primary-light/20',
  }
  const recurringTag = jobLog.bookings ? getRecurringTag(jobLog.bookings) : null

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary-gold transition-colors relative',
        isSelected && 'ring-2 ring-primary-gold'
      )}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Selection Bullet */}
        {onToggleSelect && (
          <div
            className="absolute top-3 left-3 z-10"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelect(jobLog.id, e)
            }}
          >
            <div
              className={cn(
                'w-5 h-5 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center',
                isSelected
                  ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                  : 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
              )}
            >
              {isSelected && (
                <div className="w-2.5 h-2.5 rounded-full bg-primary-dark" />
              )}
            </div>
          </div>
        )}

        {/* Header */}
        <div className={cn(onToggleSelect && 'pl-8', 'min-w-0')}>
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-primary-light break-words">
              {jobLog.title}
            </h3>
            {recurringTag && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-blue/20 text-primary-gold border border-primary-blue/30 rounded shrink-0">
                {recurringTag}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0', statusColors[statusLabel] || statusColors.inactive)}>
              {statusLabel}
            </span>
            {subtitle && (
              <span className="text-xs text-primary-light/50 break-words min-w-0">{subtitle}</span>
            )}
          </div>
          {(jobLog.assignedToName || (showCreatedBy && jobLog.job?.createdByName)) && (
            <p className="text-xs text-primary-light/60 mt-1 break-words">
              {[jobLog.assignedToName && `Assigned to ${jobLog.assignedToName}`, showCreatedBy && jobLog.job?.createdByName && `Created by ${jobLog.job.createdByName}`]
                .filter(Boolean)
                .join(' • ')}
            </p>
          )}
        </div>

        {/* Time Entries / Photos Count */}
        <div className="text-sm text-primary-light/70">
          {timeEntryCount > 0
            ? `${timeEntryCount} time entry${timeEntryCount !== 1 ? 's' : ''}`
            : photoCount > 0
              ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}`
              : 'No entries yet'}
        </div>

        {/* Total */}
        <div className="pt-2 border-t border-primary-blue">
          <div className="flex justify-between items-center">
            <span className="text-sm text-primary-light/70">Total</span>
            <span className="text-xl font-bold text-primary-gold">
              {hours}h {mins}m
            </span>
          </div>
        </div>

        {/* Created */}
        <div className="text-xs text-primary-light/50">
          Created: {format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
        </div>
      </div>
    </Card>
  )
}

export default JobLogCard
