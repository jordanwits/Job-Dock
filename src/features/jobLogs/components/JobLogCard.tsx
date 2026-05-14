import { format } from 'date-fns'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { JobLog } from '../types/jobLog'
import { getRecurringTag } from '../utils/recurringPattern'
import { useTheme } from '@/contexts/ThemeContext'

interface JobLogCardProps {
  jobLog: JobLog
  onClick: () => void
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const JobLogCard = ({ jobLog, onClick, isSelected, onToggleSelect }: JobLogCardProps) => {
  const { theme } = useTheme()
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
    active:
      theme === 'dark'
        ? 'bg-green-500/10 text-green-400 ring-1 ring-green-500/20'
        : 'bg-green-100 text-green-700 ring-1 ring-green-300',
    completed:
      theme === 'dark'
        ? 'bg-blue-500/10 text-blue-400 ring-1 ring-blue-500/20'
        : 'bg-blue-100 text-blue-700 ring-1 ring-blue-300',
    inactive:
      theme === 'dark'
        ? 'bg-primary-light/10 text-primary-light/70 ring-1 ring-primary-light/20'
        : 'bg-gray-200 text-gray-600 ring-1 ring-gray-300',
  }
  const recurringTag = jobLog.bookings ? getRecurringTag(jobLog.bookings) : null

  const statusBadge = (
    <span
      className={cn(
        'px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0',
        statusColors[statusLabel] || statusColors.inactive
      )}
    >
      {statusLabel}
    </span>
  )

  return (
    <Card
      className={cn(
        'cursor-pointer hover:border-primary-gold transition-colors',
        isSelected && 'ring-2 ring-primary-gold'
      )}
      onClick={onClick}
    >
      <div className="space-y-3">
        {onToggleSelect && (
          <div className="flex justify-between items-start gap-3">
            <div
              className="shrink-0 z-10"
              onClick={e => {
                e.stopPropagation()
                onToggleSelect(jobLog.id, e)
              }}
            >
              <div
                className={cn(
                  'w-5 h-5 rounded-full border-2 cursor-pointer transition-all duration-200 flex items-center justify-center',
                  isSelected
                    ? 'bg-primary-gold border-primary-gold shadow-lg shadow-primary-gold/50'
                    : theme === 'dark'
                      ? 'border-primary-light/30 bg-primary-dark hover:border-primary-gold/50 hover:bg-primary-gold/10'
                      : 'border-gray-400 bg-white hover:border-primary-gold/50 hover:bg-gray-100'
                )}
              >
                {isSelected && (
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      theme === 'dark' ? 'bg-primary-dark' : 'bg-white'
                    )}
                  />
                )}
              </div>
            </div>
            {statusBadge}
          </div>
        )}

        <div className={cn('min-w-0', !onToggleSelect && 'flex gap-3 items-start justify-between')}>
          <div className={cn('min-w-0 space-y-1.5', !onToggleSelect && 'flex-1')}>
            <div className="flex items-start gap-2 flex-wrap">
              <h3
                className={cn(
                  'text-lg font-semibold break-words',
                  theme === 'dark' ? 'text-primary-light' : 'text-primary-lightText'
                )}
              >
                {jobLog.title}
              </h3>
              {recurringTag && (
                <span className="px-2 py-0.5 text-xs font-medium bg-primary-blue/20 text-primary-gold border border-primary-blue/30 rounded shrink-0">
                  {recurringTag}
                </span>
              )}
            </div>
            {subtitle && (
              <span
                className={cn(
                  'block text-xs break-words min-w-0',
                  theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
                )}
              >
                {subtitle}
              </span>
            )}
            {jobLog.assignedToName && (
              <p
                className={cn(
                  'text-xs break-words',
                  theme === 'dark' ? 'text-primary-light/60' : 'text-primary-lightTextSecondary'
                )}
              >
                Assigned to {jobLog.assignedToName}
              </p>
            )}
          </div>
          {!onToggleSelect && statusBadge}
        </div>

        {/* Time Entries / Photos Count */}
        <div
          className={cn(
            'text-sm',
            theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
          )}
        >
          {timeEntryCount > 0
            ? `${timeEntryCount} time entry${timeEntryCount !== 1 ? 's' : ''}`
            : photoCount > 0
              ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}`
              : 'No entries yet'}
        </div>

        {/* Total */}
        <div
          className={cn(
            'pt-2 border-t',
            theme === 'dark' ? 'border-primary-blue' : 'border-gray-200'
          )}
        >
          <div className="flex justify-between items-center">
            <span
              className={cn(
                'text-sm',
                theme === 'dark' ? 'text-primary-light/70' : 'text-primary-lightTextSecondary'
              )}
            >
              Total
            </span>
            <span className="text-xl font-bold text-primary-gold">
              {hours}h {mins}m
            </span>
          </div>
        </div>

        {/* Created */}
        <div
          className={cn(
            'text-xs',
            theme === 'dark' ? 'text-primary-light/50' : 'text-primary-lightTextSecondary'
          )}
        >
          Created: {format(new Date(jobLog.createdAt), 'MMM d, yyyy')}
        </div>
      </div>
    </Card>
  )
}

export default JobLogCard
