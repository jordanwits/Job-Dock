import { useMemo, useState } from 'react'
import { useJobStore } from '../store/jobStore'
import type { Job } from '../types/job'
import JobCard from './JobCard'
import { getUpcomingBookingListInstant } from '../utils/upcomingBookingDisplay'
import { addDays } from 'date-fns'
import { cn } from '@/lib/utils'
import { Spinner } from './schedulingUi'

type TimeFrame = 'day' | 'week' | 'month'

interface JobListProps {
  showCreatedBy?: boolean
  onJobClick?: (job: Job) => void
}

const TIME_FRAMES: { value: TimeFrame; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

const JobList = ({ showCreatedBy, onJobClick }: JobListProps) => {
  const {
    jobs,
    isLoading,
  } = useJobStore()

  const [timeFrame, setTimeFrame] = useState<TimeFrame>('week')

  // No fetch here: SchedulingPage (the only consumer) already fetches a WIDER window
  // (-2..+5 months) into the same shared store on every date change. Refetching a narrower
  // range from this tab used to truncate the calendar's data when switching tabs.

  // Upcoming active jobs: multi-day jobs use the next in-range calendar day (one row per job).
  const filteredJobs = useMemo(() => {
    const now = new Date()
    let windowEnd: Date

    switch (timeFrame) {
      case 'day':
        windowEnd = addDays(now, 1)
        break
      case 'week':
        windowEnd = addDays(now, 7)
        break
      case 'month':
        windowEnd = addDays(now, 30)
        break
      default:
        windowEnd = addDays(now, 7)
    }

    const entries: { job: Job; displayAt: Date }[] = []
    for (const job of jobs) {
      if (!job.startTime) continue
      const displayAt = getUpcomingBookingListInstant(job, now)
      if (!displayAt || displayAt.getTime() > windowEnd.getTime()) continue
      entries.push({ job, displayAt })
    }

    return entries.sort((a, b) => a.displayAt.getTime() - b.displayAt.getTime())
  }, [jobs, timeFrame])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-ink-muted">
        <Spinner className="text-accent-strong" />
        Loading jobs...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Time Frame Selector */}
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-surface-2 p-1">
        {TIME_FRAMES.map(tf => (
          <button
            key={tf.value}
            onClick={() => setTimeFrame(tf.value)}
            className={cn(
              'flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              timeFrame === tf.value
                ? 'bg-surface text-accent-strong shadow-card'
                : 'text-ink-subtle hover:text-ink'
            )}
            aria-pressed={timeFrame === tf.value}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto">
        {filteredJobs.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-ink-muted">
            No upcoming jobs scheduled for the next {timeFrame}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredJobs.map(({ job, displayAt }) => (
              <JobCard
                key={job.id}
                job={job}
                scheduledDisplayAt={displayAt}
                showCreatedBy={showCreatedBy}
                onClick={onJobClick}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default JobList
