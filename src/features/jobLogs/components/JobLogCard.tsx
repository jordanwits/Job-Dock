import { format } from 'date-fns'
import type { JobLog } from '../types/jobLog'
import { getRecurringTag } from '../utils/recurringPattern'
import { SelectCircle, StatusBadge, TagChip } from './jobLogsUi'
import { JOB_STATUS, type JobLogStatus } from './jobLogStatus'

interface JobLogCardProps {
  jobLog: JobLog
  onClick: () => void
  isSelected?: boolean
  onToggleSelect?: (id: string, event: React.MouseEvent) => void
}

const resolveStatus = (status?: string): JobLogStatus => {
  if (status === 'archived') return 'inactive'
  if (status === 'completed' || status === 'inactive') return status
  return 'active'
}

const JobLogCard = ({ jobLog, onClick, isSelected, onToggleSelect }: JobLogCardProps) => {
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
  const status = JOB_STATUS[resolveStatus(jobLog.status)]
  const recurringTag = jobLog.bookings ? getRecurringTag(jobLog.bookings) : null

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={
        'group relative flex cursor-pointer flex-col rounded-xl bg-surface p-5 shadow-card outline-none transition-shadow hover:shadow-pop focus-visible:ring-2 focus-visible:ring-accent' +
        (isSelected ? ' ring-2 ring-accent' : '')
      }
    >
      {/* Top row: title + status / selection */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-start gap-2">
            <h3 className="break-words text-[15px] font-semibold text-ink">{jobLog.title}</h3>
            {recurringTag && <TagChip>{recurringTag}</TagChip>}
          </div>
          {subtitle && <p className="break-words text-[13px] text-ink-muted">{subtitle}</p>}
          {jobLog.assignedToName && (
            <p className="break-words text-[13px] text-ink-subtle">Assigned to {jobLog.assignedToName}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
          {onToggleSelect && (
            <SelectCircle
              selected={!!isSelected}
              onClick={e => {
                e.stopPropagation()
                onToggleSelect(jobLog.id, e)
              }}
            />
          )}
        </div>
      </div>

      {/* Time entries / photos count */}
      <p className="mt-4 text-[13px] text-ink-muted">
        {timeEntryCount > 0 ? (
          <>
            <span className="font-mono tabular-nums text-ink">{timeEntryCount}</span>{' '}
            {timeEntryCount === 1 ? 'time entry' : 'time entries'}
          </>
        ) : photoCount > 0 ? (
          <>
            <span className="font-mono tabular-nums text-ink">{photoCount}</span>{' '}
            {photoCount === 1 ? 'photo' : 'photos'}
          </>
        ) : (
          'No entries yet'
        )}
      </p>

      {/* Total */}
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-4">
        <span className="text-[13px] text-ink-muted">Total</span>
        <span className="font-mono text-xl font-semibold tabular-nums text-ink">
          {hours}h {mins}m
        </span>
      </div>

      {/* Created */}
      <p className="mt-2 text-[12px] text-ink-subtle">
        Created{' '}
        <span className="font-mono tabular-nums">{format(new Date(jobLog.createdAt), 'MMM d, yyyy')}</span>
      </p>
    </div>
  )
}

export default JobLogCard
