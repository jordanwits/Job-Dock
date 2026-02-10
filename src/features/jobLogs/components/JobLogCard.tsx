import { format } from 'date-fns'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { JobLog } from '../types/jobLog'
import { getNotesPreview } from '../utils/notesUtils'

interface JobLogCardProps {
  jobLog: JobLog
  onClick: () => void
}

const JobLogCard = ({ jobLog, onClick }: JobLogCardProps) => {
  const totalMinutes =
    jobLog.timeEntries?.reduce((sum, te) => {
    const start = new Date(te.startTime).getTime()
    const end = new Date(te.endTime).getTime()
    const breakMin = te.breakMinutes ?? 0
    return sum + (end - start) / 60000 - breakMin
    }, 0) ?? 0
  const hours = Math.floor(totalMinutes / 60)
  const mins = Math.round(totalMinutes % 60)
  const hasTime = (jobLog.timeEntries?.length ?? 0) > 0
  const photoCount = jobLog.photos?.length ?? 0
  const notesPreview = getNotesPreview(jobLog.notes)
  const hasNotes = Boolean(notesPreview)

  const statusColors = {
    active: 'bg-primary-blue/30 text-primary-light border-primary-blue/50',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    archived: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  } as const

  const statusLabels = {
    active: 'Active',
    completed: 'Completed',
    archived: 'Archived',
  } as const

  return (
    <Card
      className="p-4 cursor-pointer transition-all hover:border-primary-gold/30 hover:bg-primary-dark/40"
      onClick={onClick}
    >
      <div className="flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-semibold text-primary-light truncate">{jobLog.title}</h3>
            <div className="mt-1 flex items-center gap-3 text-xs text-primary-light/60 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                {format(new Date(jobLog.updatedAt || jobLog.createdAt), 'MMM d, yyyy')}
              </span>
              {jobLog.updatedAt && jobLog.updatedAt !== jobLog.createdAt && (
                <span className="text-primary-light/40">Updated</span>
              )}
            </div>
          </div>

          <span
            className={cn(
              'px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full border whitespace-nowrap',
              statusColors[jobLog.status]
            )}
          >
            {statusLabels[jobLog.status]}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1">
          {jobLog.location && (
            <div className="flex items-center gap-2 text-sm text-primary-light/70">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="truncate">{jobLog.location}</span>
            </div>
          )}
          {jobLog.contact?.name && (
            <div className="flex items-center gap-2 text-sm text-primary-light/70">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="truncate">{jobLog.contact.name}</span>
            </div>
          )}
          {hasNotes && (
            <div className="text-xs text-primary-light/50 line-clamp-2">
              {notesPreview}
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-3 text-xs text-primary-light/60 flex-wrap pt-2 border-t border-white/10">
          <span className={cn('inline-flex items-center gap-1', hasTime ? 'text-primary-gold' : 'text-primary-light/50')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {hasTime ? `${hours}h ${mins}m` : 'No time yet'}
          </span>

          <span className={cn('inline-flex items-center gap-1', photoCount > 0 ? '' : 'text-primary-light/50')}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7h4l2-2h6l2 2h4v12H3V7z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 17a4 4 0 100-8 4 4 0 000 8z"
              />
            </svg>
            {photoCount > 0 ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}` : 'No photos'}
          </span>
        </div>
      </div>
    </Card>
  )
}

export default JobLogCard
